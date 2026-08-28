"""Unit tests for the GrowthPriority domain command/query handlers, run
against the in-memory `FakeGrowthPriorityRepository` and
`FakeConsentCheckPort`. Exercises the ported behavior of
`GrowthPriorityService.confirmGrowthPriority` (NestJS) end-to-end at the
application layer, without HTTP or a real database — per migration plan
section 9's "FakeProvider" requirement. Business reference:
`architecture/notes/batch2-domain-research-v1.md` section 3.2.
"""
from __future__ import annotations

import uuid

import pytest

from domains.growth_priority.application.commands import (
    ConfirmGrowthPriorityCommand,
    GetGrowthPriorityDraftQuery,
    GrowthPriorityCommandHandler,
    GrowthPriorityQueryHandler,
    MutationMeta,
)
from domains.growth_priority.domain.errors import (
    GrowthPriorityConflictError,
    GrowthPriorityForbiddenError,
)
from domains.growth_priority.domain.state_machine import assert_legal_transition, supersede
from domains.growth_priority.domain.value_objects import (
    GrowthPriorityStatus,
    SafetyDisposition,
    SafetySeverity,
)
from domains.growth_priority.infrastructure.fake_consent_port import FakeConsentCheckPort
from domains.growth_priority.infrastructure.fake_repository import FakeGrowthPriorityRepository

ACTOR = "actor-1"


def _meta(key: str = "idem-1") -> MutationMeta:
    return MutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


@pytest.fixture
def repo() -> FakeGrowthPriorityRepository:
    repository = FakeGrowthPriorityRepository()
    family_id = str(uuid.uuid4())
    onboarding_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    repository.seed_family(family_id)
    repository.seed_active_onboarding(family_id, onboarding_id)
    repository.seed_resolved_subject(family_id, onboarding_id, child_id)
    repository.seed_candidate(family_id, onboarding_id, "P03", reason_codes=["LOW_LISTENING_SIGNAL"])
    repository._test_family_id = family_id  # type: ignore[attr-defined]
    repository._test_onboarding_id = onboarding_id  # type: ignore[attr-defined]
    repository._test_child_id = child_id  # type: ignore[attr-defined]
    return repository


@pytest.fixture
def consent(repo: FakeGrowthPriorityRepository) -> FakeConsentCheckPort:
    port = FakeConsentCheckPort()
    port.grant(repo._test_family_id, repo._test_child_id)  # type: ignore[attr-defined]
    return port


@pytest.fixture
def query_handler(repo: FakeGrowthPriorityRepository) -> GrowthPriorityQueryHandler:
    return GrowthPriorityQueryHandler(repo)


@pytest.fixture
def command_handler(
    repo: FakeGrowthPriorityRepository, consent: FakeConsentCheckPort
) -> GrowthPriorityCommandHandler:
    return GrowthPriorityCommandHandler(repo, consent)


