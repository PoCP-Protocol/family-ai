"""Ports (interfaces) the application layer depends on -- implemented by
`infrastructure/`. Domain code never imports SQLAlchemy/FastAPI directly; it
depends on these Protocols instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3. Mirrors
`AssessmentRepositoryPort` in `backend/domains/assessment/application/ports.py`.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.value_objects import ConsentPurpose


class ConsentRepositoryPort(Protocol):
    """One method: fetch the GRANTED purposes for a subject, restricted to a
    candidate purpose set. Mirrors the single SQL statement in
    `assertRequiredGrowthConsents` (`consent-guard.ts`):

        select purpose from consents
        where family_id=$1 and subject_person_id=$2
          and purpose = any($3::consent_purpose[]) and status='GRANTED'
        for share

    Returning the granted set (not a bool) keeps the pass/fail decision in
    the pure domain policy (`assert_required_growth_consents_from_granted`),
    same domain/infrastructure split as the rest of this migration.
    """

    async def load_granted_purposes(
        self, family_id: str, subject_person_id: str, candidate_purposes: tuple[ConsentPurpose, ...]
    ) -> set[ConsentPurpose]: ...


class ConsentQueryPort(Protocol):
    """The cross-cutting capability other Python domains (Family /
    GrowthIntent / GrowthPlan / Intervention / Action / GrowthReview) will
    depend on once they exist -- the Python-side equivalent of the 6 NestJS
    services that each `import { assertRequiredGrowthConsents } from
    '.../consent-guard'` and call it before a state-changing Named Action.

    Fail-closed by design: `assert_required_growth_consents` raises on any
    missing required purpose and returns `None` on success. It deliberately
    does NOT return a bool for the caller to branch on -- a caller that
    forgets to check a bool return value is a latent bypass; a caller that
    forgets to catch an exception it doesn't expect is not, because the
    exception propagates and the write never happens. This is the same
    fail-closed contract as NestJS's `ForbiddenException` throw in
    `consent-guard.ts`.
    """

    async def assert_required_growth_consents(
        self,
        family_id: str,
        subject_person_id: str,
        required_purposes: tuple[ConsentPurpose, ...] | None = None,
    ) -> None: ...
