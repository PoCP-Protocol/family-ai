"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Domain code never imports SQLAlchemy/FastAPI directly;
it depends on these Protocols instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.entities import JourneyPlan


class GrowthPlanRepositoryPort(Protocol):
    """Mirrors the query/mutation surface `journey-plan.service.ts` needs
    from its repository, scoped to this batch's methods: createPlan,
    pausePlan, reviewCurrentPhase (per
    `architecture/notes/batch2-domain-research-v1.md` section 3.4).
    confirmPlan / getActiveProjection are out of scope and not represented
    here.
    """

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None: ...

    async def get_current_plan_for_family_onboarding(
        self, family_id: str, onboarding_id: str
    ) -> JourneyPlan | None:
        """Port of `getCurrentPlanForUpdate` (createPlan step 6) — returns
        an existing DRAFT/ACTIVE/PAUSED plan for this onboarding, if any.
        """
        ...

    async def insert_plan_with_phases(
        self,
        family_id: str,
        onboarding_id: str,
        priority_id: str,
        priority_dimension: str,
        actor_id: str,
    ) -> JourneyPlan: ...

    async def load_plan_for_update(self, family_id: str, plan_id: str) -> JourneyPlan: ...

    async def pause_plan(self, plan_id: str) -> JourneyPlan: ...

    async def apply_review_decision(self, plan_id: str, decision: str) -> JourneyPlan: ...

    async def write_audit_and_outbox(
        self,
        family_id: str,
        actor_id: str,
        plan_id: str,
        action: str,
        event_name: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
        source: str,
    ) -> None: ...

    # --- idempotency, ported from lockOperation/loadOperationReplay/persistOperation ---

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None: ...

    async def load_operation_replay(
        self, tenant_id: str, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None: ...

    async def persist_operation(
        self,
        tenant_id: str,
        family_id: str,
        plan_id: str,
        actor_id: str,
        action: str,
        request_hash: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
    ) -> None: ...


class GrowthIntentPort(Protocol):
    """Boundary to the GrowthIntent concept this domain depends on but does
    not own. Per the task ("GrowthIntent依赖：定义本域内Port接口+Fake实现，
    不阻塞等待") and the research note section 3.1, the real GrowthIntent
    lifecycle in the Growth domain's main chain is actually
    `growth_priorities` (confirmed by `confirmGrowthPriority`), which is
    what `assertActiveOnboardingAndPriority` reads. This port is deliberately
    narrow: it only exposes what `createPlan` needs (an ACTIVE priority tied
    to an active onboarding), so this domain is not blocked waiting on the
    GrowthIntent/GrowthPriority domain's own Python port to land.
    """

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> tuple[str, str] | None:
        """Returns (priority_id, dimension_id) if an ACTIVE priority exists
        for an ACTIVE ONBOARDING-phase onboarding journey, else None.
        """
        ...
