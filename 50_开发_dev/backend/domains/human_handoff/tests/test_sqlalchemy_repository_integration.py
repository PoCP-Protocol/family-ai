"""Integration test for `SqlAlchemyHumanHandoffRepository` against a REAL
PostgreSQL instance.

Requires `PY_HANDOFF_TEST_DATABASE_URL` env var pointing at a disposable
PostgreSQL database that already has the Principal-module schema applied
(the `principal_human_handoffs` / `principal_responses` tables). Skipped
entirely if that env var is not set. Same convention as
`backend/domains/consent/tests/test_sqlalchemy_repository_integration.py`.

These tests are the real-DB proof of the two guardrail invariants a Fake
cannot fully vouch for:
  1. the atomic OPEN->RESOLVED resolve guard (`where status='OPEN'`), and
  2. the idempotent release stamp (`where ... and released_at is null`) — the
     exact fail-open risk (double-release) a real integration test exists to
     catch.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from domains.human_handoff.domain.value_objects import HandoffReason, HandoffResolution, HandoffStatus
from domains.human_handoff.infrastructure.sqlalchemy_repository import SqlAlchemyHumanHandoffRepository

DATABASE_URL = os.environ.get("PY_HANDOFF_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="PY_HANDOFF_TEST_DATABASE_URL not set — skipping real-Postgres integration tests",
)

TENANT = "tenant-int-1"


@pytest.fixture
async def connection():
    engine = create_async_engine(DATABASE_URL, poolclass=None)
    async with engine.connect() as conn:
        trans = await conn.begin()
        yield conn
        await trans.rollback()
    await engine.dispose()


async def _seed_family(conn) -> str:
    family_id = str(uuid.uuid4())
    await conn.execute(
        text("insert into families(family_id, display_name, status) values (:id, '测试家庭', 'ACTIVE')"),
        {"id": family_id},
    )
    return family_id


async def _seed_response(conn, family_id: str, output: str) -> str:
    """Insert a withheld candidate response row (as Principal's saveResponse
    would). Column set kept minimal; the integration DB's NOT NULL columns
    for principal_responses may require adjustment when this skeleton is run
    against the real schema — flagged for the cutover author."""
    response_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    await conn.execute(
        text(
            """
            insert into principal_responses(response_id, session_id, family_id, risk_route, schema_valid, output)
            values (:response_id, :session_id, :family_id, 'REVIEW', true, cast(:output as jsonb))
            """
        ),
        {"response_id": response_id, "session_id": session_id, "family_id": family_id, "output": output},
    )
    return response_id


async def test_open_then_resolve_transitions_open_to_resolved(connection):
    family_id = await _seed_family(connection)
    repo = SqlAlchemyHumanHandoffRepository(connection)
    handoff = await repo.open_handoff(
        tenant_id=TENANT, family_id=family_id, reason=HandoffReason.REVIEW,
        risk_route="REVIEW", session_id=None, subject_ref=None, assigned_role="REVIEWER", response_id=None,
    )
    assert handoff.status == HandoffStatus.OPEN

    ok = await repo.resolve_handoff(handoff.handoff_id, family_id, "reviewer-1", HandoffResolution.REJECTED, None)
    assert ok is True
    reloaded = await repo.load_by_id(handoff.handoff_id, family_id)
    assert reloaded is not None and reloaded.status == HandoffStatus.RESOLVED

    # Second resolve of an already-RESOLVED handoff is a no-op (where status='OPEN').
    ok2 = await repo.resolve_handoff(handoff.handoff_id, family_id, "reviewer-1", HandoffResolution.APPROVED, None)
    assert ok2 is False


async def test_mark_released_is_idempotent(connection):
    family_id = await _seed_family(connection)
    repo = SqlAlchemyHumanHandoffRepository(connection)
    response_id = await _seed_response(connection, family_id, '{"reply": "content"}')
    handoff = await repo.open_handoff(
        tenant_id=TENANT, family_id=family_id, reason=HandoffReason.REVIEW,
        risk_route="REVIEW", session_id=None, subject_ref=None, assigned_role="REVIEWER", response_id=response_id,
    )
    await repo.resolve_handoff(handoff.handoff_id, family_id, "reviewer-1", HandoffResolution.APPROVED, None)

    first = await repo.mark_released(handoff.handoff_id, family_id, response_id)
    assert first is True  # this call performed the release
    second = await repo.mark_released(handoff.handoff_id, family_id, response_id)
    assert second is False  # already released -> released_at is null clause matches nothing

    output = await repo.load_response_output(response_id, family_id)
    assert output == {"reply": "content"}


async def test_mark_released_refuses_non_approved(connection):
    family_id = await _seed_family(connection)
    repo = SqlAlchemyHumanHandoffRepository(connection)
    response_id = await _seed_response(connection, family_id, '{"reply": "withheld"}')
    handoff = await repo.open_handoff(
        tenant_id=TENANT, family_id=family_id, reason=HandoffReason.REVIEW,
        risk_route="REVIEW", session_id=None, subject_ref=None, assigned_role="REVIEWER", response_id=response_id,
    )
    await repo.resolve_handoff(handoff.handoff_id, family_id, "reviewer-1", HandoffResolution.REJECTED, None)
    # resolution != APPROVED -> release matches no rows.
    released = await repo.mark_released(handoff.handoff_id, family_id, response_id)
    assert released is False
