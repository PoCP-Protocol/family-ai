"""In-memory `FamilyContextPort` for unit tests and for callers (e.g.
Assessment domain tests) that need a family context dependency without a
DB — same role as
`domains/assessment/infrastructure/fake_ai_run_ledger.py`'s
`FakeAiRunLedger` and `fake_repository.py`'s fakes for
`AssessmentRepositoryPort`.
"""
from __future__ import annotations

from ..application.ports import FamilyContextPort
from ..domain.entities import ContextEntry


class FakeFamilyContextRepository(FamilyContextPort):
    def __init__(self, entries: list[ContextEntry] | None = None):
        self.entries: list[ContextEntry] = list(entries or [])

    async def get_recent_context(self, family_id: str, limit: int = 20) -> list[ContextEntry]:
        matching = [entry for entry in self.entries if entry.family_id == family_id]
        matching.sort(key=lambda entry: entry.recorded_at, reverse=True)
        return matching[:limit]
