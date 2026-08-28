"""Real Consent adapter for the Intervention domain.

Unlike GrowthPriority (which declares a standalone `ConsentCheckPort`),
`InterventionRepositoryPort.assert_required_growth_consents` is one method
on the domain's single repository Protocol -- there is no separate
Consent-only seam to substitute. This mixin exists so a future real
`InterventionRepository` (SQLAlchemy-backed) can compose it in rather than
re-implementing the consent check inline: `class SqlAlchemyInterventionRepository(RealConsentMixin, ...)`.
"""
from __future__ import annotations

from domains.consent.application.ports import ConsentQueryPort


class RealConsentMixin:
    """Provides `assert_required_growth_consents` by delegating to the real
    Consent domain. A concrete repository composing this mixin must set
    `self._consent_query: ConsentQueryPort` (e.g. in `__init__`).
    """

    _consent_query: ConsentQueryPort

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        await self._consent_query.assert_required_growth_consents(family_id, subject_person_id)
