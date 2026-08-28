"""Integration test: `growth_plan.createPlan` wired to the real
`growth_priority` domain's command/repository stack via
`GrowthPriorityAdapter`, instead of the domain-unaware
`FakeGrowthIntentAdapter` stub.

Purpose (per task): prove the real interconnection is in effect — i.e. that
without an actually-confirmed `GrowthPriority` (via
`GrowthPriorityCommandHandler.confirm`, the real business logic: safety-route
gate, consent gate, draft-freshness, ACTIVE/SUPERSEDED version chain),
`createPlan` is genuinely rejected. The old `FakeGrowthIntentAdapter` would
happily fabricate an "active priority" via `seed_active_priority()`, which
proves nothing about the real GrowthPriority lifecycle actually gating
GrowthPlan creation.
"""
from __future__ import annotations

import uuid

import pytest

from domains.growth_plan.application.commands import (
    CreateJourneyPlanCommand,
    GrowthPlanCommandHandler,
    MutationMeta,
)
from domains.growth_plan.domain.errors import GrowthPlanNotFoundError
from domains.growth_plan.infrastructure.fake_repository import FakeGrowthPlanRepository
from domains.growth_plan.infrastructure.growth_priority_adapter import GrowthPriorityAdapter
from domains.growth_priority.application.commands import (
    ConfirmGrowthPriorityCommand,
    GrowthPriorityCommandHandler,
    MutationMeta as PriorityMutationMeta,
)
from domains.growth_priority.infrastructure.fake_repository import FakeGrowthPriorityRepository

TENANT_ID = "tenant-1"
ACTOR_ID = "actor-1"


class _AllowAllConsent:
    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        return None


def _plan_meta(key: str) -> MutationMeta:
    return MutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


def _priority_meta(key: str) -> PriorityMutationMeta:
    return PriorityMutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


@pytest.fixture
def priority_repo() -> FakeGrowthPriorityRepository:
    return FakeGrowthPriorityRepository()


@pytest.fixture
def priority_handler(priority_repo: FakeGrowthPriorityRepository) -> GrowthPriorityCommandHandler:
    return GrowthPriorityCommandHandler(priority_repo, _AllowAllConsent())


@pytest.fixture
def plan_repo() -> FakeGrowthPlanRepository:
    return FakeGrowthPlanRepository()


@pytest.fixture
def family_and_onboarding(priority_repo: FakeGrowthPriorityRepository, plan_repo: FakeGrowthPlanRepository):
    family_id = str(uuid.uuid4())
    onboarding_id = str(uuid.uuid4())

    priority_repo.seed_family(family_id)
    priority_repo.seed_active_onboarding(family_id, onboarding_id)
    priority_repo.seed_resolved_subject(family_id, onboarding_id, subject_person_id="child-1")

    plan_repo.seed_family(TENANT_ID, family_id)

    return family_id, onboarding_id


@pytest.fixture
def command_handler(plan_repo: FakeGrowthPlanRepository, priority_repo: FakeGrowthPriorityRepository) -> GrowthPlanCommandHandler:
    adapter = GrowthPriorityAdapter(growth_priority_repository=priority_repo)
    return GrowthPlanCommandHandler(plan_repo, adapter)


