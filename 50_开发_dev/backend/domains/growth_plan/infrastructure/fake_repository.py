"""In-memory fake repository — the test double the current test suite runs
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors the same invariants the real
repository must hold: idempotency-key replay, advisory-lock semantics
(approximated with a plain dict), tenant/family scope checks, and the same
error codes — matching the style of
`domains/assessment/infrastructure/fake_repository.py`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from ..domain.entities import JourneyPlan, JourneyPlanPhase
from ..domain.errors import GrowthPlanForbiddenError, GrowthPlanNotFoundError
from ..domain.permission_policy import FAMILY_MANAGE_ROLES
from ..domain.policies import build_initial_phase_specs, resolve_review_outcome
from ..domain.value_objects import JourneyPhaseName, JourneyPhaseStatus, JourneyPlanStatus, TOTAL_PLAN_DAYS

DEFAULT_TEST_ACTOR = "actor-1"


@dataclass
class FakeGrowthPlanRepository:
    """Not thread-safe / not process-safe — intentional, this is a unit-test
    double, not a substitute for a real Postgres-backed repository.
    """

    tenant_family_bindings: set[tuple[str, str]] = field(default_factory=set)
    create_family_audit: set[tuple[str, str]] = field(default_factory=set)
    family_memberships: dict[tuple[str, str], str] = field(default_factory=dict)
    plans: dict[str, JourneyPlan] = field(default_factory=dict)
    operations: dict[tuple[str, str, str, str], dict] = field(default_factory=dict)
    audit_log: list[dict] = field(default_factory=list)
    outbox: list[dict] = field(default_factory=list)

    def seed_family(self, tenant_id: str, family_id: str) -> None:
        self.tenant_family_bindings.add((tenant_id, family_id))
        self.grant_family_manage_permission(family_id, DEFAULT_TEST_ACTOR, role="OWNER_GUARDIAN")

    def grant_family_manage_permission(self, family_id: str, person_id: str, role: str = "OWNER_GUARDIAN") -> None:
        self.family_memberships[(family_id, person_id)] = role

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        if (tenant_id, family_id) not in self.tenant_family_bindings:
            raise GrowthPlanForbiddenError("tenant_family_scope_denied")
        if (family_id, actor_id) in self.create_family_audit:
            return
        if self.family_memberships.get((family_id, actor_id)) in FAMILY_MANAGE_ROLES:
            return
        raise GrowthPlanForbiddenError("actor_has_family_manage_permission")

    async def get_current_plan_for_family_onboarding(self, family_id: str, onboarding_id: str) -> JourneyPlan | None:
        candidates = [
            plan
            for plan in self.plans.values()
            if plan.family_id == family_id
            and plan.onboarding_id == onboarding_id
            and plan.status in (JourneyPlanStatus.DRAFT, JourneyPlanStatus.ACTIVE, JourneyPlanStatus.PAUSED)
        ]
        return candidates[0] if candidates else None

    async def insert_plan_with_phases(
        self, family_id: str, onboarding_id: str, priority_id: str, priority_dimension: str, actor_id: str
    ) -> JourneyPlan:
        plan_id = str(uuid.uuid4())
        specs = build_initial_phase_specs(priority_dimension)
        phases = [
            JourneyPlanPhase(
                phase_id=str(uuid.uuid4()),
                plan_id=plan_id,
                name=spec["name"],
                start_day=spec["start_day"],
                review_due_day=spec["review_due_day"],
                status=spec["status"],
                focus_dimensions=spec["focus_dimensions"],
            )
            for spec in specs
        ]
        plan = JourneyPlan(
            plan_id=plan_id,
            family_id=family_id,
            onboarding_id=onboarding_id,
            priority_id=priority_id,
            status=JourneyPlanStatus.DRAFT,
            current_phase=JourneyPhaseName.SEE,
            current_day=1,
            total_days=TOTAL_PLAN_DAYS,
            version=1,
            created_at=datetime.now(UTC),
            phases=phases,
        )
        self.plans[plan_id] = plan
        return plan

    async def load_plan_for_update(self, family_id: str, plan_id: str) -> JourneyPlan:
        plan = self.plans.get(plan_id)
        if plan is None or plan.family_id != family_id:
            raise GrowthPlanNotFoundError("journey_plan_not_found")
        return plan

    async def pause_plan(self, plan_id: str) -> JourneyPlan:
        plan = self.plans[plan_id]
        plan.status = JourneyPlanStatus.PAUSED
        plan.paused_at = datetime.now(UTC)
        plan.version += 1
        return plan

    async def apply_review_decision(self, plan_id: str, decision: str) -> JourneyPlan:
        plan = self.plans[plan_id]
        outcome = resolve_review_outcome(plan.current_phase, decision)
        current_phase = plan.phase_by_name(plan.current_phase)
        current_phase.status = outcome["current_phase_becomes"]

        if outcome["plan_pauses"]:
            plan.status = JourneyPlanStatus.PAUSED
        else:
            next_phase = plan.next_phase_after(plan.current_phase)
            if next_phase is not None:
                next_phase.status = JourneyPhaseStatus.ACTIVE
                plan.current_phase = next_phase.name
                plan.current_day = next_phase.start_day
            else:
                plan.status = JourneyPlanStatus.COMPLETED
                plan.current_day = TOTAL_PLAN_DAYS

        plan.version += 1
        return plan

    async def write_audit_and_outbox(
        self, family_id, actor_id, plan_id, action, event_name, receipt, correlation_id, idempotency_key, source
    ) -> None:
        self.audit_log.append(
            {"family_id": family_id, "actor_id": actor_id, "action": action, "resource_id": plan_id, "correlation_id": correlation_id}
        )
        self.outbox.append(
            {"aggregate_id": plan_id, "event_name": event_name, "correlation_id": correlation_id, "payload": receipt}
        )

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None:
        return None  # advisory-lock semantics only meaningful against real Postgres

    async def load_operation_replay(self, tenant_id, family_id, action, idempotency_key, request_hash) -> dict | None:
        key = (tenant_id, family_id, action, idempotency_key)
        record = self.operations.get(key)
        if record is None:
            return None
        return record["response_body"]

    async def persist_operation(
        self, tenant_id, family_id, plan_id, actor_id, action, request_hash, receipt, correlation_id, idempotency_key
    ) -> None:
        self.operations[(tenant_id, family_id, action, idempotency_key)] = {
            "request_hash": request_hash,
            "response_body": receipt,
        }

    async def set_current_phase_status_for_test(self, plan_id: str, status: JourneyPhaseStatus) -> None:
        """Test-only helper — advances the current phase to REVIEW_DUE (or
        any other status) without going through `completeGrowthAction` /
        `refreshJourneyPlanExecution`, which are out of scope for this
        batch. Mirrors how the Assessment fake exposes `seed_*` helpers for
        states the command handlers under test don't themselves produce.
        """
        plan = self.plans[plan_id]
        plan.phase_by_name(plan.current_phase).status = status
