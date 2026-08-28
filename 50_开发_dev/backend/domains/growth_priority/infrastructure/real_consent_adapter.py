"""Real Consent adapter -- satisfies this domain's local `ConsentCheckPort`
(application/ports.py) by delegating to the real Consent domain's
`ConsentQueryPort` (`backend/domains/consent/application/queries.py`).

This is the "once the real Consent domain exists" adapter the
`ConsentCheckPort` docstring anticipated -- no change to
`application/commands.py` or the Protocol itself, only this new adapter.
`FakeConsentCheckPort` (infrastructure/fake_consent_port.py) remains the
unit-test double; this class is what a FastAPI dependency wires up instead,
once GrowthPriority moves off Fakes.
"""
from __future__ import annotations

from domains.consent.application.ports import ConsentQueryPort


class RealConsentCheckAdapter:
    """Thin adapter: `ConsentCheckPort.assert_required_growth_consents` takes
    no `required_purposes` argument (the GrowthPriority domain always wants
    the Consent domain's own default three-purpose set -- SERVICE,
    ASSESSMENT, GROWTH_TRACKING -- it has no opinion of its own), so this
    adapter simply omits that optional parameter on the delegate call.
    """

    def __init__(self, consent_query: ConsentQueryPort):
        self._consent_query = consent_query

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        await self._consent_query.assert_required_growth_consents(family_id, subject_person_id)
