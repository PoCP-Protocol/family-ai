"""Value objects for the Outcome domain.

Ported from `growth-review.service.ts` (594 lines) per
`architecture/notes/batch2-domain-research-v1.md` section 5.5/5.6 — no
FastAPI / SQLAlchemy / provider-SDK dependency, per
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from typing import Literal

PerspectiveType = Literal["PARENT_OBSERVATION", "CHILD_OBSERVATION"]

# Port of the fixed CHECK-constrained literal on outcome_observations.boundary.
OBSERVATION_BOUNDARY: Literal["OBSERVATION_IS_NOT_FACT_OR_CAUSAL_EFFECT"] = (
    "OBSERVATION_IS_NOT_FACT_OR_CAUSAL_EFFECT"
)

# Port of the fixed CHECK-constrained literal on growth_reviews.boundary.
REVIEW_BOUNDARY: Literal["REVIEW_IS_NOT_PROFILE_MUTATION_OR_DIAGNOSIS"] = (
    "REVIEW_IS_NOT_PROFILE_MUTATION_OR_DIAGNOSIS"
)

# Port of the fixed CHECK-constrained literal on next_step_decisions.boundary.
NEXT_STEP_DECISION_BOUNDARY: Literal["NEXT_STEP_DECISION_IS_NOT_NEXT_ACTION"] = (
    "NEXT_STEP_DECISION_IS_NOT_NEXT_ACTION"
)

# Port of the fixed literal `getTimeline` stamps on every entry it returns.
TIMELINE_BOUNDARY: Literal["TIMELINE_IS_PROVENANCE_NOT_SCORE_OR_RANKING"] = (
    "TIMELINE_IS_PROVENANCE_NOT_SCORE_OR_RANKING"
)

# growth_reviews.status — DB CHECK only ever allows this one value; there is
# no in-progress intermediate state (a review row is a terminal fact once
# inserted).
REVIEW_STATUS_COMPLETED: Literal["COMPLETED"] = "COMPLETED"

# growth_reviews.dimension_id — CHECK-constrained enum. Only R03 is currently
# reachable end-to-end (Intervention only supports R03, see
# batch2-domain-research-v1.md 4.2), but the column itself allows all four.
DimensionId = Literal["P03", "R03", "R04", "R05"]

NextStepDecisionValue = Literal["CONTINUE", "ADJUST", "PAUSE", "REVIEW_REQUIRED"]

# Port of `buildReviewLimitations`'s fixed vocabulary — a pure rule-derived
# set, no AI involved, mutually-exclusive branches deduplicated into a set.
ReviewLimitation = Literal[
    "MISSING_CHECK_INS",
    "NO_OUTCOME_OBSERVATION",
    "PARENT_OBSERVATION_ONLY",
    "CHILD_OBSERVATION_ONLY",
    "PARENT_CHILD_DIVERGENCE",
]

# Consent purposes required before any Outcome write — port of the
# `assertRequiredGrowthConsents` fixed 3-purpose set, called (per the research
# note) at growth-review.service.ts lines 55 and 83 (recordOutcomeObservation,
# completeGrowthReview). Reused unmodified for this domain's other two writes
# (recordNextStepDecision has no such call in the NestJS source, but
# `assert_required_growth_consents` is exposed here so the Application layer
# can apply it consistently where the research note documents it is checked).
REQUIRED_GROWTH_CONSENT_PURPOSES: tuple[str, ...] = ("SERVICE", "ASSESSMENT", "GROWTH_TRACKING")

TimelineEventType = Literal[
    "INTERVENTION_STARTED",
    "GROWTH_ACTION_COMPLETED",
    "OUTCOME_OBSERVATION_RECORDED",
    "GROWTH_REVIEW_COMPLETED",
    "NEXT_STEP_DECISION_RECORDED",
]
