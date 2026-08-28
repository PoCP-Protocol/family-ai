"""Real repository skeleton — asyncpg/SQLAlchemy Core against the EXISTING
PostgreSQL schema owned by NestJS SQL migrations
(`database/migrations/0009_*.sql`, `outcome_observations` /
`growth_reviews` / `next_step_decisions`). Per migration plan section 5,
this file does NOT create a new schema — it will read/write the tables
`growth-review.service.ts` already owns (research doc section 5.5/5.6). Same
convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py`.

STATUS: FRAMEWORK ONLY, not a full port. `assert_tenant_family_scope`,
`load_person_type`, and the idempotency/audit methods are real (same
verified pattern as the Family/GrowthPriority real repositories in this same
commit). The Outcome-specific writes (`insert_outcome_observation`,
`insert_growth_review`, `insert_next_step_decision`), the 5-way Timeline
union projection (`load_timeline`), and the shared cross-domain gates
(`assert_required_growth_consents`, `assert_normal_safety_route`,
`resolve_growth_subject`) are left as `NotImplementedError` with a TODO.
`InterventionEpisodeReadPort` (the read-only dependency on the
Intervention/Action domain's tables) is similarly stubbed — this domain must
not reach into Intervention's repository directly per the migration plan's
"no domain imports another domain's repository directly" rule, so a real
implementation here should compose with
`domains.intervention.infrastructure.sqlalchemy_repository` at the wiring
layer, not duplicate its queries.
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import InterventionEpisodeReadPort, OutcomeRepositoryPort
from ..domain.entities import (
    EpisodeActionStatus,
    GrowthReview,
    InterventionEpisodeContext,
    NextStepDecision,
    OutcomeObservation,
    TimelineEntry,
)
from ..domain.errors import OutcomeConflictError, OutcomeForbiddenError
from ..domain.value_objects import GrowthSubject


def _decode_jsonb(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


class SqlAlchemyInterventionEpisodeReader(InterventionEpisodeReadPort):
    """Read-only cross-domain reader against Intervention's own tables
    (`intervention_episodes` / `growth_actions`) — Outcome never writes
    through this. See module docstring for why this is a separate class
    (composition, not a duplicate of Intervention's repository).
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def load_episode(self, family_id: str, intervention_episode_id: str) -> InterventionEpisodeContext | None:
        # TODO: port of getEpisode (research doc section 5.5 step 2) — join
        # intervention_episodes + growth_priorities for dimension_id.
        raise NotImplementedError(
            "load_episode: not yet ported — see architecture/notes/batch2-domain-research-v1.md section 5.5 step 2"
        )

    async def list_episode_action_statuses(self, intervention_episode_id: str) -> list[EpisodeActionStatus]:
        # TODO: port of listEpisodeActionStatuses (research doc section 5.5 step 4).
        raise NotImplementedError(
            "list_episode_action_statuses: not yet ported — see architecture/notes/batch2-domain-research-v1.md section 5.5 step 4"
        )


class SqlAlchemyOutcomeRepository(OutcomeRepositoryPort):
    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    # --- shared cross-domain gates ---

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
            raise OutcomeForbiddenError("tenant_family_scope_denied")

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        # TODO: wire to the real Consent domain's ConsentQueryPort
        # (backend/domains/consent) once cross-domain composition exists.
        raise NotImplementedError("assert_required_growth_consents: not yet wired to the real Consent domain")

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None:
        # TODO: port of assertNormalSafetyRoute — same query shape as
        # SqlAlchemyGrowthPriorityRepository.load_safety_route in this same
        # commit; can likely be lifted almost verbatim, note the growth-review
        # service's version is one of the 6 duplicated copies (research doc
        # section 0).
        raise NotImplementedError("assert_normal_safety_route: not yet ported — see research doc section 7.2")

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject:
        # TODO: full port of GrowthSubjectResolver.resolve including
        # guardian resolution (research doc section 7.1 steps 6-7) — Outcome
        # needs the guardian set (unlike GrowthPriority's narrower need) to
        # validate PARENT_OBSERVATION authorship in
        # recordOutcomeObservation.
        raise NotImplementedError(
            "resolve_growth_subject: guardian-resolution steps of GrowthSubjectResolver not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 7.1"
        )

    async def load_person_type(self, person_id: str) -> str | None:
        result = await self._connection.execute(
            text("select person_type from persons where person_id=:person_id"), {"person_id": person_id}
        )
        row = result.first()
        return row.person_type if row else None

    # --- idempotency / audit / outbox: real ---

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
            raise OutcomeConflictError("idempotency_key_payload_mismatch")
        if row.response_body is None:
            return None
        return _decode_jsonb(row.response_body)

    async def persist_operation(
        self,
        tenant_id: str,
        family_id: str,
        resource_id: str,
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
        resource_id: str,
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
                values (:family_id,'PERSON',:actor_id,:action,'Outcome',:resource_id,:correlation_id,:idempotency_key,'SUCCESS',cast(:metadata as jsonb))
                """
            ),
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "resource_id": resource_id,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
                "metadata": json.dumps({"source": source, **receipt}),
            },
        )
        await self._connection.execute(
            text(
                """
                insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
                values ('Outcome',:resource_id,:event_name,1,gen_random_uuid(),:correlation_id,cast(:payload as jsonb),now())
                """
            ),
            {
                "resource_id": resource_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": json.dumps(receipt),
            },
        )

    # --- OutcomeObservation ---

    async def insert_outcome_observation(self, observation: OutcomeObservation) -> None:
        # TODO: port of insertOutcomeObservation (research doc section 5.5
        # step 6) — boundary/length CHECK constraints are DB-enforced; this
        # just needs the INSERT statement against outcome_observations
        # (migration 0009 field list, research doc section 5.6).
        raise NotImplementedError("insert_outcome_observation: not yet ported — see research doc section 5.6")

    async def list_observations_for_episode(self, intervention_episode_id: str) -> list[OutcomeObservation]:
        raise NotImplementedError("list_observations_for_episode: not yet ported")

    # --- GrowthReview ---

    async def load_review_by_episode(self, intervention_episode_id: str) -> GrowthReview | None:
        raise NotImplementedError("load_review_by_episode: not yet ported — see research doc section 5.5 step 3 (assertReviewNotCompleted)")

    async def insert_growth_review(self, review: GrowthReview) -> None:
        raise NotImplementedError("insert_growth_review: not yet ported — see research doc section 5.5 step 8")

    # --- NextStepDecision ---

    async def load_review(self, family_id: str, review_id: str) -> GrowthReview | None:
        raise NotImplementedError("load_review: not yet ported")

    async def load_decision_by_review(self, review_id: str) -> NextStepDecision | None:
        raise NotImplementedError("load_decision_by_review: not yet ported — see research doc section 5.5 recordNextStepDecision step 3")

    async def insert_next_step_decision(self, decision: NextStepDecision) -> None:
        raise NotImplementedError("insert_next_step_decision: not yet ported — see research doc section 5.5 recordNextStepDecision step 4")

    # --- Timeline ---

    async def load_timeline(self, family_id: str, onboarding_id: str) -> list[TimelineEntry]:
        # TODO: port of getTimeline's 5-way union (research doc section
        # 5.5) — INTERVENTION_STARTED / GROWTH_ACTION_COMPLETED /
        # OUTCOME_OBSERVATION_RECORDED / GROWTH_REVIEW_COMPLETED /
        # NEXT_STEP_DECISION_RECORDED, ordered by occurred_at+event_type.
        raise NotImplementedError("load_timeline: 5-way union projection not yet ported — see research doc section 5.5")
