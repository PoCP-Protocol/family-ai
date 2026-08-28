"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Domain code never imports SQLAlchemy/FastAPI directly;
it depends on this Protocol instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.

Every method here corresponds 1:1 to a query/mutation block in
`intervention.service.ts` / `growth-action.service.ts` — see
`architecture/notes/batch2-domain-research-v1.md` sections 4 and 5.
"""
from __future__ import annotations

from datetime import date
from typing import Protocol

from ..domain.entities import GrowthAction, InterventionEpisode
from ..domain.value_objects import ExecutionAction, GrowthSubject


class InterventionRepositoryPort(Protocol):
    """Mirrors the query/mutation surface used by `InterventionService`
    and `GrowthActionService`. Repository transaction boundaries are the
    caller's responsibility, mirroring `this.repository.withTransaction(...)`
    in the NestJS version.
    """

    # --- shared preconditions, ported from the 6-file duplicated
    # assertRequiredGrowthConsents / assertFamilyManagePermission /
    # assertNormalSafetyRoute / GrowthSubjectResolver.resolve ---

    async def ensure_family_exists(self, family_id: str) -> None: ...

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None: ...

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject: ...
    """Port of `GrowthSubjectResolver.resolve`. Previously returned a bare
    dict with `guardian_person_ids` as a `list[str]` -- unified to the shared
    `GrowthSubject` shape (`guardian_person_ids: frozenset[str]`) across
    growth_priority/intervention/outcome."""

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None: ...

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None: ...

    # --- Intervention ---

    async def load_active_priority_for_start(self, family_id: str, priority_id: str) -> dict | None: ...
    """Port of `getActivePriorityForStart` — returns
    {"priority_id", "onboarding_id", "dimension_id"} or None. Caller checks
    dimension_id == SUPPORTED_PRIORITY_DIMENSION (R03)."""

    async def get_active_intervention(self, family_id: str, onboarding_id: str) -> InterventionEpisode | None: ...

    async def assert_no_active_intervention_episode(self, family_id: str, onboarding_id: str) -> None: ...

    async def insert_intervention_episode(
        self,
        family_id: str,
        onboarding_id: str,
        priority_id: str,
        started_by_actor_id: str,
        started_at,
    ) -> InterventionEpisode: ...

    async def insert_growth_actions_for_episode(
        self, family_id: str, episode: InterventionEpisode, assignments: list[dict]
    ) -> list[GrowthAction]: ...

    # --- Action ---

    async def get_today_action(self, family_id: str, actor_id: str, today: date) -> GrowthAction | None: ...

    async def list_today_actions(self, family_id: str, actor_id: str, today: date, limit: int = 3) -> list[GrowthAction]: ...

    async def list_completed_journey_actions(self, family_id: str, limit: int = 12) -> list[GrowthAction]: ...

    async def load_action(self, family_id: str, action_id: str) -> GrowthAction | None: ...

    async def load_completable_action_for_update(self, family_id: str, action_id: str) -> GrowthAction: ...
    """Port of `getCompletableGrowthAction` — row-locks the action, joins
    `intervention_episodes`/`family_journey_plans` to require the owning
    episode/plan is ACTIVE. Raises `InterventionNotFoundError`
    (growth_action_not_found) or `InterventionConflictError`
    (growth_action_already_checked_in) as appropriate — same as the source."""

    async def update_growth_action_completion(
        self, action_id: str, completion_status: str, reflection: str | None
    ) -> GrowthAction: ...

    async def update_growth_action_execution_status(
        self, action_id: str, execution_status, timestamp
    ) -> GrowthAction: ...

    async def refresh_journey_plan_execution(self, journey_plan_id: str) -> None: ...

    # --- idempotency / audit / outbox ---

    async def lock_operation(self, family_id: str, action: str, idempotency_key: str) -> None: ...

    async def load_operation_replay(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None: ...

    async def persist_operation(
        self,
        family_id: str,
        actor_id: str,
        action: str,
        request_hash: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
    ) -> None: ...

    async def write_audit_and_outbox(
        self,
        family_id: str,
        actor_id: str,
        action: str,
        event_name: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
        source: str,
    ) -> None: ...
