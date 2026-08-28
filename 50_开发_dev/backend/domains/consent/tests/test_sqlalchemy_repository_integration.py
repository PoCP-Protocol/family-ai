"""Integration test for `SqlAlchemyConsentRepository` against a REAL
PostgreSQL instance.

Requires `PY_CONSENT_TEST_DATABASE_URL` env var pointing at a disposable
PostgreSQL database that already has the schema from
`database/migrations/0001..0044` applied. Skipped entirely if that env var
is not set. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.consent.domain.value_objects import ConsentPurpose
from domains.consent.infrastructure.sqlalchemy_repository import SqlAlchemyConsentRepository

DATABASE_URL = os.environ.get("PY_CONSENT_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_CONSENT_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
)


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()
    await engine.dispose()


async def _seed_family_with_child(conn) -> tuple[str, str]:
    family_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    guardian_id = str(uuid.uuid4())
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
            "insert into persons(person_id, family_id, person_type, parent_role, display_name) "
            "values (:id, :family_id, 'PARENT', 'MOTHER', '妈妈')"
        ),
        {"id": guardian_id, "family_id": family_id},
    )
    return family_id, child_id


async def test_load_granted_purposes_only_returns_granted_status(connection):
    family_id, child_id = await _seed_family_with_child(connection)
    guardian_id = str(uuid.uuid4())
    await connection.execute(
        text(
            "insert into persons(person_id, family_id, person_type, parent_role, display_name) "
            "values (:id, :family_id, 'PARENT', 'MOTHER', '妈妈2')"
        ),
        {"id": guardian_id, "family_id": family_id},
    )
    await connection.execute(
        text(
            """
            insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at)
            values (:family_id, :child_id, :guardian_id, 'SERVICE', 'GRANTED', 'v1', now())
            """
        ),
        {"family_id": family_id, "child_id": child_id, "guardian_id": guardian_id},
    )

    repo = SqlAlchemyConsentRepository(connection)
    granted = await repo.load_granted_purposes(
        family_id, child_id, (ConsentPurpose.SERVICE, ConsentPurpose.ASSESSMENT, ConsentPurpose.GROWTH_TRACKING)
    )

    assert granted == {ConsentPurpose.SERVICE}
