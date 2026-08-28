"""Unit tests for the GrowthPlan (JourneyPlan) domain command handlers, run
against the in-memory `FakeGrowthPlanRepository` / `FakeGrowthIntentAdapter`.
These exercise the ported behavior of `journey-plan.service.ts`'s
createPlan/pausePlan/reviewCurrentPhase at the application layer, without
HTTP or a real database — per migration plan section 9's "FakeProvider"
requirement, matching the style of
`domains/assessment/tests/test_assessment_flow.py`.
"""
from __future__ import annotations

import uuid

import pytest

from domains.growth_plan.application.commands import (
    CreateJourneyPlanCommand,
    GrowthPlanCommandHandler,
    MutationMeta,
    PauseJourneyPlanCommand,
    ReviewCurrentPhaseCommand,
)
from domains.growth_plan.domain.errors import GrowthPlanConflictError, GrowthPlanNotFoundError
from domains.growth_plan.domain.value_objects import JourneyPhaseStatus
from domains.growth_plan.infrastructure.fake_growth_intent import FakeGrowthIntentAdapter
from domains.growth_plan.infrastructure.fake_repository import FakeGrowthPlanRepository

TENANT_ID = "tenant-1"


def _meta(key: str = "idem-1") -> MutationMeta:
    return MutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


@pytest.fixture
def repo() -> FakeGrowthPlanRepository:
    repository = FakeGrowthPlanRepository()
    family_id = str(uuid.uuid4())
    repository.seed_family(TENANT_ID, family_id)
    repository._test_family_id = family_id  # type: ignore[attr-defined]
    return repository


@pytest.fixture
def growth_intent(repo: FakeGrowthPlanRepository) -> FakeGrowthIntentAdapter:
    adapter = FakeGrowthIntentAdapter()
    family_id = repo._test_family_id  # type: ignore[attr-defined]
    onboarding_id = str(uuid.uuid4())
    adapter.seed_active_priority(family_id, onboarding_id, dimension_id="P03")
    repo._test_onboarding_id = onboarding_id  # type: ignore[attr-defined]
    return adapter


@pytest.fixture
def command_handler(repo: FakeGrowthPlanRepository, growth_intent: FakeGrowthIntentAdapter) -> GrowthPlanCommandHandler:
    return GrowthPlanCommandHandler(repo, growth_intent)


async def _create_plan(repo, command_handler, key: str = "create-1") -> dict:
    family_id, onboarding_id = repo._test_family_id, repo._test_onboarding_id
    return await command_handler.create_plan(
        CreateJourneyPlanCommand(family_id, TENANT_ID, "actor-1", onboarding_id, _meta(key))
    )


class TestCreatePlan:
    async def test_create_plan_success(self, repo, command_handler):
        receipt = await _create_plan(repo, command_handler)
        assert receipt["action"] == "CREATE_JOURNEY_PLAN"
        assert receipt["replayed"] is False
        assert receipt["created"] is True
        assert receipt["plan"]["status"] == "DRAFT"
        assert receipt["plan"]["current_phase"] == "SEE"
        assert receipt["plan"]["total_days"] == 90
        assert len(receipt["plan"]["phases"]) == 4
        assert receipt["boundary"] == "HUMAN_CONFIRMED_PLAN_NOT_OUTCOME"

        # PARENT_FIRST/CO_CREATE dimensions are fixed regardless of priority.
        phases_by_name = {phase["name"]: phase for phase in receipt["plan"]["phases"]}
        assert phases_by_name["SEE"]["focus_dimensions"] == ["P03"]
        assert phases_by_name["PARENT_FIRST"]["focus_dimensions"] == ["P03", "R03"]
        assert phases_by_name["CO_CREATE"]["focus_dimensions"] == ["R04", "R05"]
        assert phases_by_name["STABILIZE"]["focus_dimensions"] == ["P03"]

    async def test_create_plan_is_idempotent_on_replay(self, repo, command_handler):
        first = await _create_plan(repo, command_handler, key="idem-replay")
        second = await _create_plan(repo, command_handler, key="idem-replay")
        assert second["replayed"] is True
        assert second["plan"]["plan_id"] == first["plan"]["plan_id"]

    async def test_create_plan_reuses_existing_draft_plan_not_conflict(self, repo, command_handler):
        """Port of `getCurrentPlanForUpdate` — a second create with a
        different idempotency key still reuses the existing DRAFT plan
        instead of raising a conflict (research note 3.4 step 6).
        """
        first = await _create_plan(repo, command_handler, key="c1")
        second = await _create_plan(repo, command_handler, key="c2")
        assert second["created"] is False
        assert second["plan"]["plan_id"] == first["plan"]["plan_id"]

    async def test_create_plan_without_active_priority_not_found(self, repo, command_handler):
        family_id = repo._test_family_id
        other_onboarding_id = str(uuid.uuid4())
        with pytest.raises(GrowthPlanNotFoundError) as exc:
            await command_handler.create_plan(
                CreateJourneyPlanCommand(family_id, TENANT_ID, "actor-1", other_onboarding_id, _meta("no-priority"))
            )
        assert exc.value.code == "active_growth_priority_not_found"


