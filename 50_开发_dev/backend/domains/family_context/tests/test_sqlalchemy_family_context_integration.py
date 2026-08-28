"""Integration test for `SqlAlchemyFamilyContextRepository` against a REAL
PostgreSQL instance -- verifies the P0 read actually merges rows from the
EXISTING `perspectives` and `evidence_records` tables
(`database/migrations/0003_growth_foundation.sql`,
`0006_perspective_evidence_contract_alignment.sql`,
`0046_family_context_recent_index.sql`), not just that the in-memory fake
behaves correctly (already covered in `test_fake_family_context.py`).

Requires `PY_ASSESSMENT_TEST_DATABASE_URL` env var pointing at a disposable
PostgreSQL database with the schema from `database/migrations/0001..0046`
applied -- same convention as
`domains/assessment/tests/test_sqlalchemy_repository_integration.py`.
Skipped entirely if that env var is not set.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.family_context.infrastructure.sqlalchemy_family_context import SqlAlchemyFamilyContextRepository

DATABASE_URL = os.environ.get("PY_ASSESSMENT_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_ASSESSMENT_TEST_DATABASE_URL not set -- skipping real-Postgres integration tests"
)


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()  # every test rolls back -- no data persists across tests
    await engine.dispose()


async def _seed_family(conn) -> str:
    family_id = str(uuid.uuid4())
    await conn.execute(
        text("insert into families(family_id, display_name, status) values (:id, 'Test Family', 'ACTIVE')"),
        {"id": family_id},
    )
    return family_id


class TestSqlAlchemyFamilyContextRealPostgres:
    async def test_merges_perspectives_and_evidence_newest_first(self, connection):
        family_id = await _seed_family(connection)
        await connection.execute(
            text(
                "insert into perspectives(family_id, perspective_type, statement, recorded_at) "
                "values (:family_id, 'PARENT_REFLECTION', 'child shared more about school', now() - interval '2 days')"
            ),
            {"family_id": family_id},
        )
        await connection.execute(
            text(
                "insert into evidence_records(family_id, evidence_type, source_ref, payload, observed_at) "
                "values (:family_id, 'ASSESSMENT_RESPONSE_SET', 'sess-1', '{}'::jsonb, now() - interval '1 day')"
            ),
            {"family_id": family_id},
        )

        repo = SqlAlchemyFamilyContextRepository(connection)
        result = await repo.get_recent_context(family_id)

        assert len(result) == 2
        assert result[0].source == "evidence"  # most recent (1 day ago)
        assert result[1].source == "perspective"  # older (2 days ago)
        assert result[1].fact_boundary == "PERSPECTIVE_NOT_FACT"
        assert result[0].fact_boundary is None

    async def test_scoped_to_requested_family_only(self, connection):
        family_id = await _seed_family(connection)
        other_family_id = await _seed_family(connection)
        await connection.execute(
            text(
                "insert into perspectives(family_id, perspective_type, statement, recorded_at) "
                "values (:family_id, 'PARENT_REFLECTION', 'mine', now())"
            ),
            {"family_id": family_id},
        )
        await connection.execute(
            text(
                "insert into perspectives(family_id, perspective_type, statement, recorded_at) "
                "values (:family_id, 'PARENT_REFLECTION', 'not mine', now())"
            ),
            {"family_id": other_family_id},
        )

        repo = SqlAlchemyFamilyContextRepository(connection)
        result = await repo.get_recent_context(family_id)

        assert len(result) == 1
        assert result[0].summary == "mine"

    async def test_respects_limit_across_both_tables(self, connection):
        family_id = await _seed_family(connection)
        for i in range(5):
            await connection.execute(
                text(
                    "insert into perspectives(family_id, perspective_type, statement, recorded_at) "
                    "values (:family_id, 'PARENT_REFLECTION', :statement, now() - (:i || ' hours')::interval)"
                ),
                {"family_id": family_id, "statement": f"p{i}", "i": i},
            )

        repo = SqlAlchemyFamilyContextRepository(connection)
        result = await repo.get_recent_context(family_id, limit=3)

        assert len(result) == 3
        assert [entry.summary for entry in result] == ["p0", "p1", "p2"]
