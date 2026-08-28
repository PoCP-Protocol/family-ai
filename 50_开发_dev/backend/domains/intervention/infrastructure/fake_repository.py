"""In-memory fake repository — the test double the current test suite runs
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors the same invariants the real
repository must hold: idempotency-key replay, family-scope checks, and the
same error codes as `intervention.service.ts` / `growth-action.service.ts`.

Not thread-safe / not process-safe — intentional, this is a unit-test
double, not a substitute for a real Postgres-backed repository (none exists
yet for this domain; only the fake is wired up, same starting point as the
Assessment domain's Batch 1 port before its own SQLAlchemy repository was
added later).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime

from ..domain.entities import GrowthAction, InterventionEpisode
from ..domain.errors import (
    InterventionConflictError,
    InterventionForbiddenError,
    InterventionNotFoundError,
)
from ..domain.value_objects import (
    ACTION_TYPE_LISTEN_BEFORE_RESPOND_DAILY,
    INTERVENTION_CODE,
    INTERVENTION_ID,
    PLANNED_DAYS,
    POLICY_VERSION,
    ExecutionStatus,
    GrowthActionStatus,
    GrowthSubject,
    InterventionEpisodeStatus,
)

DEFAULT_TEST_ACTOR = "actor-1"
FAMILY_MANAGE_ROLES = ("OWNER_GUARDIAN", "GUARDIAN")


@dataclass
class FakeInterventionRepository:
    families: set[str] = field(default_factory=set)
    family_memberships: dict[tuple[str, str], str] = field(default_factory=dict)
    consents: set[tuple[str, str]] = field(default_factory=set)  # (family_id, subject_person_id)
    growth_subjects: dict[tuple[str, str], GrowthSubject] = field(default_factory=dict)  # (family, onboarding) -> GrowthSubject
    safety_blocked: set[tuple[str, str]] = field(default_factory=set)  # (family, onboarding) blocked routes
    priorities: dict[str, dict] = field(default_factory=dict)  # priority_id -> {onboarding_id, dimension_id, status, ...}
    episodes: dict[str, InterventionEpisode] = field(default_factory=dict)  # episode_id -> episode
    actions: dict[str, GrowthAction] = field(default_factory=dict)  # action_id -> action
    journey_plans_active: set[str] = field(default_factory=set)
    operations: dict[tuple[str, str, str], dict] = field(default_factory=dict)  # (family, action, key) -> {request_hash, receipt}
    audit_log: list[dict] = field(default_factory=list)
    outbox: list[dict] = field(default_factory=list)

    # --- seeding helpers ---

    def seed_family(self, family_id: str) -> None:
        self.families.add(family_id)
        self.family_memberships[(family_id, DEFAULT_TEST_ACTOR)] = "OWNER_GUARDIAN"

    def grant_family_manage_permission(self, family_id: str, person_id: str, role: str = "OWNER_GUARDIAN") -> None:
        self.family_memberships[(family_id, person_id)] = role

    def seed_growth_subject(
        self, family_id: str, onboarding_id: str, child_person_id: str, guardian_person_ids: list[str]
    ) -> None:
        self.growth_subjects[(family_id, onboarding_id)] = GrowthSubject(
            child_person_id=child_person_id, guardian_person_ids=frozenset(guardian_person_ids)
        )

    def grant_consent(self, family_id: str, subject_person_id: str) -> None:
        self.consents.add((family_id, subject_person_id))

    def seed_active_priority(
        self, family_id: str, priority_id: str, onboarding_id: str, dimension_id: str = "R03"
    ) -> None:
        self.priorities[priority_id] = {
            "priority_id": priority_id,
            "family_id": family_id,
            "onboarding_id": onboarding_id,
            "dimension_id": dimension_id,
        }

    def block_safety_route(self, family_id: str, onboarding_id: str) -> None:
        self.safety_blocked.add((family_id, onboarding_id))

    def seed_journey_plan(self, journey_plan_id: str) -> None:
        self.journey_plans_active.add(journey_plan_id)

    def seed_journey_plan_action(
        self,
        family_id: str,
        journey_plan_id: str,
        journey_phase: str = "SEE",
        day_index: int = 1,
        action_id: str | None = None,
    ) -> GrowthAction:
        """Seed a single PENDING `growth_actions` row linked to a
        (GrowthPlan-domain) journey plan instead of an intervention
        episode — mirrors the `journey_plan_id`/`journey_phase` pairing
        `createJourneyPlanActions` writes in journey-plan.service.ts
        (research note section 3.4). Used to test that
        `completeGrowthAction` still calls `refresh_journey_plan_execution`
        for actions this domain doesn't own the lifecycle of, matching the
        `updated.journey_plan_id` branch in `application/commands.py`.
        """
        self.journey_plans_active.add(journey_plan_id)
        action = GrowthAction(
            action_id=action_id or str(uuid.uuid4()),
            family_id=family_id,
            action_type="JOURNEY_90_DAY_PRACTICE",
            instruction="90天计划练习",
            status=GrowthActionStatus.PENDING,
            day_index=day_index,
            assignment_text="今天的练习。",
            due_date=date.today(),
            journey_plan_id=journey_plan_id,
            journey_phase=journey_phase,  # type: ignore[arg-type]
        )
        self.actions[action.action_id] = action
        return action

    # --- InterventionRepositoryPort ---

    async def ensure_family_exists(self, family_id: str) -> None:
        if family_id not in self.families:
            raise InterventionNotFoundError("family_not_found")

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None:
        role = self.family_memberships.get((family_id, actor_id))
        if role not in FAMILY_MANAGE_ROLES:
            raise InterventionForbiddenError("family_manage_permission_required")

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject:
        subject = self.growth_subjects.get((family_id, onboarding_id))
        if subject is None:
            raise InterventionNotFoundError("growth_subject_not_resolved")
        return subject

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        if (family_id, subject_person_id) not in self.consents:
            raise InterventionForbiddenError("missing_required_consent:SERVICE,ASSESSMENT,GROWTH_TRACKING")

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None:
        if (family_id, onboarding_id) in self.safety_blocked:
            raise InterventionForbiddenError("safety_escalation_route_required")

    async def load_active_priority_for_start(self, family_id: str, priority_id: str) -> dict | None:
        priority = self.priorities.get(priority_id)
        if priority is None or priority["family_id"] != family_id:
            return None
        return priority

    async def get_active_intervention(self, family_id: str, onboarding_id: str) -> InterventionEpisode | None:
        for episode in self.episodes.values():
            if (
                episode.family_id == family_id
                and episode.onboarding_id == onboarding_id
                and episode.status == InterventionEpisodeStatus.ACTIVE
            ):
                return episode
        return None

    async def load_episode_by_id(self, family_id: str, episode_id: str) -> InterventionEpisode | None:
        episode = self.episodes.get(episode_id)
        if episode is None or episode.family_id != family_id:
            return None
        return episode

    async def load_priority_dimension(self, family_id: str, priority_id: str) -> str | None:
        priority = self.priorities.get(priority_id)
        if priority is None or priority["family_id"] != family_id:
            return None
        return priority["dimension_id"]

    async def list_growth_actions_for_episode(self, intervention_episode_id: str) -> list[GrowthAction]:
        matches = [
            action
            for action in self.actions.values()
            if action.intervention_episode_id == intervention_episode_id
        ]
        matches.sort(key=lambda action: action.day_index)
        return matches

    async def assert_no_active_intervention_episode(self, family_id: str, onboarding_id: str) -> None:
        active = await self.get_active_intervention(family_id, onboarding_id)
        if active is not None:
            raise InterventionConflictError("active_intervention_episode_exists")

    async def insert_intervention_episode(
        self, family_id: str, onboarding_id: str, priority_id: str, started_by_actor_id: str, started_at
    ) -> InterventionEpisode:
        episode = InterventionEpisode(
            episode_id=str(uuid.uuid4()),
            family_id=family_id,
            onboarding_id=onboarding_id,
            priority_id=priority_id,
            intervention_id=INTERVENTION_ID,
            intervention_code=INTERVENTION_CODE,
            status=InterventionEpisodeStatus.ACTIVE,
            started_by_actor_id=started_by_actor_id,
            started_at=started_at,
            planned_days=PLANNED_DAYS,
            policy_version=POLICY_VERSION,
        )
        self.episodes[episode.episode_id] = episode
        return episode

    async def insert_growth_actions_for_episode(
        self, family_id: str, episode: InterventionEpisode, assignments: list[dict]
    ) -> list[GrowthAction]:
        created = []
        for assignment in assignments:
            action = GrowthAction(
                action_id=str(uuid.uuid4()),
                family_id=family_id,
                intervention_id=episode.intervention_id,
                action_type=ACTION_TYPE_LISTEN_BEFORE_RESPOND_DAILY,
                instruction=assignment["assignment_text"],
                status=GrowthActionStatus.PENDING,
                onboarding_id=episode.onboarding_id,
                priority_id=episode.priority_id,
                intervention_episode_id=episode.episode_id,
                day_index=assignment["day_index"],
                assignment_text=assignment["assignment_text"],
                due_date=assignment["due_date"],
                execution_status=ExecutionStatus.NOT_STARTED,
            )
            self.actions[action.action_id] = action
            created.append(action)
        return created

    async def get_today_action(self, family_id: str, actor_id: str, today: date) -> GrowthAction | None:
        candidates = await self.list_today_actions(family_id, actor_id, today, limit=1)
        return candidates[0] if candidates else None

    async def list_today_actions(self, family_id: str, actor_id: str, today: date, limit: int = 3) -> list[GrowthAction]:
        matches = [
            action
            for action in self.actions.values()
            if action.family_id == family_id and action.due_date == today and action.status == GrowthActionStatus.PENDING
        ]
        matches.sort(key=lambda action: action.day_index)
        return matches[:limit]

    async def list_completed_journey_actions(self, family_id: str, limit: int = 12) -> list[GrowthAction]:
        matches = [
            action
            for action in self.actions.values()
            if action.family_id == family_id
            and action.journey_plan_id is not None
            and action.status
            in (GrowthActionStatus.COMPLETED, GrowthActionStatus.PARTIAL, GrowthActionStatus.NOT_COMPLETED)
        ]
        matches.sort(key=lambda action: action.day_index)
        return matches[:limit]

    async def load_action(self, family_id: str, action_id: str) -> GrowthAction | None:
        action = self.actions.get(action_id)
        if action is None or action.family_id != family_id:
            return None
        return action

    async def load_completable_action_for_update(self, family_id: str, action_id: str) -> GrowthAction:
        action = await self.load_action(family_id, action_id)
        if action is None:
            raise InterventionNotFoundError("growth_action_not_found")

        owning_active = True
        if action.intervention_episode_id is not None:
            episode = self.episodes.get(action.intervention_episode_id)
            owning_active = episode is not None and episode.status == InterventionEpisodeStatus.ACTIVE
        elif action.journey_plan_id is not None:
            owning_active = action.journey_plan_id in self.journey_plans_active

        if not owning_active:
            raise InterventionNotFoundError("growth_action_not_found")

        if action.status != GrowthActionStatus.PENDING:
            raise InterventionConflictError("growth_action_already_checked_in")

        return action

    async def update_growth_action_completion(
        self, action_id: str, completion_status: str, reflection: str | None
    ) -> GrowthAction:
        action = self.actions[action_id]
        updated = action.model_copy(
            update={
                "status": GrowthActionStatus(completion_status),
                "completion_status": completion_status,
                "execution_status": ExecutionStatus(completion_status),
                "reflection": reflection,
                "reflection_boundary": "REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME" if reflection else action.reflection_boundary,
                "row_version": action.row_version + 1,
            }
        )
        self.actions[action_id] = updated
        return updated

    async def update_growth_action_execution_status(
        self, action_id: str, execution_status: ExecutionStatus, timestamp: datetime
    ) -> GrowthAction:
        action = self.actions[action_id]
        updates: dict = {"execution_status": execution_status, "row_version": action.row_version + 1}
        if execution_status == ExecutionStatus.IN_PROGRESS and action.started_at is None:
            updates["started_at"] = timestamp
        if execution_status == ExecutionStatus.PAUSED:
            updates["paused_at"] = timestamp
        if execution_status == ExecutionStatus.CANCELLED:
            updates["cancelled_at"] = timestamp
        updated = action.model_copy(update=updates)
        self.actions[action_id] = updated
        return updated

    async def refresh_journey_plan_execution(self, journey_plan_id: str) -> None:
        # Out of scope for this domain port — `family_journey_plans` lives
        # in the GrowthPlan domain. The fake records the call for
        # assertions but performs no state change, matching the fact that
        # this method is a cross-domain side effect the research note flags
        # as living in journey-plan.service.ts, not intervention/growth-action.
        self.outbox.append({"event": "JourneyPlanExecutionRefreshRequested", "journey_plan_id": journey_plan_id})

    async def lock_operation(self, family_id: str, action: str, idempotency_key: str) -> None:
        return None

    async def load_operation_replay(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        stored = self.operations.get((family_id, action, idempotency_key))
        if stored is None:
            return None
        if stored["request_hash"] != request_hash:
            raise InterventionConflictError("idempotency_key_reused_with_different_payload")
        return stored["receipt"]

    async def persist_operation(
        self,
        family_id: str,
        actor_id: str,
        action: str,
        request_hash: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
    ) -> None:
        self.operations[(family_id, action, idempotency_key)] = {"request_hash": request_hash, "receipt": receipt}

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
    ) -> None:
        self.audit_log.append({"family_id": family_id, "actor_id": actor_id, "action": action})
        self.outbox.append({"event": event_name, "family_id": family_id, "receipt": receipt})
