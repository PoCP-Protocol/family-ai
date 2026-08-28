"""In-memory fake repository -- the test double this domain's unit tests run
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors
`FakeAssessmentRepository` in
`backend/domains/assessment/infrastructure/fake_repository.py`: not
thread-safe / not process-safe by design, a unit-test double rather than a
substitute for the real Postgres-backed repository.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..application.ports import ConsentRepositoryPort
from ..domain.value_objects import ConsentPurpose, ConsentStatus


@dataclass
class FakeConsentRepository(ConsentRepositoryPort):
    # (family_id, subject_person_id, purpose) -> status. One row per
    # (family, subject, purpose) mirrors the real schema's partial unique
    # index `ux_consents_active_subject_purpose` (at most one GRANTED row
    # per (family_id, subject_person_id, purpose) at a time) -- this fake
    # does not model the EXPIRED history, only the current status per key,
    # which is all `load_granted_purposes` ever needs.
    consents: dict[tuple[str, str, ConsentPurpose], ConsentStatus] = field(default_factory=dict)

    def seed_consent(self, family_id: str, subject_person_id: str, purpose: ConsentPurpose, status: ConsentStatus) -> None:
        self.consents[(family_id, subject_person_id, purpose)] = status

    async def load_granted_purposes(
        self, family_id: str, subject_person_id: str, candidate_purposes: tuple[ConsentPurpose, ...]
    ) -> set[ConsentPurpose]:
        return {
            purpose
            for purpose in candidate_purposes
            if self.consents.get((family_id, subject_person_id, purpose)) == ConsentStatus.GRANTED
        }
