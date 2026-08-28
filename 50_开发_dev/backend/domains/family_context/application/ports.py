"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Follows the same Protocol-based boundary as
`domains/assessment/application/ports.py` (`AssessmentInterpretationPort`,
`AiRunLedgerPort`): the domain never imports SQLAlchemy directly.

`FamilyContextPort` is deliberately the smallest useful surface: "what did
this family say or do recently, across sessions" — a plain time-ordered
read, no ranking/relevance scoring, no embeddings. See
`architecture/notes/family-context-p0-design.md` for what is out of scope
and why.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.entities import ContextEntry


class FamilyContextPort(Protocol):
    """Cross-session family memory read. Any caller (Assessment domain,
    Principal, a future orchestration layer) that needs to know "what has
    this family told us / what has happened before" depends on this
    Protocol, not on a concrete repository — mirrors how
    `AssessmentInterpretationPort` decouples the assessment domain from any
    specific AI provider.
    """

    async def get_recent_context(self, family_id: str, limit: int = 20) -> list[ContextEntry]: ...
