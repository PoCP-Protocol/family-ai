"""Tests for `assert_required_growth_consents` -- the port of
`assertRequiredGrowthConsents` (`apps/api/src/modules/family/consent-guard.ts`),
which itself is the 2026-08 dedup of 6 previously copy-pasted
implementations (`family.service.ts` / `journey-plan.service.ts` /
`intervention.service.ts` / `growth-priority.service.ts` /
`growth-action.service.ts` / `growth-review.service.ts`) -- see
`architecture/notes/batch2-domain-research-v1.md` sections 0 and 2.4.

Exercises both the pure policy (`domain.policies`, given an already-fetched
granted set) and the `ConsentQueryHandler` (application layer, against the
`FakeConsentRepository` double), same split as the Assessment domain's
`test_family_manage_permission.py`.
"""
from __future__ import annotations

import pytest

from domains.consent.application.queries import ConsentQueryHandler
from domains.consent.domain.errors import ConsentForbiddenError
from domains.consent.domain.policies import assert_required_growth_consents_from_granted
from domains.consent.domain.value_objects import REQUIRED_GROWTH_CONSENT_PURPOSES, ConsentPurpose, ConsentStatus
from domains.consent.infrastructure.fake_repository import FakeConsentRepository

FAMILY_ID = "family-1"
SUBJECT_ID = "subject-1"


def _seed_all_required(repo: FakeConsentRepository) -> None:
    for purpose in REQUIRED_GROWTH_CONSENT_PURPOSES:
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, purpose, ConsentStatus.GRANTED)


class TestPureDomainPolicy:
    """`assert_required_growth_consents_from_granted` -- no repository, no I/O."""

    def test_all_required_purposes_granted_passes(self):
        granted = set(REQUIRED_GROWTH_CONSENT_PURPOSES)

        assert_required_growth_consents_from_granted(granted)  # must not raise

    def test_missing_single_purpose_raises_with_missing_purpose_in_code(self):
        granted = {ConsentPurpose.SERVICE, ConsentPurpose.GROWTH_TRACKING}  # ASSESSMENT missing

        with pytest.raises(ConsentForbiddenError) as exc_info:
            assert_required_growth_consents_from_granted(granted)

        assert exc_info.value.code == "missing_required_consent:ASSESSMENT"

    def test_missing_multiple_purposes_lists_all_in_declared_order(self):
        granted: set[ConsentPurpose] = set()  # nothing granted

        with pytest.raises(ConsentForbiddenError) as exc_info:
            assert_required_growth_consents_from_granted(granted)

        assert exc_info.value.code == "missing_required_consent:SERVICE,ASSESSMENT,GROWTH_TRACKING"

    def test_extra_non_required_purpose_does_not_affect_outcome(self):
        granted = set(REQUIRED_GROWTH_CONSENT_PURPOSES) | {ConsentPurpose.AI_PERSONALIZATION}

        assert_required_growth_consents_from_granted(granted)  # must not raise despite the extra purpose


class TestConsentQueryHandlerAgainstFakeRepository:
    """`ConsentQueryHandler.assert_required_growth_consents` -- fetches from
    the repository port, then delegates to the pure policy. Exercises the
    full application-layer surface other Python domains will call.
    """

    async def test_all_required_purposes_granted_passes(self):
        repo = FakeConsentRepository()
        _seed_all_required(repo)
        handler = ConsentQueryHandler(repo)

        await handler.assert_required_growth_consents(FAMILY_ID, SUBJECT_ID)  # must not raise

    async def test_missing_one_required_purpose_raises_forbidden(self):
        repo = FakeConsentRepository()
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.SERVICE, ConsentStatus.GRANTED)
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.GROWTH_TRACKING, ConsentStatus.GRANTED)
        # ASSESSMENT purpose has no consent row at all.
        handler = ConsentQueryHandler(repo)

        with pytest.raises(ConsentForbiddenError) as exc_info:
            await handler.assert_required_growth_consents(FAMILY_ID, SUBJECT_ID)
        assert exc_info.value.code == "missing_required_consent:ASSESSMENT"

    async def test_non_granted_status_is_treated_as_missing(self):
        """A WITHDRAWN or EXPIRED row for a required purpose must not count
        as satisfying the requirement -- only status='GRANTED' rows do, per
        the `and status = 'GRANTED'` clause in the ported SQL.
        """
        repo = FakeConsentRepository()
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.SERVICE, ConsentStatus.GRANTED)
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.ASSESSMENT, ConsentStatus.EXPIRED)
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.GROWTH_TRACKING, ConsentStatus.WITHDRAWN)
        handler = ConsentQueryHandler(repo)

        with pytest.raises(ConsentForbiddenError) as exc_info:
            await handler.assert_required_growth_consents(FAMILY_ID, SUBJECT_ID)
        assert exc_info.value.code == "missing_required_consent:ASSESSMENT,GROWTH_TRACKING"

    async def test_extra_granted_purpose_outside_required_set_does_not_affect_outcome(self):
        repo = FakeConsentRepository()
        _seed_all_required(repo)
        repo.seed_consent(FAMILY_ID, SUBJECT_ID, ConsentPurpose.RESEARCH, ConsentStatus.GRANTED)
        handler = ConsentQueryHandler(repo)

        await handler.assert_required_growth_consents(FAMILY_ID, SUBJECT_ID)  # must not raise

    async def test_different_subject_does_not_inherit_another_subjects_consents(self):
        repo = FakeConsentRepository()
        _seed_all_required(repo)
        handler = ConsentQueryHandler(repo)

        with pytest.raises(ConsentForbiddenError):
            await handler.assert_required_growth_consents(FAMILY_ID, "other-subject")

    async def test_different_family_does_not_inherit_another_familys_consents(self):
        repo = FakeConsentRepository()
        _seed_all_required(repo)
        handler = ConsentQueryHandler(repo)

        with pytest.raises(ConsentForbiddenError):
            await handler.assert_required_growth_consents("other-family", SUBJECT_ID)
