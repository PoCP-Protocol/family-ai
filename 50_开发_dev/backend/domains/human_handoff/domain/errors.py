"""Domain errors — the `application`/`api` layers map these to HTTP status
codes (400/403/404/409), mirroring the Nest exception types used around the
handoff flow in `principal.service.ts`/`principal.controller.ts`
(BadRequestException/ForbiddenException/NotFoundException/ConflictException).
Keeping stable error-code strings preserves API-observable behavior across
the port.
"""
from __future__ import annotations


class HumanHandoffDomainError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class HumanHandoffValidationError(HumanHandoffDomainError):
    """-> HTTP 400, port of NestJS BadRequestException sites (e.g. missing
    resolution / missing actor)."""


class HumanHandoffForbiddenError(HumanHandoffDomainError):
    """-> HTTP 403, port of NestJS ForbiddenException sites (tenant/family
    scope denial). The reviewer-authorization gate itself (`assertReviewer`)
    lives in the NestJS controller/auth layer, not the domain — see the
    resolve command docstring."""


class HumanHandoffNotFoundError(HumanHandoffDomainError):
    """-> HTTP 404, port of NestJS NotFoundException sites (handoff does not
    exist for this family)."""


class HumanHandoffConflictError(HumanHandoffDomainError):
    """-> HTTP 409, port of NestJS ConflictException sites. Raised on an
    illegal state-machine transition (e.g. attempting to release a handoff
    that was never RESOLVED/APPROVED, or a resolve/release combination the
    explicit transition table forbids)."""
