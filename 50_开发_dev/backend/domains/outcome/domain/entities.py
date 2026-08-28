"""Outcome domain entities.

Ported from the row shapes read/written by `growth-review.service.ts`
(`recordOutcomeObservation` / `completeGrowthReview` / `recordNextStepDecision`
/ `getTimeline`) and the `outcome_observations` / `growth_reviews` /
`next_step_decisions` table structures (migration 0009), per
`architecture/notes/batch2-domain-research-v1.md` sections 5.5/5.6.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .value_objects import (
    NEXT_STEP_DECISION_BOUNDARY,
    OBSERVATION_BOUNDARY,
    REVIEW_BOUNDARY,
    REVIEW_STATUS_COMPLETED,
    DimensionId,
    NextStepDecisionValue,
    PerspectiveType,
    ReviewLimitation,
    TimelineEventType,
)


class OutcomeObservation(BaseModel):
    """Port of an `outcome_observations` row."""

    observation_id: str
    family_id: str
    subject_person_id: str
    observer_person_id: str
    intervention_episode_id: str
    perspective_type: PerspectiveType
    observation_text: str
    action_refs: list[str] = Field(default_factory=list)
    reflection_refs: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    observed_at: datetime
    boundary: str = OBSERVATION_BOUNDARY
    policy_version: str


class ActionSummary(BaseModel):
    """Port of `buildActionSummary`'s fixed-shape output."""

    total_actions: int
    completed: int
    partial: int
    not_completed: int
    missing: int


class GrowthReview(BaseModel):
    """Port of a `growth_reviews` row."""

    review_id: str
    family_id: str
    onboarding_id: str
    intervention_episode_id: str
    priority_id: str
    dimension_id: DimensionId
    status: str = REVIEW_STATUS_COMPLETED
    action_summary: ActionSummary
    observation_ids: list[str] = Field(default_factory=list)
    limitations: list[ReviewLimitation] = Field(default_factory=list)
    boundary: str = REVIEW_BOUNDARY
    policy_version: str
    completed_by_actor_id: str
    completed_at: datetime


class NextStepDecision(BaseModel):
    """Port of a `next_step_decisions` row."""

    decision_id: str
    family_id: str
    review_id: str
    intervention_episode_id: str
    decision: NextStepDecisionValue
    rationale: str | None
    boundary: str = NEXT_STEP_DECISION_BOUNDARY
    policy_version: str
    decided_by_actor_id: str
    decided_at: datetime


class TimelineEntry(BaseModel):
    """Port of one row of `getTimeline`'s 5-way union — the union's common
    projected shape (`event_type` + `occurred_at` + a free-form `payload`),
    not any one source table's full row.
    """

    event_type: TimelineEventType
    occurred_at: datetime
    payload: dict


class InterventionEpisodeContext(BaseModel):
    """The subset of an `intervention_episodes` row (joined with
    `growth_priorities` for `dimension_id`) that `getEpisode` reads before any
    Outcome write — port of the join in `growth-review.service.ts`'s
    `getEpisode` helper. This is Outcome's read-only view of a fact that is
    owned and written by the Intervention/Action domain (see
    `application/ports.py::InterventionEpisodeReadPort`), not a duplicate of
    that domain's own entity.
    """

    intervention_episode_id: str
    family_id: str
    onboarding_id: str
    priority_id: str
    dimension_id: DimensionId
    status: str
    started_at: datetime
    planned_days: int


class EpisodeActionStatus(BaseModel):
    """Port of one row read by `listEpisodeActionStatuses` — the
    `growth_actions` fields Outcome needs to compute `buildActionSummary` /
    `assertReviewEligible`, again a read-only projection into another
    domain's table.
    """

    action_id: str
    status: str
    completion_status: str | None
    day_index: int