class TestGrowthPriorityAdapterIntegration:
    async def test_create_plan_rejected_without_any_confirmed_priority(
        self, command_handler, family_and_onboarding
    ):
        """No `confirmGrowthPriority` ever ran — the real growth_priority
        repository genuinely has no ACTIVE row. Must be rejected, not
        fabricated by a Fake.
        """
        family_id, onboarding_id = family_and_onboarding
        with pytest.raises(GrowthPlanNotFoundError) as exc:
            await command_handler.create_plan(
                CreateJourneyPlanCommand(family_id, TENANT_ID, ACTOR_ID, onboarding_id, _plan_meta("no-priority"))
            )
        assert exc.value.code == "active_growth_priority_not_found"

    async def test_create_plan_rejected_when_priority_only_drafted_not_confirmed(
        self, command_handler, priority_repo, family_and_onboarding
    ):
        """A draft candidate exists (recomputed by `build_draft`) but was
        never confirmed via `GrowthPriorityCommandHandler.confirm` — still no
        ACTIVE `growth_priorities` row, so `createPlan` must still reject.
        """
        family_id, onboarding_id = family_and_onboarding
        priority_repo.seed_candidate(family_id, onboarding_id, dimension_id="P03")

        with pytest.raises(GrowthPlanNotFoundError) as exc:
            await command_handler.create_plan(
                CreateJourneyPlanCommand(family_id, TENANT_ID, ACTOR_ID, onboarding_id, _plan_meta("drafted-not-confirmed"))
            )
        assert exc.value.code == "active_growth_priority_not_found"

    async def test_create_plan_succeeds_after_real_confirm_growth_priority(
        self, command_handler, priority_handler, priority_repo, family_and_onboarding
    ):
        """Run the real `GrowthPriorityCommandHandler.confirm` end-to-end
        (draft -> confirm), then prove `createPlan` picks up the resulting
        ACTIVE row through the adapter — same dimension_id, no Fake seeding
        involved.
        """
        family_id, onboarding_id = family_and_onboarding
        priority_repo.seed_candidate(family_id, onboarding_id, dimension_id="R03", reason_codes=["evidence-1"])
        draft = await priority_repo.build_draft(family_id, onboarding_id)

        confirm_receipt = await priority_handler.confirm(
            ConfirmGrowthPriorityCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id=ACTOR_ID,
                onboarding_id=onboarding_id,
                draft_id=draft.draft_id,
                decision="R03",
                meta=_priority_meta("confirm-1"),
            )
        )
        assert confirm_receipt["priority"]["status"] == "ACTIVE"

        receipt = await command_handler.create_plan(
            CreateJourneyPlanCommand(family_id, TENANT_ID, ACTOR_ID, onboarding_id, _plan_meta("after-confirm"))
        )
        assert receipt["created"] is True
        phases_by_name = {phase["name"]: phase for phase in receipt["plan"]["phases"]}
        assert phases_by_name["SEE"]["focus_dimensions"] == ["R03"]

    async def test_create_plan_rejected_when_growth_priority_safety_route_blocks_confirmation(
        self, command_handler, priority_handler, priority_repo, family_and_onboarding
    ):
        """A parent tries to confirm a GrowthPriority while the safety route
        is escalated — the real `growth_priority` domain's safety gate fails
        closed on the confirm itself, so no ACTIVE row is ever created, and
        `createPlan` downstream correctly still sees "no active priority".
        """
        from domains.growth_priority.domain.errors import GrowthPriorityForbiddenError
        from domains.growth_priority.domain.value_objects import SafetyDisposition, SafetySeverity

        family_id, onboarding_id = family_and_onboarding
        priority_repo.seed_candidate(family_id, onboarding_id, dimension_id="P03")
        priority_repo.seed_safety_route(
            onboarding_id, severity=SafetySeverity.HIGH, disposition=SafetyDisposition.SAFETY_ESCALATION
        )
        draft = await priority_repo.build_draft(family_id, onboarding_id)

        with pytest.raises(GrowthPriorityForbiddenError):
            await priority_handler.confirm(
                ConfirmGrowthPriorityCommand(
                    family_id=family_id,
                    tenant_id=TENANT_ID,
                    actor_id=ACTOR_ID,
                    onboarding_id=onboarding_id,
                    draft_id=draft.draft_id,
                    decision="P03",
                    meta=_priority_meta("confirm-blocked"),
                )
            )

        with pytest.raises(GrowthPlanNotFoundError) as exc:
            await command_handler.create_plan(
                CreateJourneyPlanCommand(family_id, TENANT_ID, ACTOR_ID, onboarding_id, _plan_meta("after-blocked-confirm"))
            )
        assert exc.value.code == "active_growth_priority_not_found"
