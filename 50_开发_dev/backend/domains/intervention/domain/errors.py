"""Domain errors — the `application`/`api` layers map these to HTTP status
codes (400/403/404/409), mirroring the NestJS exception types used in
`intervention.service.ts` / `growth-action.service.ts`
(BadRequestException/ForbiddenException/NotFoundException/ConflictException).
Keeping the same error-code strings (`intervention_*`, `growth_action_*`,
`active_growth_priority_not_found`, etc.) preserves API-observable behavior
across the port.

One documented inconsistency, ported verbatim (see
`architecture/notes/batch2-domain-research-v1.md` section 5.3 point 1):
`assertCompletableGrowthActionStatus` in the NestJS source raises a plain
`Error`, not a typed HTTP exception, unlike every other validation site in
these two services. We still map it to `InterventionValidationError` here —
FastAPI needs *some* status code — but the code string
(`growth_action_completion_status_invalid`) is preserved and this docstring
records the source inconsistency rather than silently normalizing it away.
"""
from __future__ import annotations


class InterventionDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class InterventionValidationError(InterventionDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class InterventionForbiddenError(InterventionDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites."""


class InterventionNotFoundError(InterventionDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class InterventionConflictError(InterventionDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites."""
