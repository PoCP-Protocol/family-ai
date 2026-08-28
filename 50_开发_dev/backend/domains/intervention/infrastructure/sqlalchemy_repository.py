"""Real repository skeleton — asyncpg/SQLAlchemy Core against the EXISTING
PostgreSQL schema owned by NestJS SQL migrations
(`database/migrations/0008_m2_wave2_priority_intervention_action.sql`,
`intervention_episodes` / `growth_actions`). Per migration plan section 5,
this file does NOT create a new schema — it will read/write the tables
`intervention.service.ts` / `growth-action.service.ts` already own (research
doc sections 4 and 5). Same convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py`.

STATUS: FRAMEWORK ONLY, not a full port. `ensure_family_exists`,
`assert_family_manage_permission`, `assert_no_active_intervention_episode`,
and the idempotency/audit methods are real (same verified pattern as the
Family/GrowthPriority real repositories in this same commit). Everything
touching the row-locked `growth_actions` completion state machine
(`load_completable_action_for_update`, `update_growth_action_completion`,
`update_growth_action_execution_status`), the 7-action batch insert
(`insert_growth_actions_for_episode`), and the cross-domain
`refresh_journey_plan_execution` call into GrowthPlan is left as
`NotImplementedError` with a TODO — those are exactly the "幂等锁/悲观锁"
concurrency-control pieces the task calls out as core, and they deserve a
dedicated pass with the full `growth_actions` migration DDL in hand (0003/
0008/0020/0035/0036/0042 cumulative — only 0008's ALTER fragment was
reviewed for this task) rather than a guess.
"""
from __future__ import annotations

import json
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import InterventionRepositoryPort
from ..domain.entities import GrowthAction, InterventionEpisode
from ..domain.errors import InterventionConflictError, InterventionForbiddenError, InterventionNotFoundError
from ..domain.value_objects import GrowthSubject


