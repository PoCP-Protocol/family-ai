"""GrowthPriority domain entities.

Ported from the `growth_priorities` table shape and the `buildGrowthPriorityDraft`
candidate shape referenced by `confirmGrowthPriority`
(`apps/api/src/modules/family/growth-priority.service.ts`, see
`architecture/notes/batch2-domain-research-v1.md` sections 3.2/3.3).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .value_objects import (
    PRIORITY_BOUNDARY,
    GrowthPriorityDecisionType,
    GrowthPriorityDimensionId,
    GrowthPriorityStatus,
)


class GrowthPriorityCandidate(BaseModel):
    """One row of the draft candidate list `buildGrowthPriorityDraft` computes
    from `listConfirmedProfiles` — the dimension the draft is proposing as
    the next priority, plus the evidence trail behind it. Not persisted on
    its own; only referenced by `draft_id` inside `GrowthPriorityDraft`.
    """

    dimension_id: GrowthPriorityDimensionId
    reason_codes: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)


class GrowthPriorityDraft(BaseModel):
    """A recomputed-on-read draft — never persisted directly. `draft_id` is a
    freshness token: `confirmGrowthPriority` rejects any request whose
    `draft_id` doesn't match the latest recomputation
    (`growth_priority_draft_stale`, research doc section 3.2 step 6).
    """

    draft_id: str
    onboarding_id: str
    family_id: str
    policy_version: str
    candidate: GrowthPriorityCandidate | None = None


class GrowthPriority(BaseModel):
    """Port of a `growth_priorities` row (research doc section 3.3). Every
    ACTIVE row for a given `(family_id, onboarding_id)` pair is unique by a
    partial index; history is preserved via `previous_priority_id`
    (version chain), never overwritten or deleted.
    """

    priority_id: str
    family_id: str
    profile_id: str
    dimension_id: GrowthPriorityDimensionId
    rank: int
    confirmed_by_actor_id: str
    confirmed_at: datetime
    onboarding_id: str
    status: GrowthPriorityStatus = GrowthPriorityStatus.ACTIVE
    version: int = 1
    boundary: str = PRIORITY_BOUNDARY
    reason_codes: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    policy_version: str = "v1"
    superseded_at: datetime | None = None
    previous_priority_id: str | None = None


class GrowthPriorityDecision(BaseModel):
    """The parent's decision payload for `confirmGrowthPriority` — either a
    concrete dimension pick or `NO_PRIORITY_YET`.
    """

    decision: GrowthPriorityDecisionType
