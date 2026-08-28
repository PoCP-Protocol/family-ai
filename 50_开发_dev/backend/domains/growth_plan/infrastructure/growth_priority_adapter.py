"""Real `GrowthIntentPort` adapter — wires `growth_plan.createPlan`'s
GrowthIntent dependency to the real `growth_priority` domain instead of the
in-memory `FakeGrowthIntentAdapter` stub.

Background (see `architecture/notes/batch2-domain-research-v1.md` section
3.4 `createPlan` step 2, and section 3.1): `journey-plan.service.ts`'s
`createPlan` calls `assertActiveOnboardingAndPriority`, which is a join
against the `growth_priorities` table (owned by `growth-priority.service.ts`,
`confirmGrowthPriority`) requiring status=ACTIVE — *not* a query against the
unrelated `growth_intents` table. `GrowthPriorityPort.load_active_priority`
therefore delegates to `growth_priority`'s own repository
(`GrowthPriorityRepositoryPort.load_active_priority` /
`assert_active_onboarding`), so `createPlan` is now really blocked by an
absent/unconfirmed GrowthPriority — not silently satisfied by a Fake that
always says yes once seeded.

`growth_priority` itself still only has an in-memory repository
(`FakeGrowthPriorityRepository`) at this point in the migration — there is no
production Postgres-backed repository for either domain yet. "Real" here
means: the real `growth_priority` business rules (ACTIVE/SUPERSEDED
lifecycle, active-onboarding gate) are now the source of truth for
`growth_plan.createPlan`, instead of a domain-unaware dict stub that has no
concept of "confirmed" at all.
"""
from __future__ import annotations

from dataclasses import dataclass

from ...growth_priority.application.ports import GrowthPriorityRepositoryPort
from ...growth_priority.domain.errors import GrowthPriorityNotFoundError


@dataclass
class GrowthPriorityAdapter:
    """Adapts a `GrowthPriorityRepositoryPort` implementation (currently
    `FakeGrowthPriorityRepository`; swap for the real Postgres repository
    once it lands, with no change needed here) to `growth_plan`'s
    `GrowthIntentPort` Protocol.
    """

    growth_priority_repository: GrowthPriorityRepositoryPort

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> tuple[str, str] | None:
        # Port of `assertActiveOnboardingAndPriority` (research note 3.4
        # createPlan step 2): the onboarding must be ACTIVE/ONBOARDING *and*
        # have an ACTIVE growth_priorities row, else 404
        # `active_growth_priority_not_found`. We deliberately swallow the
        # onboarding-not-active case into "no active priority" (same 404
        # code the real NestJS join produces for either failure mode), and
        # let any other error propagate.
        try:
            await self.growth_priority_repository.assert_active_onboarding(family_id, onboarding_id)
        except GrowthPriorityNotFoundError:
            return None

        priority = await self.growth_priority_repository.load_active_priority(family_id, onboarding_id)
        if priority is None:
            return None
        return priority.priority_id, priority.dimension_id