def _decode_jsonb(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


class SqlAlchemyInterventionRepository(InterventionRepositoryPort):
    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    # --- shared preconditions: real ---

    async def ensure_family_exists(self, family_id: str) -> None:
        result = await self._connection.execute(
            text("select 1 from families where family_id=:family_id for share"),
            {"family_id": family_id},
        )
        if result.first() is None:
            raise InterventionNotFoundError("family_not_found")

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None:
        audit = await self._connection.execute(
            text(
                "select 1 from audit_logs where family_id=:family_id and actor_id=:actor_id "
                "and action_name='CreateFamily' and result='SUCCESS' limit 1"
            ),
            {"family_id": family_id, "actor_id": actor_id},
        )
        if audit.first() is not None:
            return
        membership = await self._connection.execute(
            text(
                "select 1 from family_memberships where family_id=:family_id and person_id::text=:actor_id "
                "and status='ACTIVE' and role in ('OWNER_GUARDIAN','GUARDIAN') limit 1"
            ),
            {"family_id": family_id, "actor_id": actor_id},
        )
        if membership.first() is not None:
            return
        raise InterventionForbiddenError("actor_has_family_manage_permission")

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject:
        # TODO: full port of GrowthSubjectResolver.resolve (research doc
        # section 7.1) including guardian resolution (steps 6-7) — the
        # GrowthPriority domain's real repository only needed steps 3-5 (no
        # guardian set); Intervention's `GrowthSubject.guardian_person_ids`
        # field requires the guardian-side family_relationships query still
        # to be added here. Return type unified to the shared `GrowthSubject`
        # shape ahead of that -- this remains NotImplementedError until the
        # guardian query itself is ported (changing the return type now,
        # separately from filling in the query logic, per the narrow scope
        # of this signature-unification pass).
        raise NotImplementedError(
            "resolve_growth_subject: guardian-resolution steps of GrowthSubjectResolver not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 7.1"
        )

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        # TODO: wire to the real Consent domain's ConsentQueryPort
        # (backend/domains/consent) once cross-domain composition exists —
        # this domain's port intentionally declares its own narrow seam
        # (see application/ports.py) rather than importing Consent's
        # repository directly.
        raise NotImplementedError("assert_required_growth_consents: not yet wired to the real Consent domain")

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None:
        # TODO: port of assertNormalSafetyRoute (research doc section 7.2) —
        # same query shape as SqlAlchemyGrowthPriorityRepository.load_safety_route
        # in this same commit; can likely be lifted almost verbatim.
        raise NotImplementedError("assert_normal_safety_route: not yet ported — see research doc section 7.2")

    # --- Intervention ---

    async def load_active_priority_for_start(self, family_id: str, priority_id: str) -> dict | None:
        raise NotImplementedError("load_active_priority_for_start: not yet ported — see research doc section 4.2 step 2")

    async def get_active_intervention(self, family_id: str, onboarding_id: str) -> InterventionEpisode | None:
        raise NotImplementedError("get_active_intervention: not yet ported")

    async def assert_no_active_intervention_episode(self, family_id: str, onboarding_id: str) -> None:
        result = await self._connection.execute(
            text(
                "select 1 from intervention_episodes where family_id=:family_id and onboarding_id=:onboarding_id "
                "and status='ACTIVE' limit 1"
            ),
            {"family_id": family_id, "onboarding_id": onboarding_id},
        )
        if result.first() is not None:
            raise InterventionConflictError("active_intervention_episode_exists")

    async def insert_intervention_episode(
        self, family_id: str, onboarding_id: str, priority_id: str, started_by_actor_id: str, started_at
    ) -> InterventionEpisode:
        raise NotImplementedError(
            "insert_intervention_episode: not yet ported — see research doc section 4.2 step 6"
        )

    async def insert_growth_actions_for_episode(
        self, family_id: str, episode: InterventionEpisode, assignments: list[dict]
    ) -> list[GrowthAction]:
        raise NotImplementedError(
            "insert_growth_actions_for_episode: 7-day batch insert not yet ported — see research doc section 4.2 steps 7-8"
        )

    # --- Action ---

    async def get_today_action(self, family_id: str, actor_id: str, today: date) -> GrowthAction | None:
        raise NotImplementedError("get_today_action: not yet ported")

    async def list_today_actions(self, family_id: str, actor_id: str, today: date, limit: int = 3) -> list[GrowthAction]:
        raise NotImplementedError("list_today_actions: not yet ported")

    async def list_completed_journey_actions(self, family_id: str, limit: int = 12) -> list[GrowthAction]:
        raise NotImplementedError("list_completed_journey_actions: not yet ported")

    async def load_action(self, family_id: str, action_id: str) -> GrowthAction | None:
        raise NotImplementedError("load_action: not yet ported")

    async def load_completable_action_for_update(self, family_id: str, action_id: str) -> GrowthAction:
        # TODO (core concurrency-control piece): port of
        # `getCompletableGrowthAction` — must `select ... for update` the
        # growth_actions row, join intervention_episodes/family_journey_plans
        # to require ACTIVE, raise InterventionNotFoundError
        # (growth_action_not_found) or InterventionConflictError
        # (growth_action_already_checked_in) per research doc section 5.3
        # step 3. This is the row-lock that makes completeGrowthAction's
        # PENDING->terminal transition atomic.
        raise NotImplementedError(
            "load_completable_action_for_update: row-locked completion guard not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 5.3 step 3"
        )

    async def update_growth_action_completion(
        self, action_id: str, completion_status: str, reflection: str | None
    ) -> GrowthAction:
        raise NotImplementedError("update_growth_action_completion: not yet ported — see research doc section 5.3 step 6")

    async def update_growth_action_execution_status(self, action_id: str, execution_status, timestamp) -> GrowthAction:
        # TODO (core concurrency-control piece): port of
        # assertExecutionTransition's 5-state transition table (research doc
        # section 5.2) — needs its own row lock + transition-table lookup
        # raising InterventionConflictError(task_transition_not_allowed) on
        # an invalid edge.
        raise NotImplementedError(
            "update_growth_action_execution_status: execution_status transition table not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 5.2"
        )

    async def refresh_journey_plan_execution(self, journey_plan_id: str) -> None:
        raise NotImplementedError("refresh_journey_plan_execution: cross-domain call into GrowthPlan not yet wired")

    # --- idempotency / audit / outbox: real ---

    async def lock_operation(self, family_id: str, action: str, idempotency_key: str) -> None:
        await self._connection.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:lock_key,0))"),
            {"lock_key": f"{family_id}:{action}:{idempotency_key}"},
        )

    async def load_operation_replay(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        result = await self._connection.execute(
            text(
                "select request_hash,response_body from idempotency_keys where idempotency_key=:key "
                "and action_name=:action for update"
            ),
            {"key": idempotency_key, "action": action},
        )
        row = result.first()
        if row is None:
            return None
        if row.request_hash != request_hash:
            raise InterventionConflictError("idempotency_key_payload_mismatch")
        if row.response_body is None:
            return None
        return _decode_jsonb(row.response_body)

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
        await self._connection.execute(
            text(
                """
                insert into idempotency_keys(idempotency_key,action_name,request_hash,response_body)
                values (:key,:action,:request_hash,cast(:receipt as jsonb))
                on conflict (idempotency_key) do update
                  set response_body=excluded.response_body, request_hash=excluded.request_hash
                """
            ),
            {"key": idempotency_key, "action": action, "request_hash": request_hash, "receipt": json.dumps(receipt)},
        )

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
        await self._connection.execute(
            text(
                """
                insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
                values (:family_id,'PERSON',:actor_id,:action,'Intervention',:family_id,:correlation_id,:idempotency_key,'SUCCESS',cast(:metadata as jsonb))
                """
            ),
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
                "metadata": json.dumps({"source": source, **receipt}),
            },
        )
        await self._connection.execute(
            text(
                """
                insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
                values ('Intervention',:family_id,:event_name,1,gen_random_uuid(),:correlation_id,cast(:payload as jsonb),now())
                """
            ),
            {
                "family_id": family_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": json.dumps(receipt),
            },
        )
