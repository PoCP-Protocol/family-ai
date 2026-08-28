"""Integration tests for `SqlAlchemyFamilyRepository` against a REAL
PostgreSQL instance.

Requires `PY_FAMILY_TEST_DATABASE_URL` env var pointing at a disposable
PostgreSQL database that already has the schema from
`database/migrations/0001..0044` applied. Skipped entirely if that env var
is not set, so this suite never silently runs against — or fails to run
against — the wrong database. Same convention as
`backend/domains/assessment/tests/test_sqlalchemy_repository_integration.py`.
"""
from __future__ import annotations

import os
import uuid
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from domains.family.application.commands import (
    AddChildCommand,
    AddParentCommand,
    AssignLifeStageCommand,
    CreateFamilyCommand,
    CreateRelationshipCommand,
    FamilyCommandHandler,
    MutationMeta,
)
from domains.family.domain.errors import FamilyConflictError
from domains.family.domain.value_objects import LifeStageCode, ParentRole, RelationshipType
from domains.family.infrastructure.sqlalchemy_repository import SqlAlchemyFamilyRepository

DATABASE_URL = os.environ.get("PY_FAMILY_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="PY_FAMILY_TEST_DATABASE_URL not set — skipping real-Postgres integration tests"
)


def _meta(actor: str = "actor-1") -> MutationMeta:
    return MutationMeta(actor=actor, correlation_id=str(uuid.uuid4()), idempotency_key=str(uuid.uuid4()))


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()  # every test rolls back — no data persists across tests
    await engine.dispose()


@pytest.fixture
def handler(connection) -> FamilyCommandHandler:
    return FamilyCommandHandler(SqlAlchemyFamilyRepository(connection))


async def test_create_family_persists_and_replays(handler: FamilyCommandHandler):
    meta = _meta()
    cmd = CreateFamilyCommand(display_name="测试家庭", primary_contact_account_id=None, meta=meta)

    first = await handler.create_family(cmd)
    assert first["replayed"] is False
    family_id = first["family"]["family_id"]

    # Same idempotency key + same payload -> replay, no new row.
    second = await handler.create_family(cmd)
    assert second["replayed"] is True
    assert second["family"]["family_id"] == family_id


async def test_add_parent_and_child_then_relationship(handler: FamilyCommandHandler):
    creator = "creator-1"
    # The creator becomes permission-eligible via the CreateFamily audit row
    # written by write_audit_and_outbox — use the same actor for follow-ups.
    create_resp = await handler.create_family(CreateFamilyCommand("家庭B", None, _meta(actor=creator)))
    family_id = create_resp["family"]["family_id"]

    parent = await handler.add_parent(
        AddParentCommand(family_id, ParentRole.MOTHER, "妈妈", None, _meta(actor=creator))
    )
    child = await handler.add_child(AddChildCommand(family_id, "孩子", date(2013, 1, 1), _meta(actor=creator)))

    parent_id = parent["person"]["person_id"]
    child_id = child["person"]["person_id"]

    relationship = await handler.create_relationship(
        CreateRelationshipCommand(family_id, parent_id, child_id, RelationshipType.PARENT_CHILD, _meta(actor=creator))
    )
    assert relationship["relationship"]["relationship_type"] == "PARENT_CHILD"

    # Duplicate relationship must be rejected (application-level dup check +
    # DB unique index double protection).
    with pytest.raises(FamilyConflictError):
        await handler.create_relationship(
            CreateRelationshipCommand(
                family_id, parent_id, child_id, RelationshipType.PARENT_CHILD, _meta(actor=creator)
            )
        )


async def test_assign_life_stage_closes_previous_assignment(handler: FamilyCommandHandler):
    creator = "creator-2"
    family_id = (await handler.create_family(CreateFamilyCommand("家庭C", None, _meta(actor=creator))))[
        "family"
    ]["family_id"]
    child = await handler.add_child(AddChildCommand(family_id, "孩子", date(2013, 1, 1), _meta(actor=creator)))
    child_id = child["person"]["person_id"]

    first = await handler.assign_life_stage(
        AssignLifeStageCommand(
            family_id, child_id, LifeStageCode.EARLY_ADOLESCENCE_12_15, date(2026, 1, 1), _meta(actor=creator), "MANUAL"
        )
    )
    assert first["life_stage_assignment"]["effective_to"] is None
