"""Consent domain policies.

`assert_required_growth_consents_from_granted` is a byte-for-byte semantic
port of `assertRequiredGrowthConsents`
(`apps/api/src/modules/family/consent-guard.ts`, itself the 2026-08
dedup of 6 previously copy-pasted implementations across
`family.service.ts` / `journey-plan.service.ts` / `intervention.service.ts`
/ `growth-priority.service.ts` / `growth-action.service.ts` /
`growth-review.service.ts` -- see
`architecture/notes/batch2-domain-research-v1.md` section 2.4).

This module holds the *pure* decision (given the set of purposes already
GRANTED for a subject, is the required set satisfied?) -- the SQL fetch
(`select purpose from consents where ... status='GRANTED' for share`) lives
in the repository ports/implementations, same split as
`assert_response_value` (pure) vs. `assert_subject_consent` (repository
method) in the Assessment domain.
"""
from __future__ import annotations

from .errors import ConsentForbiddenError
from .value_objects import REQUIRED_GROWTH_CONSENT_PURPOSES, ConsentPurpose


def assert_required_growth_consents_from_granted(
    granted_purposes: set[ConsentPurpose],
    required_purposes: tuple[ConsentPurpose, ...] = REQUIRED_GROWTH_CONSENT_PURPOSES,
) -> None:
    """Fail-closed: raises `ConsentForbiddenError` if any `required_purposes`
    entry is not in `granted_purposes`. Never returns a bool for the caller
    to interpret -- same behavioral contract as the TS
    `ForbiddenException('missing_required_consent:<comma-joined missing>')`
    throw, not a query the caller branches on.

    Extra granted purposes outside `required_purposes` (e.g. a subject with
    an additional AI_PERSONALIZATION consent) never affect the outcome --
    only the required set is checked, exactly as in the TS `missing`
    computation (`REQUIRED...filter((purpose) => !granted.has(purpose))`).
    """
    missing = [purpose for purpose in required_purposes if purpose not in granted_purposes]
    if missing:
        raise ConsentForbiddenError("missing_required_consent:" + ",".join(purpose.value for purpose in missing))
