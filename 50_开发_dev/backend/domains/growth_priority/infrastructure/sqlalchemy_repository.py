"""Real repository — asyncpg/SQLAlchemy Core against the EXISTING PostgreSQL
schema owned by NestJS SQL migrations (`database/migrations/0003_growth_foundation.sql`,
`0008_m2_wave2_priority_intervention_action.sql`). Per migration plan section
5, this file does NOT create a new schema — it reads/writes the tables
`growth-priority.service.ts` already owns, mirroring `confirmGrowthPriority`
statement-by-statement (research doc section 3.2). Same convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py` /
`backend/domains/family/infrastructure/sqlalchemy_repository.py`.

STATUS: full real implementation. The version-chain confirm write
(`insert_priority` superseding the previous ACTIVE row) is the one piece of
genuine concurrency-control logic in this domain — see its docstring for the
locking discipline.
"""
from __future__ import annotations

import json
import uuid

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import GrowthPriorityRepositoryPort
from ..domain.entities import GrowthPriority, GrowthPriorityCandidate, GrowthPriorityDraft
from ..domain.errors import (
    GrowthPriorityConflictError,
    GrowthPriorityForbiddenError,
    GrowthPriorityNotFoundError,
)
from ..domain.value_objects import GrowthSubject, SafetyDisposition, SafetySeverity

CANONICAL_ONBOARDING_JOURNEY_TYPE = "PARENT_CHILD_COMMUNICATION_CONFLICT"


