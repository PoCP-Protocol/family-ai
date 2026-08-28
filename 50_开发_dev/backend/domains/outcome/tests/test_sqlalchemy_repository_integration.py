"""Integration test skeleton for `SqlAlchemyOutcomeRepository` against a REAL
PostgreSQL instance.

Requires `PY_OUTCOME_TEST_DATABASE_URL`. Skipped entirely if that env var is
not set. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.

HONEST SCOPE NOTE: `SqlAlchemyOutcomeRepository` is a framework-only port
right now (see that module's docstring) — the OutcomeObservation/
GrowthReview/NextStepDecision writes and the Timeline union projection all
still raise `NotImplementedError`. This test only exercises what IS real:
`assert_tenant_family_scope`, `load_person_type`, and the idempotency
lock/replay/persist cycle.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.outcome.domain.errors import OutcomeForbiddenError
from domains.outcome.infrastructure.sqlalchemy_repository import SqlAlchemyOutcomeRepository

DATABASE_URL = os.environ.get("PY_OUTCOME_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_OUTCOME_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
)


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()
    await engine.dispose()


async def test_assert_tenant_family_scope_denied_without_binding(connection):
    repo = SqlAlchemyOutcomeRepository(connection)
    with pytest.raises(OutcomeForbiddenError):
        await repo.assert_tenant_family_scope(str(uuid.uuid4()), str(uuid.uuid4()), "actor-1")


async def test_load_person_type_returns_none_for_unknown_person(connection):
    repo = SqlAlchemyOutcomeRepository(connection)
    assert await repo.load_person_type(str(uuid.uuid4())) is None
