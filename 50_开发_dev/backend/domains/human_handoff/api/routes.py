"""FastAPI routes — port of the handoff-resolve endpoint in
`principal.controller.ts`:
  POST :familyId/handoffs/:handoffId/resolve

This is an INTERNAL-callable entry for now (contract section 7 / task scope):
the router + request/response shape + error mapping are in place, but the
concrete `HumanHandoffCommandHandler` dependency (`get_command_handler`) and
the family-context / reviewer-authorization dependency are wired in
`apps/family_api` at cutover — NOT duplicated here (mirroring how
`assessment/api/routes.py` keeps JWT/session verification out of the domain
router). The reviewer-authorization gate (`assertReviewer` in NestJS) is a
caller-side concern injected via the `require_reviewer` dependency below,
which apps/family_api overrides with the real allowlist check.

Domain errors (`HumanHandoffDomainError` subclasses) are NOT caught per-route;
they propagate to the app-level exception handler registered by
`register_exception_handlers()`, per FastAPI's recommended pattern — one
mapping table, registered once, cannot be forgotten in a route added later.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..application.commands import (
    HumanHandoffCommandHandler,
    ResolveHandoffCommand,
)
from ..domain.errors import (
    HumanHandoffConflictError,
    HumanHandoffDomainError,
    HumanHandoffForbiddenError,
    HumanHandoffNotFoundError,
    HumanHandoffValidationError,
)
from ..domain.value_objects import HandoffResolution

router = APIRouter()

_ERROR_STATUS = {
    HumanHandoffValidationError: 400,
    HumanHandoffForbiddenError: 403,
    HumanHandoffNotFoundError: 404,
    HumanHandoffConflictError: 409,
}


def register_exception_handlers(app: FastAPI) -> None:
    """Call once from the FastAPI app that mounts this router."""

    @app.exception_handler(HumanHandoffDomainError)
    async def _handle_human_handoff_domain_error(request, error: HumanHandoffDomainError) -> JSONResponse:
        status_code = _ERROR_STATUS.get(type(error), 400)
        return JSONResponse(status_code=status_code, content={"detail": error.code})


class ResolveHandoffRequestBody(BaseModel):
    resolution: HandoffResolution
    note: str | None = None


class ResolveHandoffResponse(BaseModel):
    ok: bool
    released_response: object | None = None


@dataclass(frozen=True)
class ReviewerContext:
    """The resolved reviewer + tenant scope. In `apps/family_api` this comes
    from the authenticated Bearer/actor + `assertReviewer` allowlist; the stub
    here is overridden via FastAPI dependency_overrides at cutover."""

    tenant_id: str
    actor_id: str


def require_reviewer(x_actor_id: str | None = Header(default=None)) -> ReviewerContext:  # pragma: no cover
    """Placeholder reviewer-context dependency. Not exercised by domain unit
    tests (those drive the command handler directly). `apps/family_api`
    overrides this with the real Bearer/reviewer-allowlist resolution
    (`resolveReviewerActor` + `assertReviewer` parity)."""
    raise NotImplementedError("require_reviewer is wired in apps/family_api at cutover")


def get_command_handler() -> HumanHandoffCommandHandler:  # pragma: no cover
    """Placeholder handler dependency; overridden in `apps/family_api` with a
    request-scoped `SqlAlchemyHumanHandoffRepository`-backed handler."""
    raise NotImplementedError("get_command_handler is wired in apps/family_api at cutover")


@router.post(
    "/{family_id}/handoffs/{handoff_id}/resolve",
    responses={200: {"model": ResolveHandoffResponse}},
)
async def resolve_handoff(
    family_id: str,
    handoff_id: str,
    body: ResolveHandoffRequestBody,
    reviewer: ReviewerContext = Depends(require_reviewer),
    handler: HumanHandoffCommandHandler = Depends(get_command_handler),
) -> ResolveHandoffResponse:
    if not reviewer.actor_id:
        raise HTTPException(status_code=401, detail="reviewer_actor_required")
    result = await handler.resolve(
        ResolveHandoffCommand(
            tenant_id=reviewer.tenant_id,
            family_id=family_id,
            handoff_id=handoff_id,
            actor_id=reviewer.actor_id,
            resolution=body.resolution,
            note=body.note,
        )
    )
    return ResolveHandoffResponse(ok=result.ok, released_response=result.released_response)
