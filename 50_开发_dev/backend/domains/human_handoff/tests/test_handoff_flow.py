"""Fake-based unit tests for the Human Handoff domain state machine +
command handler. Drives `HumanHandoffCommandHandler` against
`FakeHumanHandoffRepository`, covering the dual-invariant release semantics
ported from `principal.service.ts::resolveHandoff` /
`principal.repository.ts`.
"""
from __future__ import annotations

import pytest

from domains.human_handoff.application.commands import (
    HumanHandoffCommandHandler,
    OpenHandoffCommand,
    ResolveHandoffCommand,
)
from domains.human_handoff.domain.entities import HumanHandoff
from domains.human_handoff.domain.errors import HumanHandoffConflictError, HumanHandoffValidationError
from domains.human_handoff.domain.state_machine import (
    can_release,
    release,
    resolve as sm_resolve,
)
from domains.human_handoff.domain.value_objects import (
    HandoffReason,
    HandoffResolution,
    HandoffStatus,
)
from domains.human_handoff.infrastructure.fake_repository import (
    DEFAULT_TEST_ACTOR,
    DEFAULT_TEST_TENANT,
    FakeHumanHandoffRepository,
)

TENANT = DEFAULT_TEST_TENANT
FAMILY = "family-1"
ACTOR = DEFAULT_TEST_ACTOR


def _make_repo() -> FakeHumanHandoffRepository:
    repo = FakeHumanHandoffRepository()
    repo.seed_scope(TENANT, FAMILY)
    return repo


def _handler(repo: FakeHumanHandoffRepository) -> HumanHandoffCommandHandler:
    return HumanHandoffCommandHandler(repo)


# --- open ----------------------------------------------------------------


async def test_open_creates_open_handoff():
    repo = _make_repo()
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.QUOTA, risk_route="REVIEW")
    )
    assert handoff.status == HandoffStatus.OPEN
    assert handoff.reason == HandoffReason.QUOTA
    assert handoff.response_id is None
    assert handoff.released_at is None
    assert repo.handoffs[handoff.handoff_id].status == HandoffStatus.OPEN


async def test_open_denied_outside_tenant_scope():
    repo = FakeHumanHandoffRepository()  # no scope seeded
    handler = _handler(repo)
    from domains.human_handoff.domain.errors import HumanHandoffForbiddenError

    with pytest.raises(HumanHandoffForbiddenError):
        await handler.open(
            OpenHandoffCommand(tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW, risk_route="REVIEW")
        )


# --- resolve only affects OPEN -------------------------------------------


async def test_resolve_only_takes_effect_on_open():
    repo = _make_repo()
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW, risk_route="REVIEW")
    )
    first = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.REJECTED,
        )
    )
    assert first.ok is True
    # Second resolve of an already-RESOLVED handoff is a no-op (ok=False).
    second = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.APPROVED,
        )
    )
    assert second.ok is False
    assert second.released_response is None


async def test_resolve_requires_actor():
    repo = _make_repo()
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW, risk_route="REVIEW")
    )
    with pytest.raises(HumanHandoffValidationError):
        await handler.resolve(
            ResolveHandoffCommand(
                tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
                actor_id="  ", resolution=HandoffResolution.APPROVED,
            )
        )


# --- APPROVED + response_id releases; others withhold --------------------


async def test_approved_with_response_releases_content():
    repo = _make_repo()
    repo.seed_response("resp-1", FAMILY, {"reply": "试着先倾听孩子的感受"})
    handler = _handler(repo)
    # A REVIEW handoff carrying a withheld candidate response.
    handoff = await handler.open(
        OpenHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW,
            risk_route="REVIEW", response_id="resp-1",
        )
    )
    result = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.APPROVED, note="looks good",
        )
    )
    assert result.ok is True
    assert result.released_response == {"reply": "试着先倾听孩子的感受"}
    assert repo.handoffs[handoff.handoff_id].released_at is not None


