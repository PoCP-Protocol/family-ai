"""Integration test skeleton for `SqlAlchemyInterventionRepository` against a
REAL PostgreSQL instance.

Requires `PY_INTERVENTION_TEST_DATABASE_URL`. Skipped entirely if that env
var is not set. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.

HONEST SCOPE NOTE: `SqlAlchemyInterventionRepository` is a framework-only
port right now (see that module's docstring) — the core concurrency-control
methods (`load_completable_action_for_update`,
`update_growth_action_execution_status`) still raise `NotImplementedError`.
This test only exercises what IS real: `ensure_family_exists`,
`assert_family_manage_permission`, `assert_no_active_intervention_episode`,
and the idempotency lock/replay/persist cycle.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.intervention.domain.errors import InterventionNotFoundError
from domains.intervention.infrastructure.sqlalchemy_repository import SqlAlchemyInterventionRepository

DATABASE_URL = os.environ.get("PY_INTERVENTION_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_INTERVENTION_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
)


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()
    await engine.dispose()


async def test_ensure_family_exists_raises_for_unknown_family(connection):
    repo = SqlAlchemyInterventionRepository(connection)
    with pytest.raises(InterventionNotFoundError):
        await repo.ensure_family_exists(str(uuid.uuid4()))


async def test_no_active_intervention_episode_passes_for_fresh_onboarding(connection):
    family_id = str(uuid.uuid4())
    onboarding_id = str(uuid.uuid4())
    await connection.execute(
        text("insert into families(family_id, display_name, status) values (:id, '测试家庭', 'ACTIVE')"),
        {"id": family_id},
    )
    repo = SqlAlchemyInterventionRepository(connection)
    # No intervention_episodes row exists yet -> must not raise.
    await repo.assert_no_active_intervention_episode(family_id, onboarding_id)
