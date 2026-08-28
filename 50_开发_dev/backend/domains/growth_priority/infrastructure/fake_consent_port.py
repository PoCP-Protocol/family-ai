"""In-memory fake `ConsentCheckPort` — the test double for the local Consent
seam this domain defines (see `application/ports.py` module docstring for
why this domain owns its own narrow Protocol instead of importing a shared
Consent domain package). Fail-closed by default: a `(family_id,
subject_person_id)` pair is only considered consented once explicitly
granted via `grant`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.errors import GrowthPriorityForbiddenError


@dataclass
class FakeConsentCheckPort:
    granted: set[tuple[str, str]] = field(default_factory=set)

    def grant(self, family_id: str, subject_person_id: str) -> None:
        self.granted.add((family_id, subject_person_id))

    def revoke(self, family_id: str, subject_person_id: str) -> None:
        self.granted.discard((family_id, subject_person_id))

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        if (family_id, subject_person_id) not in self.granted:
            raise GrowthPriorityForbiddenError("growth_consent_required")
