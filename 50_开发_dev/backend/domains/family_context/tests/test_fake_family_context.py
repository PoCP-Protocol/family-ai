"""Unit tests for `FakeFamilyContextRepository` — verifies the P0 contract
of `FamilyContextPort.get_recent_context`: family-scoped, newest-first,
limit-bounded, no cross-family leakage. Mirrors the style of
`domains/assessment/tests/test_ai_run_ledger.py` (fake-backed, no DB).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from domains.family_context.domain.entities import ContextEntry
from domains.family_context.infrastructure.fake_family_context import FakeFamilyContextRepository


def _entry(entry_id: str, family_id: str, minutes_ago: int, source: str = "perspective") -> ContextEntry:
    now = datetime(2026, 8, 28, 12, 0, 0, tzinfo=timezone.utc)
    return ContextEntry(
        entry_id=entry_id,
        family_id=family_id,
        source=source,
        recorded_at=now - timedelta(minutes=minutes_ago),
        summary=f"entry-{entry_id}",
        fact_boundary="PERSPECTIVE_NOT_FACT" if source == "perspective" else None,
        raw={},
    )


class TestFakeFamilyContext:
    async def test_returns_entries_newest_first(self):
        repo = FakeFamilyContextRepository(
            [
                _entry("old", "family-1", minutes_ago=100),
                _entry("new", "family-1", minutes_ago=1),
                _entry("mid", "family-1", minutes_ago=50),
            ]
        )

        result = await repo.get_recent_context("family-1")

        assert [entry.entry_id for entry in result] == ["new", "mid", "old"]

    async def test_scoped_to_requested_family_only(self):
        repo = FakeFamilyContextRepository(
            [
                _entry("mine", "family-1", minutes_ago=1),
                _entry("other-family", "family-2", minutes_ago=1),
            ]
        )

        result = await repo.get_recent_context("family-1")

        assert [entry.entry_id for entry in result] == ["mine"]

    async def test_respects_limit(self):
        repo = FakeFamilyContextRepository(
            [_entry(f"e{i}", "family-1", minutes_ago=i) for i in range(30)]
        )

        result = await repo.get_recent_context("family-1", limit=5)

        assert len(result) == 5
        assert [entry.entry_id for entry in result] == ["e0", "e1", "e2", "e3", "e4"]

    async def test_no_entries_returns_empty_list(self):
        repo = FakeFamilyContextRepository()

        result = await repo.get_recent_context("family-none")

        assert result == []

    async def test_preserves_source_and_fact_boundary_distinction(self):
        repo = FakeFamilyContextRepository(
            [
                _entry("p1", "family-1", minutes_ago=1, source="perspective"),
                _entry("e1", "family-1", minutes_ago=2, source="evidence"),
            ]
        )

        result = await repo.get_recent_context("family-1")

        by_id = {entry.entry_id: entry for entry in result}
        assert by_id["p1"].fact_boundary == "PERSPECTIVE_NOT_FACT"
        assert by_id["e1"].fact_boundary is None
