"""Domain errors -- the `application`/`api` layers map these to HTTP status
codes, mirroring the NestJS exception types used by
`assertRequiredGrowthConsents` (`apps/api/src/modules/family/consent-guard.ts`)
and `FamilyService.grantConsent` (`family.service.ts`)
(ForbiddenException/BadRequestException/NotFoundException/ConflictException).
Keeping the same error-code strings preserves API-observable behavior across
the port -- see `AssessmentDomainError` in the Assessment domain
(`backend/domains/assessment/domain/errors.py`) for the same pattern.
"""
from __future__ import annotations


class ConsentDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ConsentValidationError(ConsentDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class ConsentForbiddenError(ConsentDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites -- this is the
    error family `assert_required_growth_consents` raises: fail-closed,
    same as `ForbiddenException('missing_required_consent:<...>')` in
    `consent-guard.ts`.
    """


class ConsentNotFoundError(ConsentDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class ConsentConflictError(ConsentDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites (e.g.
    `consent_already_granted` in `FamilyService.grantConsent`).
    """
