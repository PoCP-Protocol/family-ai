"""Value objects for the GrowthPriority domain (Batch 2, GrowthIntent/GrowthPlan
research draft object (A) in
`architecture/notes/batch2-domain-research-v1.md` section 3 — the
`growth_priorities` table / `confirmGrowthPriority` method of
`growth-priority.service.ts`). No FastAPI / SQLAlchemy dependency, per the
four-layer rule in `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 3.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel

# Port of the four dimension_id values the `growth_priorities` table column
# is constrained to (research doc section 3.3).
GrowthPriorityDimensionId = Literal["P03", "R03", "R04", "R05"]
GROWTH_PRIORITY_DIMENSION_IDS: tuple[GrowthPriorityDimensionId, ...] = ("P03", "R03", "R04", "R05")

GrowthPriorityDecisionType = Literal["P03", "R03", "R04", "R05", "NO_PRIORITY_YET"]

PRIORITY_BOUNDARY: Literal["PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS"] = (
    "PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS"
)


class GrowthPriorityStatus(str, Enum):
    """Port of the `growth_priorities.status` column — limited to `ACTIVE`
    or `SUPERSEDED` (research doc section 3.3). A row never transitions back
    from `SUPERSEDED` to `ACTIVE`; a new confirmation always inserts a new
    row and supersedes the previous ACTIVE one (version chain via
    `previous_priority_id`).
    """

    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"


class SafetyDisposition(str, Enum):
    """Port of the `disposition` field checked by `assertNormalSafetyRoute`
    (research doc section 7.2) — only `NORMAL` allows Growth-domain writes.
    """

    NORMAL = "NORMAL"
    SAFETY_ESCALATION = "SAFETY_ESCALATION"


class SafetySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class GrowthSubject(BaseModel):
    """Port of `GrowthSubjectResolver.resolve`'s return shape (research doc
    section 7.1) -- the resolved child plus their guardian set. Shared shape
    across growth_priority/intervention/outcome so `resolve_growth_subject`
    return types don't diverge per domain (previously: growth_priority
    returned a bare `str`, intervention a `dict`, outcome a
    `tuple[str, set[str]]` -- three incompatible shapes for the same
    cross-cutting resolver). `frozenset` guards against a caller
    accidentally mutating a shared guardian set.
    """

    child_person_id: str
    guardian_person_ids: frozenset[str]
