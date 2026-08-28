"""Domain errors for the GrowthPlan (JourneyPlan) domain — the
`application`/`api` layers map these to HTTP status codes (400/403/404/409),
mirroring the NestJS exception types used in `journey-plan.service.ts`
(BadRequestException/ForbiddenException/NotFoundException/ConflictException).
Keeping the same error-code strings (`journey_plan_*`, `active_growth_*`,
`journey_phase_*`) preserves API-observable behavior across the port.
"""
from __future__ import annotations


class GrowthPlanDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class GrowthPlanValidationError(GrowthPlanDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class GrowthPlanForbiddenError(GrowthPlanDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites."""


class GrowthPlanNotFoundError(GrowthPlanDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class GrowthPlanConflictError(GrowthPlanDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites."""
