"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Domain/application code never imports SQLAlchemy/FastAPI
directly; it depends on these Protocols instead, per the four-layer rule.

Mirrors the handoff query/mutation surface split across
`principal.repository.ts` (`saveHandoff`/`resolveHandoff`/`loadHandoff`/
`loadResponse`/`markHandoffReleased`) — regrouped here as one cohesive
`HumanHandoffRepositoryPort` for the decoupled domain.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.entities import HumanHandoff
from ..domain.value_objects import HandoffReason, HandoffResolution


class HumanHandoffRepositoryPort(Protocol):
    """The persistence surface the `HumanHandoffCommandHandler` needs. The
    real implementation (`sqlalchemy_repository.py`) reuses the EXISTING
    `principal_human_handoffs` / `principal_responses` tables — it does NOT
    create new schema (PYTHON_READY convention: read/write existing schema,
    cutover changes migration ownership).
    """

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        """Canonical tenancy check unified across Batch 2/3 domains. Verifies
        BOTH that `tenant_id` owns `family_id` (row-level isolation) AND the
        actor's manage-permission condition. `tenant_id` is supplied by the
        caller from request context, not re-derived here.

        NOTE (NestJS parity): the NestJS handoff-resolve path
        (`principal.controller.ts::resolveHandoff`) gates on `assertReviewer`
        (reviewer-authorization allowlist) at the AUTH layer, and the
        repository SQL scopes only by `family_id`. There is no separate
        row-level tenant isolation in the TS handoff row. This project-owner-
        authorized tenancy check is the Batch 2/3 capability expansion applied
        uniformly; the reviewer-authorization gate remains a caller-side
        concern wired in `apps/family_api` (mirroring how other domains keep
        JWT/reviewer verification out of the domain layer)."""
        ...

    async def open_handoff(
        self,
        tenant_id: str,
        family_id: str,
        reason: HandoffReason,
        risk_route: str,
        session_id: str | None,
        subject_ref: str | None,
        assigned_role: str | None,
        response_id: str | None,
    ) -> HumanHandoff:
        """Port of `saveHandoff` — inserts a new OPEN handoff (status defaults
        to OPEN). `response_id` is the withheld candidate response for REVIEW
        handoffs, or None for HIGH_RISK/quota/model_error handoffs. Returns the
        persisted `HumanHandoff`."""
        ...

    async def load_by_id(self, handoff_id: str, family_id: str) -> HumanHandoff | None:
        """Port of `loadHandoff` — family-scoped load; None if not found."""
        ...

    async def resolve_handoff(
        self, handoff_id: str, family_id: str, actor_id: str, resolution: HandoffResolution, note: str | None
    ) -> bool:
        """Port of `resolveHandoff` — atomic `update ... where status='OPEN'`.
        Returns True only if it actually transitioned an OPEN handoff (rowCount
        > 0), matching the NestJS `ok` boolean. A handoff already RESOLVED
        returns False (no-op)."""
        ...

    async def mark_released(self, handoff_id: str, family_id: str, response_id: str) -> bool:
        """Port of `markHandoffReleased` — atomic, idempotent release stamp:
        `update ... set released_at=now() where ... response_id=$3 and
        resolution='APPROVED' and released_at is null`. Returns True only if
        THIS call performed the release (rowCount > 0); a repeat call returns
        False (already released -> the `released_at is null` clause matches no
        rows). This is where the release idempotency is authoritatively
        enforced against concurrent callers."""
        ...

    async def load_response_output(self, response_id: str, family_id: str) -> object | None:
        """Port of `loadResponse` — returns the withheld response `output`
        payload (parsed) for a family-scoped response_id, or None. Used to
        return the released response body after a successful release."""
        ...