class TestPausePlan:
    async def test_pause_plan_success(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        # createPlan leaves the plan DRAFT; pausePlan requires ACTIVE, so we
        # advance it to ACTIVE directly (confirmPlan is out of scope for
        # this batch — see application/commands.py module docstring).
        repo.plans[plan_id].status = repo.plans[plan_id].status.ACTIVE

        receipt = await command_handler.pause_plan(
            PauseJourneyPlanCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, _meta("pause-1"))
        )
        assert receipt["action"] == "PAUSE_JOURNEY_PLAN"
        assert receipt["plan"]["status"] == "PAUSED"
        assert receipt["plan"]["paused_at"] is not None
        assert receipt["plan"]["version"] == 2

    async def test_pause_plan_when_not_active_is_conflict(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        # Plan is still DRAFT (never activated).
        with pytest.raises(GrowthPlanConflictError) as exc:
            await command_handler.pause_plan(
                PauseJourneyPlanCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, _meta("pause-bad"))
            )
        assert exc.value.code == "journey_plan_not_active"


class TestReviewCurrentPhase:
    async def _activate_and_make_review_due(self, repo, plan_id: str) -> None:
        plan = repo.plans[plan_id]
        plan.status = plan.status.ACTIVE
        plan.phase_by_name(plan.current_phase).status = JourneyPhaseStatus.REVIEW_DUE

    async def test_review_continue_advances_to_next_phase(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        await self._activate_and_make_review_due(repo, plan_id)

        receipt = await command_handler.review_current_phase(
            ReviewCurrentPhaseCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, "CONTINUE", _meta("review-1"))
        )
        assert receipt["plan"]["status"] == "ACTIVE"
        assert receipt["plan"]["current_phase"] == "PARENT_FIRST"
        assert receipt["plan"]["current_day"] == 15
        phases_by_name = {phase["name"]: phase for phase in receipt["plan"]["phases"]}
        assert phases_by_name["SEE"]["status"] == "COMPLETED"
        assert phases_by_name["PARENT_FIRST"]["status"] == "ACTIVE"

    async def test_review_continue_on_last_phase_completes_plan(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        plan = repo.plans[plan_id]
        plan.status = plan.status.ACTIVE
        plan.current_phase = plan.current_phase.STABILIZE
        plan.phase_by_name(plan.current_phase).status = JourneyPhaseStatus.REVIEW_DUE

        receipt = await command_handler.review_current_phase(
            ReviewCurrentPhaseCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, "CONTINUE", _meta("review-last"))
        )
        assert receipt["plan"]["status"] == "COMPLETED"
        assert receipt["plan"]["current_day"] == 90

    async def test_review_adjust_blocks_phase_and_pauses_plan(self, repo, command_handler):
        """'ADJUST' is the '先调整节奏' branch — any decision other than
        CONTINUE blocks the current phase and pauses the plan (research
        note 3.4 step 4; no whitelist on the decision value itself).
        """
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        await self._activate_and_make_review_due(repo, plan_id)

        receipt = await command_handler.review_current_phase(
            ReviewCurrentPhaseCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, "ADJUST", _meta("review-2"))
        )
        assert receipt["plan"]["status"] == "PAUSED"
        assert receipt["plan"]["current_phase"] == "SEE"
        phases_by_name = {phase["name"]: phase for phase in receipt["plan"]["phases"]}
        assert phases_by_name["SEE"]["status"] == "BLOCKED"

    async def test_review_when_phase_not_review_due_is_conflict(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        repo.plans[plan_id].status = repo.plans[plan_id].status.ACTIVE
        # current phase (SEE) is still PENDING, not REVIEW_DUE.
        with pytest.raises(GrowthPlanConflictError) as exc:
            await command_handler.review_current_phase(
                ReviewCurrentPhaseCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, "CONTINUE", _meta("review-bad"))
            )
        assert exc.value.code == "journey_phase_review_not_due"

    async def test_review_when_plan_not_active_is_conflict(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        # Plan is still DRAFT.
        with pytest.raises(GrowthPlanConflictError) as exc:
            await command_handler.review_current_phase(
                ReviewCurrentPhaseCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, "CONTINUE", _meta("review-draft"))
            )
        assert exc.value.code == "journey_plan_not_active"


class TestIllegalStateTransitions:
    """Explicit 'illegal state transition rejected' coverage requested by the
    task, beyond the per-method conflict tests above.
    """

    async def test_cannot_pause_a_completed_plan(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        repo.plans[plan_id].status = repo.plans[plan_id].status.COMPLETED

        with pytest.raises(GrowthPlanConflictError) as exc:
            await command_handler.pause_plan(
                PauseJourneyPlanCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, _meta("pause-completed"))
            )
        assert exc.value.code == "journey_plan_not_active"

    async def test_cannot_pause_an_already_paused_plan(self, repo, command_handler):
        create_receipt = await _create_plan(repo, command_handler)
        plan_id = create_receipt["plan"]["plan_id"]
        plan = repo.plans[plan_id]
        plan.status = plan.status.ACTIVE
        await command_handler.pause_plan(
            PauseJourneyPlanCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, _meta("pause-once"))
        )
        with pytest.raises(GrowthPlanConflictError) as exc:
            await command_handler.pause_plan(
                PauseJourneyPlanCommand(repo._test_family_id, TENANT_ID, "actor-1", plan_id, _meta("pause-twice"))
            )
        assert exc.value.code == "journey_plan_not_active"
