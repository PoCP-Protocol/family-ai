"""Domain errors — the `application`/`api` layers map these to HTTP status
codes (400/403/404/409), mirroring the Nest exception types used in
`growth-priority.service.ts` (BadRequestException/ForbiddenException/
NotFoundException/ConflictException). Keeping the same error-code strings
(`growth_priority_*`, `active_growth_onboarding_not_found`,
`normal_safety_route_not_verified`, `growth_subject_*`,
`growth_consent_*`, ...) preserves API-observable behavior across the port.
"""
from __future__ import annotations


class GrowthPriorityDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class GrowthPriorityValidationError(GrowthPriorityDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class GrowthPriorityForbiddenError(GrowthPriorityDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites (includes the
    safety-route gate — `normal_safety_route_not_verified` — and any consent
    gate outcome ported from `assertRequiredGrowthConsents`)."""


class GrowthPriorityNotFoundError(GrowthPriorityDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class GrowthPriorityConflictError(GrowthPriorityDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites (stale draft,
    decision/candidate mismatch, active intervention episode, subject
    resolution ambiguity, illegal status transition)."""
