"""Explicit state machine for `principal_human_handoffs` — the pure-guardrail
core of this domain.

Ports the transition semantics embedded across
`principal.repository.ts` and `principal.service.ts::resolveHandoff`:

  1. resolve:  OPEN --(resolution, note, actor)--> RESOLVED
       NestJS: `update ... set status='RESOLVED', resolution=$3, resolution_note=$4,
                resolved_by_actor_id=$5, resolved_at=now() where ... and status='OPEN'`.
       The `and status='OPEN'` guard means a resolve only takes effect on an
       OPEN handoff (rowCount 0 otherwise -> `ok=false`). RESOLVED is terminal
       for status; it never returns to OPEN.

  2. release: RESOLVED(resolution=APPROVED, response_id present, released_at null)
              --> released (stamp released_at)
       NestJS: only reached when `resolution === 'APPROVED'` in service code,
       then `markHandoffReleased` runs
                `update ... set released_at=now()
                 where ... and response_id=$3 and resolution='APPROVED'
                   and released_at is null`.
       The `and released_at is null` clause makes release IDEMPOTENT: a second
       call matches zero rows and does not re-release. Any resolution other
       than APPROVED, or a missing response_id, keeps the response WITHHELD.

This module makes both transitions explicit and independently testable,
separate from the repository SQL that performs them as side effects (same
pattern as `domains/growth_priority/domain/state_machine.py`).

This is the release side of the contract's dual-invariant (section 3): only a
human APPROVED can release a withheld REVIEW response — automation can only
downgrade (that half lives in the Principal domain), never release.
"""
from __future__ import annotations

from datetime import UTC, datetime

from .entities import HumanHandoff
from .errors import HumanHandoffConflictError
from .value_objects import HandoffResolution, HandoffStatus

# Status transition table. `resolve` is the only legal status move; RESOLVED
# is terminal (release changes released_at, not status).
_ALLOWED_STATUS_TRANSITIONS: dict[HandoffStatus, frozenset[HandoffStatus]] = {
    HandoffStatus.OPEN: frozenset({HandoffStatus.RESOLVED}),
    HandoffStatus.RESOLVED: frozenset(),  # terminal — no legal outgoing status transition
}


def assert_legal_status_transition(current: HandoffStatus, target: HandoffStatus) -> None:
    if target not in _ALLOWED_STATUS_TRANSITIONS.get(current, frozenset()):
        raise HumanHandoffConflictError("handoff_status_transition_illegal")


def resolve(handoff: HumanHandoff, resolution: HandoffResolution, note: str | None, actor_id: str) -> HumanHandoff:
    """OPEN --> RESOLVED. Mirrors `resolveHandoff`'s `where ... status='OPEN'`
    guard: a resolve is only legal on an OPEN handoff. Returns a NEW
    HumanHandoff carrying the resolution/note/actor (the entity is immutable
    Pydantic — callers persist the returned copy).
    """
    assert_legal_status_transition(handoff.status, HandoffStatus.RESOLVED)
    return handoff.model_copy(
        update={
            "status": HandoffStatus.RESOLVED,
            "resolution": resolution,
            "note": note,
            "resolved_by_actor_id": actor_id,
        }
    )


def can_release(handoff: HumanHandoff) -> bool:
    """The exact predicate `markHandoffReleased`'s WHERE clause encodes:
    resolution=APPROVED AND response_id present AND released_at is null.
    Status must be RESOLVED (a still-OPEN handoff has no resolution yet).
    Returns False (WITHHOLD) rather than raising for the ordinary
    "not-approved / no-response / already-released" cases — those are normal
    outcomes, not errors, exactly as the NestJS rowCount-0 path is a benign
    `released_response: null`, not an exception.
    """
    return (
        handoff.status == HandoffStatus.RESOLVED
        and handoff.resolution == HandoffResolution.APPROVED
        and handoff.response_id is not None
        and handoff.released_at is None
    )


def release(handoff: HumanHandoff, now: datetime | None = None) -> HumanHandoff:
    """Stamp `released_at` on an APPROVED, still-withheld handoff.

    IDEMPOTENT: if the handoff is already released (`released_at` set), returns
    it UNCHANGED — no second stamp — mirroring the `where released_at is null`
    no-op. Raises `HumanHandoffConflictError` only for a genuinely illegal
    release (a handoff that is not RESOLVED, or whose resolution is not
    APPROVED, or that has no withheld response_id) — the caller/command layer
    is expected to gate on `can_release` first for the benign withhold path,
    so reaching `release` on a non-releasable, not-yet-released handoff is a
    programming error worth surfacing.
    """
    if handoff.is_released():
        return handoff  # idempotent no-op — do not re-stamp
    if handoff.status != HandoffStatus.RESOLVED:
        raise HumanHandoffConflictError("handoff_release_requires_resolved")
    if handoff.resolution != HandoffResolution.APPROVED:
        raise HumanHandoffConflictError("handoff_release_requires_approved")
    if handoff.response_id is None:
        raise HumanHandoffConflictError("handoff_release_requires_response")
    return handoff.model_copy(update={"released_at": now or datetime.now(UTC)})
