"""Consent domain entities.

Ported from the `consents` table row shape
(`database/migrations/0001_family_identity.sql` +
`0005_consent_active_uniqueness.sql`), as read by
`assertRequiredGrowthConsents`
(`apps/api/src/modules/family/consent-guard.ts`) and by
`FamilyService.grantConsent` (`family.service.ts`, per
`architecture/notes/batch2-domain-research-v1.md` section 2.2).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .value_objects import ConsentPurpose, ConsentStatus


class Consent(BaseModel):
    consent_id: str
    family_id: str
    subject_person_id: str
    guardian_person_id: str
    purpose: ConsentPurpose
    status: ConsentStatus
    policy_version: str
    granted_at: datetime
    withdrawn_at: datetime | None = None
    created_at: datetime | None = None

    def is_active(self) -> bool:
        return self.status == ConsentStatus.GRANTED
