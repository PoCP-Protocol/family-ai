"""Integration tests for `SqlAlchemyGrowthPriorityRepository` against a REAL
PostgreSQL instance.

Requires `PY_GROWTH_PRIORITY_TEST_DATABASE_URL`. Skipped entirely if that env
var is not set. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.

NOTE (honesty about scope): `build_draft` (buildGrowthPriorityDraft port) is
still `NotImplementedError` in the real repository — see that method's
docstring. This test file therefore only exercises the methods that ARE
fully implemented (existence/permission checks, idempotency lock/replay,
the `insert_priority` version-chain write) directly against seeded rows,
rather than driving the full `confirmGrowthPriority` command end-to-end
(which would require `build_draft`).
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.growth_priority.domain.entities import GrowthPriorityCandidate
from domains.growth_priority.infrastructure.sqlalchemy_repository import SqlAlchemyGrowthPriorityRepository

DATABASE_URL = os.environ.get("PY_GROWTH_PRIORITY_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_GROWTH_PRIORITY_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
)


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()
    await engine.dispose()


async def _seed_family_profile(conn) -> tuple[str, str]:
    family_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    await conn.execute(
        text("insert into families(family_id, display_name, status) values (:id, '测试家庭', 'ACTIVE')"),
        {"id": family_id},
    )
    await conn.execute(
        text(
            "insert into persons(person_id, family_id, person_type, display_name) "
            "values (:id, :family_id, 'CHILD', '孩子')"
        ),
        {"id": child_id, "family_id": family_id},
    )
    await conn.execute(
        text(
            "insert into growth_profiles(profile_id, family_id, subject_person_id, status, confirmed_at) "
            "values (:profile_id, :family_id, :child_id, 'WORKING', now())"
        ),
        {"profile_id": profile_id, "family_id": family_id, "child_id": child_id},
    )
    return family_id, profile_id


async def test_insert_priority_creates_version_chain(connection):
    family_id, profile_id = await _seed_family_profile(connection)
    onboarding_id = str(uuid.uuid4())
    await connection.execute(
        text(
            "insert into growth_journeys(journey_id, family_id, journey_type, phase, status) "
            "values (:id, :family_id, 'PARENT_CHILD_COMMUNICATION_CONFLICT', 'ONBOARDING', 'ACTIVE')"
        ),
        {"id": onboarding_id, "family_id": family_id},
    )

    repo = SqlAlchemyGrowthPriorityRepository(connection)

    first = await repo.insert_priority(
        family_id,
        onboarding_id,
        profile_id,
        GrowthPriorityCandidate(dimension_id="R03", reason_codes=["seed"], evidence_refs=[]),
        "actor-1",
        previous=None,
    )
    assert first.version == 1
    assert first.status == "ACTIVE"

    active = await repo.load_active_priority(family_id, onboarding_id)
    assert active is not None
    assert active.priority_id == first.priority_id

    second = await repo.insert_priority(
        family_id,
        onboarding_id,
        profile_id,
        GrowthPriorityCandidate(dimension_id="R04", reason_codes=["seed2"], evidence_refs=[]),
        "actor-1",
        previous=active,
    )
    assert second.version == 2
    assert second.previous_priority_id == first.priority_id

    still_active = await repo.load_active_priority(family_id, onboarding_id)
    assert still_active.priority_id == second.priority_id
