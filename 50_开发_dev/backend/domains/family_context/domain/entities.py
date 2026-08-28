"""Domain entities for the Family Context P0 read layer.

See `architecture/notes/family-context-p0-design.md` for the design
rationale. This module intentionally defines a single, small entity —
`ContextEntry` — representing one row of "something this family said or
did," sourced from the EXISTING `perspectives` / `evidence_records` tables
(no new storage). It carries only what a caller needs to decide whether
this piece of context is relevant and how much to trust it; it does not
attempt to model perspectives/evidence as first-class domain concepts the
way `domains/assessment/domain/entities.py` does for its own tables — this
domain is a read-only, cross-domain projection over tables another domain
(growth/assessment) already owns.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ContextEntrySource = Literal["perspective", "evidence"]


@dataclass(frozen=True)
class ContextEntry:
    """One retrievable unit of family memory.

    `fact_boundary` mirrors the `perspectives.fact_boundary` column
    (default `PERSPECTIVE_NOT_FACT`, see
    `database/migrations/0006_perspective_evidence_contract_alignment.sql`)
    for `source == "perspective"` rows; for `source == "evidence"` rows it
    is always `None` — evidence_records are not statements someone made,
    so the perspective/fact boundary label does not apply to them.
    Callers combining entries from both sources into a prompt or a UI
    surface MUST preserve this distinction rather than treating everything
    as one undifferentiated "memory" blob — that boundary is the whole
    point of the underlying schema (see 0006's docstring on Perspective vs
    Evidence contract alignment).
    """

    entry_id: str
    family_id: str
    source: ContextEntrySource
    recorded_at: datetime
    summary: str
    fact_boundary: str | None
    raw: dict
