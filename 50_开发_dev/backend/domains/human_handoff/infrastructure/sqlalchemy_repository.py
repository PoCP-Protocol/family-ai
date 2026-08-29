"""Real repository — asyncpg/SQLAlchemy Core against the EXISTING PostgreSQL
schema owned by NestJS SQL migrations (the `principal_human_handoffs` and
`principal_responses` tables created by the Principal module's migrations).
Per the migration plan, this file does NOT create a new schema — it
reads/writes the tables `principal.repository.ts` already owns, mirroring
`saveHandoff`/`resolveHandoff`/`loadHandoff`/`loadResponse`/
`markHandoffReleased` statement-by-statement. Same convention as
`backend/domains/growth_priority/infrastructure/sqlalchemy_repository.py`.

STATUS: full real implementation. The idempotent release UPDATE
(`mark_released`, `... and released_at is null`) is the one piece of genuine
concurrency-safe logic in this domain — its rowCount is the authoritative
"did THIS call release it" signal, so a second/concurrent caller cannot
double-release.
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import HumanHandoffRepositoryPort
from ..domain.entities import HumanHandoff
from ..domain.errors import HumanHandoffForbiddenError
from ..domain.value_objects import HandoffReason, HandoffResolution, HandoffStatus


def _decode_jsonb(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _map_handoff_row(row) -> HumanHandoff:
    return HumanHandoff(
        handoff_id=str(row.handoff_id),
        family_id=str(row.family_id),
        # tenant_id is not a column on the NestJS handoff row; it is supplied by
        # the caller from request context. The load path re-attaches it below.
        tenant_id="",
        reason=HandoffReason(row.trigger_reason),
        status=HandoffStatus(row.status),
        response_id=str(row.response_id) if row.response_id else None,
        resolution=HandoffResolution(row.resolution) if row.resolution else None,
        note=row.resolution_note,
        resolved_by_actor_id=str(row.resolved_by_actor_id) if row.resolved_by_actor_id else None,
        released_at=row.released_at,
        created_at=row.created_at,
    )


class SqlAlchemyHumanHandoffRepository(HumanHandoffRepositoryPort):
    """One instance per request/transaction — the caller (FastAPI dependency)
    owns opening/committing/rolling back `connection`.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        # Real tenant isolation (project owner-authorized capability expansion,
        # not a TS-parity port — see Port docstring). Same query shape as the
        # Batch 2/3 domains' assert_tenant_family_scope tenancy half.
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
            raise HumanHandoffForbiddenError("tenant_family_scope_denied")

    async def open_handoff(
        self,
        tenant_id: str,
        family_id: str,
        reason: HandoffReason,
        risk_route: str,
        session_id: str | None,
        subject_ref: str | None,
        assigned_role: str | None,
        response_id: str | None,
    ) -> HumanHandoff:
        # Port of `saveHandoff` — status defaults to OPEN (not in insert list).
        result = await self._connection.execute(
            text(
                """
                insert into principal_human_handoffs(
                    session_id, family_id, subject_ref, risk_route, trigger_reason, assigned_role, response_id)
                values (:session_id, :family_id, :subject_ref, :risk_route, :trigger_reason, :assigned_role, :response_id)
                returning handoff_id, family_id, trigger_reason, status, response_id,
                          resolution, resolution_note, resolved_by_actor_id, released_at, created_at
                """
            ),
            {
                "session_id": session_id,
                "family_id": family_id,
                "subject_ref": subject_ref,
                "risk_route": risk_route,
                "trigger_reason": reason.value,
                "assigned_role": assigned_role,
                "response_id": response_id,
            },
        )
        row = result.first()
        handoff = _map_handoff_row(row)
        return handoff.model_copy(update={"tenant_id": tenant_id})

    async def load_by_id(self, handoff_id: str, family_id: str) -> HumanHandoff | None:
        # Port of `loadHandoff` — family-scoped.
        result = await self._connection.execute(
            text(
                """
                select handoff_id, family_id, trigger_reason, status, response_id,
                       resolution, resolution_note, resolved_by_actor_id, released_at, created_at
                  from principal_human_handoffs
                 where handoff_id=:handoff_id and family_id=:family_id
                """
            ),
            {"handoff_id": handoff_id, "family_id": family_id},
        )
        row = result.first()
        return _map_handoff_row(row) if row is not None else None

    async def resolve_handoff(
        self, handoff_id: str, family_id: str, actor_id: str, resolution: HandoffResolution, note: str | None
    ) -> bool:
        # Port of `resolveHandoff` — atomic OPEN->RESOLVED guard. rowcount is
        # the `ok` boolean.
        result = await self._connection.execute(
            text(
                """
                update principal_human_handoffs
                   set status='RESOLVED', resolution=:resolution, resolution_note=:note,
                       resolved_by_actor_id=:actor_id, resolved_at=now()
                 where handoff_id=:handoff_id and family_id=:family_id and status='OPEN'
                """
            ),
            {
                "handoff_id": handoff_id,
                "family_id": family_id,
                "resolution": resolution.value,
                "note": note,
                "actor_id": actor_id,
            },
        )
        return (result.rowcount or 0) > 0

    async def mark_released(self, handoff_id: str, family_id: str, response_id: str) -> bool:
        # Port of `markHandoffReleased` — atomic, idempotent release stamp.
        # `released_at is null` makes a repeat/concurrent call a no-op.
        result = await self._connection.execute(
            text(
                """
                update principal_human_handoffs
                   set released_at=now()
                 where handoff_id=:handoff_id and family_id=:family_id and response_id=:response_id
                   and resolution='APPROVED' and released_at is null
                """
            ),
            {"handoff_id": handoff_id, "family_id": family_id, "response_id": response_id},
        )
        return (result.rowcount or 0) > 0

    async def load_response_output(self, response_id: str, family_id: str) -> object | None:
        # Port of `loadResponse` — returns the withheld response output payload.
        result = await self._connection.execute(
            text(
                "select output from principal_responses where response_id=:response_id and family_id=:family_id"
            ),
            {"response_id": response_id, "family_id": family_id},
        )
        row = result.first()
        if row is None:
            return None
        return _decode_jsonb(row.output)
