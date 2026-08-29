"""Commands and their handler for the Human Handoff domain — ported 1:1 from
the handoff lifecycle in `apps/api/src/modules/principal/principal.service.ts`
(the four `saveHandoff` call sites + `resolveHandoff`) and the atomic SQL in
`principal.repository.ts`. This is a translation, not a redesign.

The dual-invariant release semantics (contract section 3) are preserved:
`resolve` only takes effect on an OPEN handoff; only `APPROVED` with a withheld
`response_id` releases the response, and every other resolution keeps it
withheld (`released_response = None`).
"""
from __future__ import annotations

from dataclasses import dataclass

from ..domain.entities import HumanHandoff
from ..domain.errors import HumanHandoffNotFoundError, HumanHandoffValidationError
from ..domain.value_objects import HandoffReason, HandoffResolution
from .ports import HumanHandoffRepositoryPort


@dataclass(frozen=True)
class OpenHandoffCommand:
    tenant_id: str
    family_id: str
    reason: HandoffReason
    risk_route: str
    session_id: str | None = None
    subject_ref: str | None = None
    assigned_role: str | None = None
    response_id: str | None = None


@dataclass(frozen=True)
class ResolveHandoffCommand:
    tenant_id: str
    family_id: str
    handoff_id: str
    actor_id: str
    resolution: HandoffResolution
    note: str | None = None


@dataclass(frozen=True)
class ResolveHandoffResult:
    """Mirrors the NestJS `resolveHandoff` return `{ ok, released_response }`.

    - ok=False, released_response=None : the resolve was a no-op (handoff was
      not OPEN — already resolved / does not match). Matches rowCount-0.
    - ok=True,  released_response=None : resolved, but WITHHELD (resolution
      != APPROVED, or APPROVED but no withheld response / already released).
    - ok=True,  released_response=<payload> : APPROVED and this call released
      the previously-withheld candidate response back to the parent.
    """

    ok: bool
    released_response: object | None = None


class HumanHandoffCommandHandler:
    """Port of the handoff lifecycle methods of `PrincipalService`. Repository
    transaction boundaries are the caller's responsibility (FastAPI
    dependency / unit of work), same convention as the Batch 2 domains — the
    handler receives an already-scoped repository.
    """

    def __init__(self, repository: HumanHandoffRepositoryPort):
        self._repository = repository

    async def open(self, command: OpenHandoffCommand) -> HumanHandoff:
        """Port of the `saveHandoff(...)` call sites. Creates an OPEN handoff.
        Tenant/family scope is enforced before the insert. The Principal domain
        calls this through its `HumanHandoffPort` bridge; the `actor_id` for the
        scope check on open is the Principal system itself, so `family_id` is
        passed as the actor placeholder (the open path has no reviewer)."""
        await self._repository.assert_tenant_family_scope(
            command.tenant_id, command.family_id, command.family_id
        )
        return await self._repository.open_handoff(
            tenant_id=command.tenant_id,
            family_id=command.family_id,
            reason=command.reason,
            risk_route=command.risk_route,
            session_id=command.session_id,
            subject_ref=command.subject_ref,
            assigned_role=command.assigned_role,
            response_id=command.response_id,
        )

    async def resolve(self, command: ResolveHandoffCommand) -> ResolveHandoffResult:
        """Port of `PrincipalService.resolveHandoff`.

        Step-by-step parity with the NestJS method:
          1. resolveHandoff (atomic `where status='OPEN'`) -> ok boolean.
             If ok is False the handoff was not OPEN -> return {ok:false, null}.
          2. only if `resolution === 'APPROVED'`: loadHandoff, and if it
             carries a `response_id`, markHandoffReleased (atomic, idempotent).
             If THIS call released it, loadResponse and return its output.
          3. any other resolution -> {ok:true, released_response:null} (WITHHELD).
        """
        if not command.actor_id or not command.actor_id.strip():
            raise HumanHandoffValidationError("actor_id_required")

        await self._repository.assert_tenant_family_scope(
            command.tenant_id, command.family_id, command.actor_id
        )

        ok = await self._repository.resolve_handoff(
            command.handoff_id, command.family_id, command.actor_id, command.resolution, command.note
        )
        if not ok:
            return ResolveHandoffResult(ok=False, released_response=None)

        # Human Gate dual-invariant: only human APPROVED can release a withheld
        # response; every other resolution keeps it withheld.
        if command.resolution == HandoffResolution.APPROVED:
            handoff = await self._repository.load_by_id(command.handoff_id, command.family_id)
            if handoff is not None and handoff.response_id is not None:
                released = await self._repository.mark_released(
                    command.handoff_id, command.family_id, handoff.response_id
                )
                if released:
                    output = await self._repository.load_response_output(
                        handoff.response_id, command.family_id
                    )
                    return ResolveHandoffResult(ok=True, released_response=output)

        return ResolveHandoffResult(ok=True, released_response=None)

    async def release(self, command: ResolveHandoffCommand) -> ResolveHandoffResult:
        """Explicit release-only entry point (idempotent) for callers that
        want to (re)attempt release of an ALREADY-RESOLVED-APPROVED handoff
        without re-resolving it — e.g. a retry after a transient failure. In
        the NestJS flow release only ever happens inline inside resolveHandoff;
        this separate method exposes the same idempotent `markHandoffReleased`
        semantics for the Principal `HumanHandoffPort` bridge to reuse.

        Loads the handoff (404 if missing), then delegates to the atomic
        idempotent `mark_released`. A second call after a real release returns
        {ok:true, released_response:None} because `mark_released` matches zero
        rows the second time (`released_at is null` guard).
        """
        handoff = await self._repository.load_by_id(command.handoff_id, command.family_id)
        if handoff is None:
            raise HumanHandoffNotFoundError("handoff_not_found")
        if handoff.resolution != HandoffResolution.APPROVED or handoff.response_id is None:
            return ResolveHandoffResult(ok=True, released_response=None)
        released = await self._repository.mark_released(
            command.handoff_id, command.family_id, handoff.response_id
        )
        if released:
            output = await self._repository.load_response_output(handoff.response_id, command.family_id)
            return ResolveHandoffResult(ok=True, released_response=output)
        return ResolveHandoffResult(ok=True, released_response=None)
