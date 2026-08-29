"""Human Handoff domain entities.

Ported from the `principal_human_handoffs` table shape as read/written by
`apps/api/src/modules/principal/principal.repository.ts`
(`saveHandoff`/`listOpenHandoffs`/`resolveHandoff`/`loadHandoff`/
`markHandoffReleased`) and the four `saveHandoff(...)` call sites in
`principal.service.ts::handleMessage`. See
`architecture/notes/batch3-principal-migration-contract-v1.md` section 2.

`tenant_id` is a Batch-2/3 canonical row-level isolation field carried
through every domain (the NestJS row itself scopes only by `family_id`; the
tenant scope is supplied by the caller from request context — see the
`assert_tenant_family_scope` note in `application/ports.py`).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .value_objects import HandoffReason, HandoffResolution, HandoffStatus


class HumanHandoff(BaseModel):
    """Port of a `principal_human_handoffs` row.

    Column mapping (NestJS -> here):
      handoff_id            -> handoff_id
      family_id             -> family_id
      (caller tenant scope) -> tenant_id
      trigger_reason        -> reason         (HandoffReason)
      status                -> status         (HandoffStatus, default OPEN on insert)
      response_id           -> response_id    (nullable; HIGH_RISK handoffs carry no
                                               withheld response, REVIEW handoffs do)
      resolution            -> resolution     (nullable until resolved; HandoffResolution)
      resolution_note       -> note           (nullable)
      resolved_by_actor_id  -> resolved_by_actor_id (nullable until resolved)
      released_at           -> released_at    (nullable; stamped only when an APPROVED
                                               handoff's withheld response is released)
      created_at            -> created_at

    Not modelled here (Principal-side bookkeeping, not part of the handoff
    state machine): session_id, subject_ref, risk_route, assigned_role. The
    repository layer still reads/writes those columns to stay schema-faithful,
    but the handoff *state machine* only needs the fields above.
    """

    handoff_id: str
    family_id: str
    tenant_id: str
    reason: HandoffReason
    status: HandoffStatus = HandoffStatus.OPEN
    response_id: str | None = None
    resolution: HandoffResolution | None = None
    note: str | None = None
    resolved_by_actor_id: str | None = None
    released_at: datetime | None = None
    created_at: datetime | None = None

    def is_released(self) -> bool:
        """Idempotency predicate — mirrors the NestJS `released_at is null`
        guard: a handoff whose `released_at` is already set must never be
        released a second time."""
        return self.released_at is not None