class TestGrowthPriorityDraft:
    async def test_get_draft_returns_candidate(self, repo, query_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft = await query_handler.get_draft(GetGrowthPriorityDraftQuery(family_id, ACTOR, onboarding_id))
        assert draft.candidate is not None
        assert draft.candidate.dimension_id == "P03"
        assert draft.draft_id.startswith("draft:")

    async def test_get_draft_without_active_onboarding_is_not_found(self, repo, query_handler):
        from domains.growth_priority.domain.errors import GrowthPriorityNotFoundError

        family_id = repo._test_family_id
        with pytest.raises(GrowthPriorityNotFoundError) as exc:
            await query_handler.get_draft(GetGrowthPriorityDraftQuery(family_id, ACTOR, str(uuid.uuid4())))
        assert exc.value.code == "active_growth_onboarding_not_found"


class TestConfirmGrowthPriority:
    async def test_confirm_creates_active_priority(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"

        receipt = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta())
        )
        assert receipt["action"] == "CONFIRM_GROWTH_PRIORITY"
        assert receipt["replayed"] is False
        assert receipt["priority"]["status"] == "ACTIVE"
        assert receipt["priority"]["dimension_id"] == "P03"
        assert receipt["priority"]["version"] == 1
        assert receipt["boundary"] == "PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS"

    async def test_confirm_is_idempotent_on_replay(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        meta = _meta("idem-replay")

        first = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", meta)
        )
        second = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", meta)
        )
        assert second["replayed"] is True
        assert second["priority"]["priority_id"] == first["priority"]["priority_id"]

    async def test_reconfirm_supersedes_previous_priority_with_version_chain(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        first = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta("c1"))
        )
        first_priority_id = first["priority"]["priority_id"]

        # A new candidate becomes available (bumps the draft freshness token).
        repo.seed_candidate(family_id, onboarding_id, "R03", reason_codes=["NEW_SIGNAL"])
        repo.bump_draft(family_id, onboarding_id)
        new_draft_id = f"draft:{family_id}:{onboarding_id}:1"

        second = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, new_draft_id, "R03", _meta("c2"))
        )
        assert second["priority"]["dimension_id"] == "R03"
        assert second["priority"]["version"] == 2
        assert second["priority"]["previous_priority_id"] == first_priority_id

        stored_first = repo.priorities[first_priority_id]
        assert stored_first.status == GrowthPriorityStatus.SUPERSEDED
        assert stored_first.superseded_at is not None
        stored_second = repo.priorities[second["priority"]["priority_id"]]
        assert stored_second.status == GrowthPriorityStatus.ACTIVE

    async def test_confirm_with_stale_draft_id_is_conflict(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        with pytest.raises(GrowthPriorityConflictError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, "draft:stale:0", "P03", _meta())
            )
        assert exc.value.code == "growth_priority_draft_stale"

    async def test_confirm_with_decision_not_matching_candidate_is_conflict(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityConflictError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "R05", _meta())
            )
        assert exc.value.code == "growth_priority_decision_not_eligible"

    async def test_confirm_with_active_intervention_episode_is_conflict(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        repo.seed_active_intervention_episode(onboarding_id)
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityConflictError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta())
            )
        assert exc.value.code == "active_intervention_episode_exists"

    async def test_confirm_without_normal_safety_route_is_forbidden(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        repo.seed_safety_route(onboarding_id, severity=SafetySeverity.HIGH, disposition=SafetyDisposition.SAFETY_ESCALATION)
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityForbiddenError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta())
            )
        assert exc.value.code == "normal_safety_route_not_verified"

    async def test_confirm_with_abnormal_perspective_after_normal_start_is_forbidden(self, repo, command_handler):
        """Research doc 7.2 step 2: even a normal onboarding-start
        disposition is overridden by any later perspective record showing
        an abnormal safety signal."""
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        repo.seed_safety_route(
            onboarding_id,
            severity=SafetySeverity.LOW,
            disposition=SafetyDisposition.NORMAL,
            perspective_dispositions=[SafetyDisposition.NORMAL, SafetyDisposition.SAFETY_ESCALATION],
        )
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityForbiddenError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta())
            )
        assert exc.value.code == "normal_safety_route_not_verified"

    async def test_confirm_without_required_consent_is_forbidden_fail_closed(
        self, repo, consent, command_handler
    ):
        family_id, onboarding_id, child_id = repo._test_family_id, repo._test_onboarding_id, repo._test_child_id
        consent.revoke(family_id, child_id)
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityForbiddenError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "P03", _meta())
            )
        assert exc.value.code == "growth_consent_required"

    async def test_confirm_without_family_manage_permission_is_forbidden(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        with pytest.raises(GrowthPriorityForbiddenError) as exc:
            await command_handler.confirm(
                ConfirmGrowthPriorityCommand(family_id, "unauthorized-actor", onboarding_id, draft_id, "P03", _meta())
            )
        assert exc.value.code == "actor_has_family_manage_permission"

    async def test_no_priority_yet_decision_produces_no_priority_row(self, repo, command_handler):
        family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
        draft_id = f"draft:{family_id}:{onboarding_id}:0"
        receipt = await command_handler.confirm(
            ConfirmGrowthPriorityCommand(family_id, ACTOR, onboarding_id, draft_id, "NO_PRIORITY_YET", _meta())
        )
        assert receipt["priority"] is None
        assert receipt["decision"] == "NO_PRIORITY_YET"


class TestGrowthPriorityStatusStateMachine:
    """Direct unit tests on the ported status transition table (research
    doc section 3.3): ACTIVE -> SUPERSEDED is the only legal transition;
    SUPERSEDED is terminal.
    """

    def test_active_to_superseded_is_legal(self):
        assert supersede(GrowthPriorityStatus.ACTIVE) == GrowthPriorityStatus.SUPERSEDED

    def test_superseded_to_active_is_illegal(self):
        with pytest.raises(GrowthPriorityConflictError) as exc:
            assert_legal_transition(GrowthPriorityStatus.SUPERSEDED, GrowthPriorityStatus.ACTIVE)
        assert exc.value.code == "growth_priority_status_transition_illegal"

    def test_active_to_active_is_illegal(self):
        with pytest.raises(GrowthPriorityConflictError) as exc:
            assert_legal_transition(GrowthPriorityStatus.ACTIVE, GrowthPriorityStatus.ACTIVE)
        assert exc.value.code == "growth_priority_status_transition_illegal"
