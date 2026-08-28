"""FastAPI routes -- port of the Family-related endpoints in
`family.controller.ts`:
  POST :families
  POST :familyId/parents
  POST :familyId/children
  POST :familyId/relationships
  POST :familyId/life-stage-assignments

Domain errors (`FamilyDomainError` subclasses) are NOT caught here -- they
propagate to the app-level exception handler registered in
`register_exception_handlers()` below, per FastAPI's recommended pattern.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from ..application.commands import (
    AddChildCommand,
    AddParentCommand,
    AssignLifeStageCommand,
    CreateFamilyCommand,
    CreateRelationshipCommand,
    FamilyCommandHandler,
    MutationMeta,
)
from ..domain.errors import FamilyConflictError, FamilyDomainError, FamilyForbiddenError, FamilyNotFoundError, FamilyValidationError
from .dependencies import FamilyContext, get_command_handler, get_family_context
from .requests import (
    AddChildRequestBody,
    AddParentRequestBody,
    AssignLifeStageRequestBody,
    CreateFamilyRequestBody,
    CreateRelationshipRequestBody,
)
from .responses import FamilyMutationReceiptResponse

router = APIRouter()

_ERROR_STATUS = {
    FamilyValidationError: 400,
    FamilyForbiddenError: 403,
    FamilyNotFoundError: 404,
    FamilyConflictError: 409,
}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(FamilyDomainError)
    async def _handle_family_domain_error(request, error: FamilyDomainError) -> JSONResponse:
        status_code = _ERROR_STATUS.get(type(error), 400)
        return JSONResponse(status_code=status_code, content={"detail": error.code})


def _meta(context: FamilyContext, correlation_id: str | None, idempotency_key: str | None) -> MutationMeta:
    return MutationMeta(actor=context.person_id, correlation_id=correlation_id or "", idempotency_key=idempotency_key or "")


@router.post("/families", responses={200: {"model": FamilyMutationReceiptResponse}})
async def create_family(
    body: CreateFamilyRequestBody,
    context: FamilyContext = Depends(get_family_context),
    handler: FamilyCommandHandler = Depends(get_command_handler),
    x_correlation_id: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
) -> dict:
    meta = _meta(context, x_correlation_id, idempotency_key)
    return await handler.create_family(CreateFamilyCommand(body.display_name, body.primary_contact_account_id, meta))


@router.post("/{family_id}/parents", responses={200: {"model": FamilyMutationReceiptResponse}})
async def add_parent(
    family_id: str,
    body: AddParentRequestBody,
    context: FamilyContext = Depends(get_family_context),
    handler: FamilyCommandHandler = Depends(get_command_handler),
    x_correlation_id: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
) -> dict:
    if context.family_id != family_id:
        raise HTTPException(status_code=401, detail="real_family_session_required")
    meta = _meta(context, x_correlation_id, idempotency_key)
    return await handler.add_parent(AddParentCommand(family_id, body.role, body.display_name, body.account_id, meta))


@router.post("/{family_id}/children", responses={200: {"model": FamilyMutationReceiptResponse}})
async def add_child(
    family_id: str,
    body: AddChildRequestBody,
    context: FamilyContext = Depends(get_family_context),
    handler: FamilyCommandHandler = Depends(get_command_handler),
    x_correlation_id: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
) -> dict:
    if context.family_id != family_id:
        raise HTTPException(status_code=401, detail="real_family_session_required")
    meta = _meta(context, x_correlation_id, idempotency_key)
    return await handler.add_child(AddChildCommand(family_id, body.display_name, body.birth_date, meta))


@router.post("/{family_id}/relationships", responses={200: {"model": FamilyMutationReceiptResponse}})
async def create_relationship(
    family_id: str,
    body: CreateRelationshipRequestBody,
    context: FamilyContext = Depends(get_family_context),
    handler: FamilyCommandHandler = Depends(get_command_handler),
    x_correlation_id: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
) -> dict:
    if context.family_id != family_id:
        raise HTTPException(status_code=401, detail="real_family_session_required")
    meta = _meta(context, x_correlation_id, idempotency_key)
    return await handler.create_relationship(
        CreateRelationshipCommand(family_id, body.person_a_id, body.person_b_id, body.relationship_type, meta)
    )


@router.post("/{family_id}/life-stage-assignments", responses={200: {"model": FamilyMutationReceiptResponse}})
async def assign_life_stage(
    family_id: str,
    body: AssignLifeStageRequestBody,
    context: FamilyContext = Depends(get_family_context),
    handler: FamilyCommandHandler = Depends(get_command_handler),
    x_correlation_id: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
) -> dict:
    if context.family_id != family_id:
        raise HTTPException(status_code=401, detail="real_family_session_required")
    meta = _meta(context, x_correlation_id, idempotency_key)
    return await handler.assign_life_stage(
        AssignLifeStageCommand(family_id, body.child_id, body.life_stage_code, body.effective_from, meta, body.source)
    )