@pytest.mark.parametrize(
    "resolution",
    [HandoffResolution.REJECTED, HandoffResolution.ESCALATED, HandoffResolution.INFO_ONLY],
)
async def test_non_approved_keeps_response_withheld(resolution: HandoffResolution):
    repo = _make_repo()
    repo.seed_response("resp-1", FAMILY, {"reply": "withheld"})
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW,
            risk_route="REVIEW", response_id="resp-1",
        )
    )
    result = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=resolution,
        )
    )
    assert result.ok is True
    assert result.released_response is None  # WITHHELD
    assert repo.handoffs[handoff.handoff_id].released_at is None


async def test_approved_without_response_id_withholds():
    """A HIGH_RISK handoff carries no withheld response — APPROVED still
    resolves but releases nothing."""
    repo = _make_repo()
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.PRECHECK,
            risk_route="HIGH_RISK", response_id=None,
        )
    )
    result = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.APPROVED,
        )
    )
    assert result.ok is True
    assert result.released_response is None


# --- idempotent release --------------------------------------------------


async def test_release_is_idempotent_via_explicit_entry():
    repo = _make_repo()
    repo.seed_response("resp-1", FAMILY, {"reply": "content"})
    handler = _handler(repo)
    handoff = await handler.open(
        OpenHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, reason=HandoffReason.REVIEW,
            risk_route="REVIEW", response_id="resp-1",
        )
    )
    # Resolve APPROVED -> first release happens inline.
    first = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.APPROVED,
        )
    )
    assert first.released_response == {"reply": "content"}
    released_at_first = repo.handoffs[handoff.handoff_id].released_at
    assert released_at_first is not None

    # A second explicit release attempt must NOT re-release (idempotent):
    # released_response is None and the released_at stamp is unchanged.
    second = await handler.release(
        ResolveHandoffCommand(
            tenant_id=TENANT, family_id=FAMILY, handoff_id=handoff.handoff_id,
            actor_id=ACTOR, resolution=HandoffResolution.APPROVED,
        )
    )
    assert second.ok is True
    assert second.released_response is None
    assert repo.handoffs[handoff.handoff_id].released_at == released_at_first


# --- state machine: illegal transitions ----------------------------------


def _handoff(**overrides) -> HumanHandoff:
    base = dict(
        handoff_id="h1", family_id=FAMILY, tenant_id=TENANT,
        reason=HandoffReason.REVIEW, status=HandoffStatus.OPEN,
    )
    base.update(overrides)
    return HumanHandoff(**base)


def test_state_machine_resolve_rejected_when_not_open():
    already = _handoff(status=HandoffStatus.RESOLVED, resolution=HandoffResolution.APPROVED)
    with pytest.raises(HumanHandoffConflictError):
        sm_resolve(already, HandoffResolution.APPROVED, None, ACTOR)


def test_state_machine_release_rejects_unresolved():
    open_handoff = _handoff(status=HandoffStatus.OPEN, response_id="resp-1")
    with pytest.raises(HumanHandoffConflictError):
        release(open_handoff)


def test_state_machine_release_rejects_non_approved():
    resolved_rejected = _handoff(
        status=HandoffStatus.RESOLVED, resolution=HandoffResolution.REJECTED, response_id="resp-1"
    )
    assert can_release(resolved_rejected) is False
    with pytest.raises(HumanHandoffConflictError):
        release(resolved_rejected)


def test_state_machine_release_idempotent_noop_when_already_released():
    from datetime import UTC, datetime

    stamp = datetime(2026, 1, 1, tzinfo=UTC)
    already_released = _handoff(
        status=HandoffStatus.RESOLVED, resolution=HandoffResolution.APPROVED,
        response_id="resp-1", released_at=stamp,
    )
    # Idempotent: returns unchanged, does NOT raise and does NOT re-stamp.
    out = release(already_released)
    assert out.released_at == stamp
    assert can_release(already_released) is False
