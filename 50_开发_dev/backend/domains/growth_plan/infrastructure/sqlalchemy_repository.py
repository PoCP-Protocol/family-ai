"""Real repository skeleton — asyncpg/SQLAlchemy Core against the EXISTING
PostgreSQL schema owned by NestJS SQL migrations
(`database/migrations/0003_growth_foundation.sql`,
`0008_m2_wave2_priority_intervention_action.sql`, `family_journey_plans` /
`family_journey_plan_phases`). Per migration plan section 5, this file does
NOT create a new schema — it will read/write the tables
`journey-plan.service.ts` already owns, mirroring `createPlan`/`pausePlan`/
`reviewCurrentPhase` (research doc section 3.4). Same convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py`.

STATUS: FRAMEWORK ONLY, not a full port. `assert_tenant_family_scope`,
`lock_operation`, `load_operation_replay`, `persist_operation`, and
`write_audit_and_outbox` are real (they follow the exact same pattern
already verified working in the Family/GrowthPriority real repositories in
this same commit). Every method touching `family_journey_plans` /
`family_journey_plan_phases` — the 4-phase state machine, the 90-day action
batch-insert, `pause_plan`, `apply_review_decision` — is left as
`NotImplementedError` with a TODO pointing at the exact research-doc section
that documents the semantics still to be ported. Do not wire this into a
FastAPI route until those TODOs are closed.
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import GrowthPlanRepositoryPort
from ..domain.entities import JourneyPlan
from ..domain.errors import GrowthPlanConflictError, GrowthPlanForbiddenError


def _decode_jsonb(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


class SqlAlchemyGrowthPlanRepository(GrowthPlanRepositoryPort):
    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        result = await self._connection.execute(
            text(
                """
                select 1 from tenant_family_bindings
                where tenant_id=:tenant_id and family_id=:family_id and status='ACTIVE'
                  and effective_from<=now() and (effective_to is null or effective_to>now())
                limit 1
                """
            ),
            {"tenant_id": tenant_id, "family_id": family_id},
        )
        if result.first() is None:
            raise GrowthPlanForbiddenError("tenant_family_scope_denied")

    async def get_current_plan_for_family_onboarding(self, family_id: str, onboarding_id: str) -> JourneyPlan | None:
        # TODO: port of `getCurrentPlanForUpdate` (research doc section 3.4
        # createPlan step 6) — select from family_journey_plans where
        # family_id/onboarding_id match and status in
        # (DRAFT,ACTIVE,PAUSED), joined with family_journey_plan_phases for
        # the `phases` list on the JourneyPlan entity. Needs the table's
        # confirmed schema verified against a real migration before writing
        # (0008 only shows FK additions, not the full CREATE TABLE for
        # family_journey_plans/family_journey_plan_phases in the excerpt
        # reviewed for this task).
        raise NotImplementedError(
            "get_current_plan_for_family_onboarding: family_journey_plans schema not yet confirmed — "
            "see architecture/notes/batch2-domain-research-v1.md section 3.4"
        )

    async def insert_plan_with_phases(
        self, family_id: str, onboarding_id: str, priority_id: str, priority_dimension: str, actor_id: str
    ) -> JourneyPlan:
        # TODO: port of the createPlan insert (research doc section 3.4
        # step 7) — insert family_journey_plans row (status=DRAFT,
        # current_phase=SEE, current_day=1, total_days=90) then
        # insertPhases() 4 rows with PHASE_DEFINITIONS-derived
        # start_day/review_due_day and per-phase focus_dimensions rules
        # (SEE/STABILIZE use priority_dimension; PARENT_FIRST fixed
        # [P03,R03]; CO_CREATE fixed [R04,R05]).
        raise NotImplementedError(
            "insert_plan_with_phases: 90-day plan + 4-phase batch insert not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 3.4"
        )

    async def load_plan_for_update(self, family_id: str, plan_id: str) -> JourneyPlan:
        raise NotImplementedError(
            "load_plan_for_update: row-lock read of family_journey_plans/phases not yet ported"
        )

    async def pause_plan(self, plan_id: str) -> JourneyPlan:
        # TODO: port of pausePlan (research doc section 3.4) — requires
        # status=ACTIVE else 409 journey_plan_not_active, else set
        # status=PAUSED, paused_at=now(), version+=1.
        raise NotImplementedError("pause_plan: not yet ported — see research doc section 3.4 pausePlan")

    async def apply_review_decision(self, plan_id: str, decision: str) -> JourneyPlan:
        # TODO: port of reviewCurrentPhase (research doc section 3.4) —
        # CONTINUE advances phase/day or completes plan at STABILIZE;
        # any other decision value sets phase=BLOCKED, plan=PAUSED.
        raise NotImplementedError("apply_review_decision: not yet ported — see research doc section 3.4 reviewCurrentPhase")

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
    ) -> None:
        await self._connection.execute(
            text(
                """
                insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
                values (:family_id,'PERSON',:actor_id,:action,'JourneyPlan',:plan_id,:correlation_id,:idempotency_key,'SUCCESS',cast(:metadata as jsonb))
                """
            ),
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "plan_id": plan_id,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
                "metadata": json.dumps({"source": source}),
            },
        )
        await self._connection.execute(
            text(
                """
                insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
                values ('JourneyPlan',:plan_id,:event_name,1,gen_random_uuid(),:correlation_id,cast(:payload as jsonb),now())
                """
            ),
            {
                "plan_id": plan_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": json.dumps(receipt),
            },
        )

    # --- idempotency: real, same pattern as Family/GrowthPriority repos ---

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None:
        await self._connection.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:lock_key,0))"),
            {"lock_key": f"{tenant_id}:{family_id}:{action}:{idempotency_key}"},
        )

    async def load_operation_replay(
        self, tenant_id: str, family_id: str, action: str, idempotency_key: str, request_hash: str
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
            raise GrowthPlanConflictError("idempotency_key_payload_mismatch")
        if row.response_body is None:
            return None
        return _decode_jsonb(row.response_body)

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