def _decode_jsonb(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _map_priority_row(row) -> GrowthPriority:
    return GrowthPriority(
        priority_id=str(row.priority_id),
        family_id=str(row.family_id),
        profile_id=str(row.profile_id),
        dimension_id=row.dimension_id,
        rank=row.rank,
        confirmed_by_actor_id=row.confirmed_by_actor_id,
        confirmed_at=row.confirmed_at,
        onboarding_id=str(row.onboarding_id),
        status=row.status,
        version=row.version,
        boundary=row.boundary,
        reason_codes=list(row.reason_codes or []),
        evidence_refs=[str(ref) for ref in (row.evidence_refs or [])],
        policy_version=row.policy_version,
        superseded_at=row.superseded_at,
        previous_priority_id=str(row.previous_priority_id) if row.previous_priority_id else None,
    )


class SqlAlchemyGrowthPriorityRepository(GrowthPriorityRepositoryPort):
    """One instance per request/transaction — the caller (FastAPI
    dependency) owns opening/committing/rolling back `connection`.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def assert_family_exists(self, family_id: str) -> None:
        result = await self._connection.execute(
            text("select 1 from families where family_id=:family_id for share"),
            {"family_id": family_id},
        )
        if result.first() is None:
            raise GrowthPriorityNotFoundError("family_not_found")

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        # Real tenant isolation (project owner-authorized capability
        # expansion, not a TS-parity port — see Port docstring). Same query
        # shape as SqlAlchemyOutcomeRepository.assert_tenant_family_scope.
        tenancy = await self._connection.execute(
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
        if tenancy.first() is None:
            raise GrowthPriorityForbiddenError("tenant_family_scope_denied")

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
        raise GrowthPriorityForbiddenError("actor_has_family_manage_permission")

    async def assert_active_onboarding(self, family_id: str, onboarding_id: str) -> None:
        result = await self._connection.execute(
            text(
                "select 1 from growth_journeys where journey_id=:onboarding_id and family_id=:family_id "
                "and journey_type=:journey_type and phase='ONBOARDING' and status='ACTIVE'"
            ),
            {"onboarding_id": onboarding_id, "family_id": family_id, "journey_type": CANONICAL_ONBOARDING_JOURNEY_TYPE},
        )
        if result.first() is None:
            raise GrowthPriorityNotFoundError("active_growth_onboarding_not_found")

    async def has_active_intervention_episode(self, onboarding_id: str) -> bool:
        result = await self._connection.execute(
            text("select 1 from intervention_episodes where onboarding_id=:onboarding_id and status='ACTIVE' limit 1"),
            {"onboarding_id": onboarding_id},
        )
        return result.first() is not None

    async def load_safety_route(
        self, onboarding_id: str
    ) -> tuple[SafetySeverity, SafetyDisposition, list[SafetyDisposition | None]]:
        onboarding_event = await self._connection.execute(
            text(
                "select payload from growth_events where journey_id=:onboarding_id "
                "and event_name='GrowthOnboardingStarted' order by created_at desc limit 1"
            ),
            {"onboarding_id": onboarding_id},
        )
        row = onboarding_event.first()
        payload = _decode_jsonb(row.payload) if row else {}
        safety_disposition = (payload or {}).get("safety_disposition", {})
        severity = SafetySeverity(safety_disposition.get("severity", "HIGH"))
        disposition = SafetyDisposition(safety_disposition.get("disposition", "SAFETY_ESCALATION"))

        perspective_rows = await self._connection.execute(
            text("select safety_disposition from perspectives where journey_id=:onboarding_id"),
            {"onboarding_id": onboarding_id},
        )
        perspective_dispositions: list[SafetyDisposition | None] = []
        for prow in perspective_rows:
            pd = _decode_jsonb(prow.safety_disposition) or {}
            disposition_value = pd.get("disposition") if isinstance(pd, dict) else None
            perspective_dispositions.append(SafetyDisposition(disposition_value) if disposition_value else None)

        return severity, disposition, perspective_dispositions

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject:
        # Port of GrowthSubjectResolver.resolve (research doc section 7.1),
        # steps 3-5 only (candidate collection + uniqueness + is_child) —
        # this domain's own confirmGrowthPriority flow does not consume
        # guardian_person_ids, so steps 6-7 (guardian resolution/mismatch)
        # are deliberately NOT implemented here. The return type is the
        # shared `GrowthSubject` shape (unified across
        # growth_priority/intervention/outcome — see domain/value_objects.py),
        # but `guardian_person_ids` is always an empty frozenset from this
        # adapter specifically — do not read it as "this child has no
        # guardians", read it as "this adapter never queried for guardians".
        # Domains that need real guardian resolution (Outcome/Intervention)
        # implement steps 6-7 in their own `resolve_growth_subject`.
        event_row = (
            await self._connection.execute(
                text(
                    "select payload from growth_events where journey_id=:onboarding_id "
                    "and event_name='GrowthOnboardingStarted' order by created_at desc limit 1"
                ),
                {"onboarding_id": onboarding_id},
            )
        ).first()
        candidates: set[str] = set()
        if event_row is not None:
            payload = _decode_jsonb(event_row.payload) or {}
            child_id = payload.get("child_id")
            if child_id:
                candidates.add(str(child_id))

        perspective_rows = await self._connection.execute(
            text(
                "select subject_person_id from perspectives where journey_id=:onboarding_id "
                "and perspective_type='CHILD_PERSPECTIVE'"
            ),
            {"onboarding_id": onboarding_id},
        )
        for prow in perspective_rows:
            candidates.add(str(prow.subject_person_id))

        if len(candidates) == 0:
            raise GrowthPriorityConflictError("growth_subject_unresolved")
        if len(candidates) > 1:
            raise GrowthPriorityConflictError("growth_subject_ambiguous")
        child_id = next(iter(candidates))

        person_row = (
            await self._connection.execute(
                text("select person_type from persons where person_id=:person_id"), {"person_id": child_id}
            )
        ).first()
        if person_row is None or person_row.person_type != "CHILD":
            raise GrowthPriorityConflictError("growth_subject_is_not_child")
        return GrowthSubject(child_person_id=child_id, guardian_person_ids=frozenset())

    async def build_draft(self, family_id: str, onboarding_id: str) -> GrowthPriorityDraft:
        # TODO: Port of `buildGrowthPriorityDraft` (research doc section
        # 3.2 step 5) — recomputes the candidate list from
        # `listConfirmedProfiles`. That NestJS function's own algorithm was
        # out of scope for this batch's fact-finding note (referenced but
        # not deep-dived); left NotImplementedError rather than guessing at
        # semantics not yet confirmed against source.
        raise NotImplementedError(
            "build_draft: buildGrowthPriorityDraft candidate-selection algorithm not yet ported — "
            "see architecture/notes/batch2-domain-research-v1.md section 3.2 step 5"
        )

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> GrowthPriority | None:
        result = await self._connection.execute(
            text(
                "select priority_id,family_id,profile_id,dimension_id,rank,confirmed_by_actor_id,confirmed_at,"
                "onboarding_id,status,version,boundary,reason_codes,evidence_refs,policy_version,superseded_at,"
                "previous_priority_id from growth_priorities "
                "where family_id=:family_id and onboarding_id=:onboarding_id and status='ACTIVE' for update"
            ),
            {"family_id": family_id, "onboarding_id": onboarding_id},
        )
        row = result.first()
        return _map_priority_row(row) if row else None

    async def insert_priority(
        self,
        family_id: str,
        onboarding_id: str,
        profile_id: str,
        candidate: GrowthPriorityCandidate,
        confirmed_by_actor_id: str,
        previous: GrowthPriority | None,
    ) -> GrowthPriority:
        """Port of `supersedeActivePriority` + `insertPriority` (research doc
        section 3.2 step 11). Concurrency control: the caller must already
        hold the row lock on `previous` from `load_active_priority`'s
        `for update` — this method does the supersede UPDATE and the new
        INSERT inside that same held lock, in the same DB transaction, so no
        second confirmer can interleave between "read previous ACTIVE" and
        "write new ACTIVE": their `load_active_priority` blocks until this
        transaction commits/rolls back. The
        `uq_growth_priorities_one_active_primary` partial unique index
        (family_id, onboarding_id) WHERE status='ACTIVE' is the DB-level
        backstop if that discipline is ever violated.
        """
        if previous is not None:
            await self._connection.execute(
                text(
                    "update growth_priorities set status='SUPERSEDED', superseded_at=now() where priority_id=:priority_id"
                ),
                {"priority_id": previous.priority_id},
            )
        version = (previous.version + 1) if previous is not None else 1
        try:
            result = await self._connection.execute(
                text(
                    """
                    insert into growth_priorities(
                        family_id, profile_id, dimension_id, rank, confirmed_by_actor_id, confirmed_at,
                        onboarding_id, status, version, boundary, reason_codes, evidence_refs, policy_version,
                        previous_priority_id
                    ) values (
                        :family_id, :profile_id, :dimension_id, 1, :confirmed_by, now(),
                        :onboarding_id, 'ACTIVE', :version, 'PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS',
                        :reason_codes, :evidence_refs, :policy_version, :previous_priority_id
                    )
                    returning priority_id,family_id,profile_id,dimension_id,rank,confirmed_by_actor_id,confirmed_at,
                              onboarding_id,status,version,boundary,reason_codes,evidence_refs,policy_version,
                              superseded_at,previous_priority_id
                    """
                ),
                {
                    "family_id": family_id,
                    "profile_id": profile_id,
                    "dimension_id": candidate.dimension_id,
                    "confirmed_by": confirmed_by_actor_id,
                    "onboarding_id": onboarding_id,
                    "version": version,
                    "reason_codes": candidate.reason_codes,
                    "evidence_refs": candidate.evidence_refs,
                    "policy_version": "v1",
                    "previous_priority_id": previous.priority_id if previous is not None else None,
                },
            )
        except IntegrityError as exc:
            if "23505" in str(getattr(exc.orig, "sqlstate", "")) or "unique" in str(exc).lower():
                raise GrowthPriorityConflictError("growth_priority_already_active") from exc
            raise
        return _map_priority_row(result.first())

    # --- idempotency / audit ---

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
            raise GrowthPriorityConflictError("idempotency_key_payload_mismatch")
        if row.response_body is None:
            return None
        return _decode_jsonb(row.response_body)

    async def persist_operation(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str, receipt: dict
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
        self, family_id: str, actor_id: str, resource_id: str, action: str, event_name: str, receipt: dict
    ) -> None:
        correlation_id = str(uuid.uuid4())
        await self._connection.execute(
            text(
                """
                insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,result,metadata)
                values (:family_id,'PERSON',:actor_id,:action,'GrowthPriority',:resource_id,:correlation_id,'SUCCESS',cast(:metadata as jsonb))
                """
            ),
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "resource_id": resource_id,
                "correlation_id": correlation_id,
                "metadata": json.dumps(receipt),
            },
        )
        await self._connection.execute(
            text(
                """
                insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
                values ('GrowthPriority',:resource_id,:event_name,1,gen_random_uuid(),:correlation_id,cast(:payload as jsonb),now())
                """
            ),
            {
                "resource_id": resource_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": json.dumps(receipt),
            },
        )
