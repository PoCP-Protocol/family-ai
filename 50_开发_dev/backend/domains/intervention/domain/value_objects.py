"""Value objects for the Intervention + Action domain.

Ported from `intervention.service.ts` / `intervention.policy.ts` /
`growth-action.service.ts` / `growth-action.policy.ts` and the
`intervention_episodes` / `growth_actions` table constraints (migrations
0003/0008/0020/0035/0036/0042). See
`architecture/notes/batch2-domain-research-v1.md` sections 4 and 5 for the
underlying NestJS fact-finding this module is a straight translation of.
This module has no FastAPI / SQLAlchemy dependency — see
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel

# The platform currently defines exactly one intervention (seed row
# `INTERVENTION-001` in migration 0020) and hardcodes its code as a literal
# string comparison in both the NestJS DTO and service layer — not an enum
# lookup. Ported verbatim, including the single-value restriction.
INTERVENTION_ID = "INTERVENTION-001"
INTERVENTION_CODE: Literal["LISTEN_BEFORE_RESPOND"] = "LISTEN_BEFORE_RESPOND"
PLANNED_DAYS = 7
POLICY_VERSION: Literal["M2_105_DETERMINISTIC_V1"] = "M2_105_DETERMINISTIC_V1"

# `getActivePriorityForStart` hardcodes dimension_id == "R03" — P03/R04/R05
# priorities cannot start this intervention. Ported verbatim as a fact, not
# a design choice we are free to relax.
SUPPORTED_PRIORITY_DIMENSION = "R03"

ACTION_TYPE_LISTEN_BEFORE_RESPOND_DAILY = "LISTEN_BEFORE_RESPOND_DAILY_ACTION"

# Port of `intervention.policy.ts` LISTEN_BEFORE_RESPOND_ASSIGNMENTS — fixed
# 7-day Chinese copy, day_index 1..7, verbatim placeholder text (the real
# NestJS copy is business content owned by product; this is a faithful
# structural port with representative text, not a re-authoring of the
# curriculum).
LISTEN_BEFORE_RESPOND_ASSIGNMENTS: list[str] = [
    "今天，在孩子说完一句话之前，先不打断，等他说完再回应。",
    "今天，试着先说出你听到的内容，再表达你的看法。",
    "今天，留意一次你想立刻纠正孩子时，先停顿三秒。",
    "今天，用一句话复述孩子刚才说的话，确认你理解对了。",
    "今天，在情绪上来时，先说“我需要一点时间想想”，再回应。",
    "今天，问孩子一个开放式问题，然后只是听，不给建议。",
    "今天，回顾这一周，写下一次你成功先听后回应的时刻。",
]


class InterventionEpisodeStatus(str, Enum):
    """Port of the `intervention_episodes.status` CHECK constraint
    (migration 0020): ACTIVE / COMPLETED / CANCELLED.

    KNOWN DEFECT (documented, not fixed): no code path in the researched
    NestJS surface ever transitions an episode from ACTIVE to COMPLETED or
    CANCELLED. `growth-review.service.ts#completeGrowthReview` only writes
    `growth_reviews`, never `intervention_episodes.status`. An episode that
    is started stays ACTIVE forever. This Python port reproduces that fact
    faithfully — see `application/commands.py` module docstring and
    `architecture/notes/batch2-domain-research-v1.md` section 4.1 for the
    citation. Do not "fix" this without a separate, explicit task.
    """

    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class GrowthActionStatus(str, Enum):
    """Port of the `growth_actions.status` CHECK constraint — the
    business-terminal layer (`completion_status` mirrors this on write).
    ASSIGNED is a pre-PENDING seed state observed in the migration history;
    PENDING is the only status `completeGrowthAction` will accept.
    """

    ASSIGNED = "ASSIGNED"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    NOT_COMPLETED = "NOT_COMPLETED"


CompletionStatus = Literal["COMPLETED", "PARTIAL", "NOT_COMPLETED"]
COMPLETABLE_STATUSES: tuple[CompletionStatus, ...] = ("COMPLETED", "PARTIAL", "NOT_COMPLETED")


class ExecutionStatus(str, Enum):
    """Port of `growth_actions.execution_status` (migration 0042) — the
    finer-grained interaction state machine, distinct from `status`/
    `completion_status`. Terminal states: COMPLETED, PARTIAL,
    NOT_COMPLETED, CANCELLED.
    """

    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    NOT_COMPLETED = "NOT_COMPLETED"
    CANCELLED = "CANCELLED"


ExecutionAction = Literal["START", "PAUSE", "RESUME", "CANCEL"]

# Port of `assertExecutionTransition`'s transition map in
# growth-action.service.ts — the exact allowed (current_status -> action)
# pairs. Anything not listed here raises `task_transition_not_allowed`.
EXECUTION_TRANSITIONS: dict[ExecutionStatus, dict[ExecutionAction, ExecutionStatus]] = {
    ExecutionStatus.NOT_STARTED: {
        "START": ExecutionStatus.IN_PROGRESS,
        "CANCEL": ExecutionStatus.CANCELLED,
    },
    ExecutionStatus.IN_PROGRESS: {
        "PAUSE": ExecutionStatus.PAUSED,
        "CANCEL": ExecutionStatus.CANCELLED,
    },
    ExecutionStatus.PAUSED: {
        "RESUME": ExecutionStatus.IN_PROGRESS,
        "CANCEL": ExecutionStatus.CANCELLED,
    },
}

# Terminal execution states — no outgoing transitions permitted.
EXECUTION_TERMINAL_STATES: frozenset[ExecutionStatus] = frozenset(
    {
        ExecutionStatus.COMPLETED,
        ExecutionStatus.PARTIAL,
        ExecutionStatus.NOT_COMPLETED,
        ExecutionStatus.CANCELLED,
    }
)

JourneyPhase = Literal["SEE", "PARENT_FIRST", "CO_CREATE", "STABILIZE"]

REFLECTION_BOUNDARY: Literal["REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME"] = "REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME"
ACTION_BOUNDARY: Literal["ACTION_IS_NOT_OUTCOME"] = "ACTION_IS_NOT_OUTCOME"

# Port of `reflection-safety.policy.ts` — `assertReflectionSafetyRoute`
# (called from `completeGrowthAction` step 5, see
# `architecture/notes/batch2-domain-research-v1.md` sections 5.3 point 5
# and 7.3). Regex-scans `reflection` for 5 sensitive-signal categories and
# raises 403 if the derived disposition isn't NORMAL.
REFLECTION_SAFETY_POLICY_VERSION: Literal["M2_105_REFLECTION_DETERMINISTIC_V1"] = (
    "M2_105_REFLECTION_DETERMINISTIC_V1"
)

ReflectionSafetySignal = Literal["SELF_HARM", "HARM_TO_OTHERS", "ABUSE", "VIOLENCE", "SEVERE_CRISIS"]


class ReflectionSafetyDisposition(BaseModel):
    severity: Literal["LOW", "HIGH", "CRITICAL"]
    disposition: Literal["NORMAL", "SAFETY_ESCALATION"]
    policy_version: Literal["M2_105_REFLECTION_DETERMINISTIC_V1"]
    signals: list[ReflectionSafetySignal]
