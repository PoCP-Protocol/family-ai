"""Real `FamilyContextPort` — asyncpg/SQLAlchemy Core against the EXISTING
`perspectives` / `evidence_records` tables owned by NestJS SQL migrations
(`database/migrations/0003_growth_foundation.sql`,
`0006_perspective_evidence_contract_alignment.sql`), plus the family-scoped
indexes added in `0046_family_context_recent_index.sql`.

This is deliberately NOT a new schema: both tables already carry `family_id`
directly (not only reachable via `onboarding_id`), so the P0 "recent
context for this family" read is a straight query + client-side merge +
LIMIT over rows that already exist, no data migration needed. See
`architecture/notes/family-context-p0-design.md` for the full rationale and
what is explicitly out of scope (embeddings/pgvector/summarization).
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import FamilyContextPort
from ..domain.entities import ContextEntry


def _decode_jsonb(raw):
    """Same asyncpg jsonb decoding quirk documented in
    `domains/assessment/infrastructure/sqlalchemy_repository.py`: jsonb
    scalar strings round-trip as bare (unquoted) text via asyncpg, which is
    not valid JSON on its own — try strict decode first, fall back to the
    raw value.
    """
    if not isinstance(raw, str):
        return raw if raw is not None else {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


class SqlAlchemyFamilyContextRepository(FamilyContextPort):
    """Reads the most recent `limit` rows across `perspectives` and
    `evidence_records` for one family, newest first, regardless of which
    onboarding/session produced them — the cross-session read this domain
    exists to provide. Unlike
    `AssessmentRepositoryPort.load_recent_sessions` (scoped to one
    tenant+family's assessment sessions table), this reads two tables and
    merges them client-side rather than a DB-side UNION, because
    `perspectives.recorded_at` and `evidence_records.observed_at` are
    different columns with different nullability (`observed_at` is
    nullable — falls back to `created_at`) and mapping both into one
    `ContextEntry` shape is easier to keep correct in Python than in a
    hand-written UNION's column list.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def get_recent_context(self, family_id: str, limit: int = 20) -> list[ContextEntry]:
        perspective_rows = await self._connection.execute(
            text(
                """
                select perspective_id, family_id, perspective_type, statement, content,
                       fact_boundary, recorded_at
                from perspectives
                where family_id = :family_id
                order by recorded_at desc
                limit :limit
                """
            ),
            {"family_id": family_id, "limit": limit},
        )
        evidence_rows = await self._connection.execute(
            text(
                """
                select evidence_id, family_id, evidence_type, source_ref, payload,
                       coalesce(observed_at, created_at) as effective_at
                from evidence_records
                where family_id = :family_id
                order by coalesce(observed_at, created_at) desc
                limit :limit
                """
            ),
            {"family_id": family_id, "limit": limit},
        )

        entries: list[ContextEntry] = []
        for row in perspective_rows:
            content = _decode_jsonb(row.content)
            entries.append(
                ContextEntry(
                    entry_id=str(row.perspective_id),
                    family_id=str(row.family_id),
                    source="perspective",
                    recorded_at=row.recorded_at,
                    summary=row.statement,
                    fact_boundary=row.fact_boundary,
                    raw={
                        "perspective_type": row.perspective_type,
                        "content": content,
                    },
                )
            )
        for row in evidence_rows:
            payload = _decode_jsonb(row.payload)
            entries.append(
                ContextEntry(
                    entry_id=str(row.evidence_id),
                    family_id=str(row.family_id),
                    source="evidence",
                    recorded_at=row.effective_at,
                    summary=f"{row.evidence_type}:{row.source_ref or ''}",
                    fact_boundary=None,
                    raw={
                        "evidence_type": row.evidence_type,
                        "source_ref": row.source_ref,
                        "payload": payload,
                    },
                )
            )

        entries.sort(key=lambda entry: entry.recorded_at, reverse=True)
        return entries[:limit]
