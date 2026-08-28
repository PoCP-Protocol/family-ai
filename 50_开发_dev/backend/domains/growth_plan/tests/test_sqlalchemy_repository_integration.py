"""Integration test skeleton for `SqlAlchemyGrowthPlanRepository` against a
REAL PostgreSQL instance.

Requires `PY_GROWTH_PLAN_TEST_DATABASE_URL`. Skipped entirely if that env var
is not set. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.

HONEST SCOPE NOTE: `SqlAlchemyGrowthPlanRepository` is a framework-only
port right now — most of its methods raise `NotImplementedError` (see that
module's docstring). This test only exercises what IS real:
`assert_tenant_family_scope` and the idempotency lock/replay/persist cycle.
Once `insert_plan_with_phases`/`pause_plan`/`apply_review_decision` are
ported, extend this file with the create/pause/review-phase flows (mirror
`backend/domains/family/tests/test_sqlalchemy_repository_integration.py`).
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.growth_plan.domain.errors import GrowthPlanForbiddenError
from domains.growth_plan.infrastructure.sqlalchemy_repository import SqlAlchemyGrowthPlanRepository

DATABASE_URL = os.environ.get("PY_GROWTH_PLAN_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_GROWTH_PLAN_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
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
    repo = SqlAlchemyGrowthPlanRepository(connection)
    with pytest.raises(GrowthPlanForbiddenError):
        await repo.assert_tenant_family_scope(str(uuid.uuid4()), str(uuid.uuid4()), "actor-1")


async def test_idempotency_lock_and_persist_replay_cycle(connection):
    repo = SqlAlchemyGrowthPlanRepository(connection)
    tenant_id, family_id, plan_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    key = str(uuid.uuid4())

    await repo.lock_operation(tenant_id, family_id, "CreatePlan", key)
    replay_before = await repo.load_operation_replay(tenant_id, family_id, "CreatePlan", key, "hash-1")
    assert replay_before is None

    await repo.persist_operation(
        tenant_id, family_id, plan_id, "actor-1", "CreatePlan", "hash-1", {"ok": True}, str(uuid.uuid4()), key
    )
    replay_after = await repo.load_operation_replay(tenant_id, family_id, "CreatePlan", key, "hash-1")
    assert replay_after == {"ok": True}
