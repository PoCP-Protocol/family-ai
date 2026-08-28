"""Domain errors — the `application`/`api` layers map these to HTTP status
codes (400/403/404/409), mirroring the Nest exception types used in
`family.service.ts` (BadRequestException/ForbiddenException/
NotFoundException/ConflictException). Keeping the same error-code strings
(`family_*`, `person_not_found`, `relationship_*`, `life_stage_*`, ...)
preserves API-observable behavior across the port.
"""
from __future__ import annotations


class FamilyDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class FamilyValidationError(FamilyDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class FamilyForbiddenError(FamilyDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites."""


class FamilyNotFoundError(FamilyDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class FamilyConflictError(FamilyDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites."""
