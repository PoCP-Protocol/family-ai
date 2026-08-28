"""Intervention + Action domain policies.

Ports of `intervention.policy.ts` (static card content, 7-day assignment
builder) and `growth-action.policy.ts` (completion-status whitelist) plus
the `assertExecutionTransition` function inlined in
`growth-action.service.ts`. See
`architecture/notes/batch2-domain-research-v1.md` sections 4.2, 4.3, 5.2,
5.3 for the source fact-finding this is a straight translation of.
"""
from __future__ import annotations

from datetime import date, timedelta

from .errors import InterventionConflictError, InterventionValidationError
from .value_objects import (
    COMPLETABLE_STATUSES,
    EXECUTION_TERMINAL_STATES,
    EXECUTION_TRANSITIONS,
    LISTEN_BEFORE_RESPOND_ASSIGNMENTS,
    PLANNED_DAYS,
    CompletionStatus,
    ExecutionAction,
    ExecutionStatus,
)


def get_intervention_card() -> dict:
    """Port of `getInterventionCard` — a static card, content hardcoded in
    `intervention.policy.ts`. Takes no family-specific data because none is
    used by the NestJS source (the card is identical for every family).
    """
    return {
        "intervention_code": "LISTEN_BEFORE_RESPOND",
        "title": "先听，再回应",
        "summary": "连续 7 天的小练习：在回应孩子之前，先完整地听。",
        "planned_days": PLANNED_DAYS,
        "policy_version": "M2_105_DETERMINISTIC_V1",
    }


def build_growth_action_assignments(started_at: date) -> list[dict]:
    """Port of `buildGrowthActionAssignments(startedAt)` — day_index 1..7,
    due_date = started_at + (day_index - 1) calendar days (UTC calendar day
    arithmetic, matching the NestJS source), assignment_text pulled from the
    fixed `LISTEN_BEFORE_RESPOND_ASSIGNMENTS` array by position.
    """
    return [
        {
            "day_index": day_index,
            "due_date": started_at + timedelta(days=day_index - 1),
            "assignment_text": LISTEN_BEFORE_RESPOND_ASSIGNMENTS[day_index - 1],
        }
        for day_index in range(1, PLANNED_DAYS + 1)
    ]


def assert_completable_growth_action_status(completion_status: str) -> None:
    """Port of `assertCompletableGrowthActionStatus` (growth-action.policy.ts).

    SOURCE INCONSISTENCY (ported as fact, not corrected): the NestJS
    function raises a plain `Error`, not a typed `BadRequestException`,
    unlike every other validation call site in `growth-action.service.ts`.
    We raise `InterventionValidationError` here (this Python port needs one
    error taxonomy the api layer can map to a status code), but the code
    string is preserved and this inconsistency is documented rather than
    silently normalized.
    """
    if completion_status not in COMPLETABLE_STATUSES:
        raise InterventionValidationError("growth_action_completion_status_invalid")


def assert_execution_transition(current: ExecutionStatus, action: ExecutionAction) -> ExecutionStatus:
    """Port of `assertExecutionTransition` — returns the next
    `execution_status` for the given current status + action, or raises
    `task_transition_not_allowed` (409) if the pair is not in the map.
    Terminal states (COMPLETED/PARTIAL/NOT_COMPLETED/CANCELLED) never have
    an entry in `EXECUTION_TRANSITIONS`, so they fall through to the
    conflict branch — same behavior as the NestJS source, not a special
    case coded separately here.
    """
    allowed = EXECUTION_TRANSITIONS.get(current, {})
    next_status = allowed.get(action)
    if next_status is None:
        raise InterventionConflictError(f"task_transition_not_allowed:{current.value}:{action}")
    return next_status


def is_execution_terminal(status: ExecutionStatus) -> bool:
    return status in EXECUTION_TERMINAL_STATES
