"""Value objects for the GrowthPlan (JourneyPlan) domain.

Ported from `journey-plan.service.ts` (per
`architecture/notes/batch2-domain-research-v1.md` section 3.4) — the 90-day
JourneyPlan state machine. This module has no FastAPI / SQLAlchemy
dependency, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.

Scope of this port (per the task): createPlan, pausePlan, reviewCurrentPhase.
confirmPlan / getActiveProjection / refreshJourneyPlanExecution are out of
scope for this batch and are not ported here.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal


class JourneyPlanStatus(str, Enum):
    """Port of `family_journey_plans.status`. Research note 3.4: DRAFT ->
    ACTIVE -> COMPLETED, or ACTIVE -> PAUSED. PAUSED has no code path back
    to ACTIVE (no resume method exists in the source implementation).
    """

    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class JourneyPhaseStatus(str, Enum):
    """Port of `family_journey_plan_phases.status`. Research note 3.4:
    PENDING -> ACTIVE -> REVIEW_DUE -> COMPLETED, or ACTIVE -> REVIEW_DUE ->
    BLOCKED (when reviewCurrentPhase's decision is not CONTINUE).
    """

    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REVIEW_DUE = "REVIEW_DUE"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class JourneyPhaseName(str, Enum):
    SEE = "SEE"
    PARENT_FIRST = "PARENT_FIRST"
    CO_CREATE = "CO_CREATE"
    STABILIZE = "STABILIZE"


# Port of the code constant `PHASE_DEFINITIONS` in journey-plan.service.ts —
# not database-driven, per the research note. (name, start_day, review_due_day).
PHASE_DEFINITIONS: tuple[tuple[JourneyPhaseName, int, int], ...] = (
    (JourneyPhaseName.SEE, 1, 14),
    (JourneyPhaseName.PARENT_FIRST, 15, 35),
    (JourneyPhaseName.CO_CREATE, 36, 60),
    (JourneyPhaseName.STABILIZE, 61, 90),
)

TOTAL_PLAN_DAYS = 90

# Port of the per-phase `focus_dimensions` assignment rule in section 3.4
# step 7: SEE/STABILIZE inherit the active priority's dimension; the two
# middle phases are fixed regardless of priority.
FIXED_PHASE_FOCUS_DIMENSIONS: dict[JourneyPhaseName, tuple[str, ...]] = {
    JourneyPhaseName.PARENT_FIRST: ("P03", "R03"),
    JourneyPhaseName.CO_CREATE: ("R04", "R05"),
}

ReviewDecision = Literal["CONTINUE", "ADJUST"]

# Port of the fixed boundary strings this domain must never drop, mirroring
# the family-perspective / not-a-diagnosis style boundaries used throughout
# Batch 1 (Assessment). GrowthIntent confirmation upstream already carries
# HUMAN_CONFIRMED_INTENT_NOT_OUTCOME; a JourneyPlan is a human-confirmed
# practice plan, not an automatically graded outcome.
JOURNEY_PLAN_BOUNDARY: Literal["HUMAN_CONFIRMED_PLAN_NOT_OUTCOME"] = "HUMAN_CONFIRMED_PLAN_NOT_OUTCOME"

MUTATION_RECEIPT_BOUNDARY: Literal["HUMAN_CONFIRMED_PLAN_NOT_OUTCOME"] = JOURNEY_PLAN_BOUNDARY
