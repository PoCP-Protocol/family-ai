"""Domain errors — the `application`/`api` layers map these to HTTP status
codes (400/403/404/409), mirroring the Nest exception types used in
`growth-review.service.ts` (BadRequestException/ForbiddenException/
NotFoundException/ConflictException). Keeping the same error-code strings
(`outcome_*`, `growth_review_*`, `next_step_decision_*`, plus the shared
`growth_subject_*` / `normal_safety_route_*` / `missing_required_consent`
codes reused across Batch 2 domains) preserves API-observable behavior
across the port.
"""
from __future__ import annotations


class OutcomeDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class OutcomeValidationError(OutcomeDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites."""


class OutcomeForbiddenError(OutcomeDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites."""


class OutcomeNotFoundError(OutcomeDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites."""


class OutcomeConflictError(OutcomeDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites."""
