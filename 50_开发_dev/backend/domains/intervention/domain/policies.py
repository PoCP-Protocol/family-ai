"""Intervention + Action domain policies.

Ports of `intervention.policy.ts` (static card content, 7-day assignment
builder) and `growth-action.policy.ts` (completion-status whitelist) plus
the `assertExecutionTransition` function inlined in
`growth-action.service.ts`. See
`architecture/notes/batch2-domain-research-v1.md` sections 4.2, 4.3, 5.2,
5.3 for the source fact-finding this is a straight translation of.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from .errors import InterventionConflictError, InterventionForbiddenError, InterventionValidationError
from .value_objects import (
    COMPLETABLE_STATUSES,
    EXECUTION_TERMINAL_STATES,
    EXECUTION_TRANSITIONS,
    LISTEN_BEFORE_RESPOND_ASSIGNMENTS,
    PLANNED_DAYS,
    REFLECTION_SAFETY_POLICY_VERSION,
    CompletionStatus,
    ExecutionAction,
    ExecutionStatus,
    ReflectionSafetyDisposition,
    ReflectionSafetySignal,
)

# Port of `SIGNAL_PATTERNS` in `reflection-safety.policy.ts` — same 5
# signal categories, same regexes, same case-insensitive matching, same
# ordering. This is a deliberate local duplication (not an import) of the
# regex set: `assessStructuredSafetySignals` itself
# (`safety-assessment.policy.ts`) is duplicated per-domain the same way in
# this Python migration (see `assessment/domain/policies.py`), and this
# package has no dependency on the assessment domain's package — see
# `pyproject.toml`. See `architecture/notes/batch2-domain-research-v1.md`
# section 7.3.
_REFLECTION_SIGNAL_PATTERNS: tuple[tuple[ReflectionSafetySignal, re.Pattern[str]], ...] = (
    (
        "SELF_HARM",
        re.compile(
            r"自杀|自伤|伤害自己|不想活|结束生命|轻生|suicid|self[- ]?harm|kill myself",
            re.IGNORECASE,
        ),
    ),
    (
        "HARM_TO_OTHERS",
        re.compile(
            r"杀了他|杀了她|伤害别人|伤害他人|打死|kill (him|her|them)|harm (him|her|them)",
            re.IGNORECASE,
        ),
    ),
    (
        "ABUSE",
        re.compile(r"虐待|性侵|猥亵|侵害孩子|abuse|sexual assault|molest", re.IGNORECASE),
    ),
    (
        "VIOLENCE",
        re.compile(r"家暴|暴力殴打|拿刀|持刀|violent attack|domestic violence", re.IGNORECASE),
    ),
    (
        "SEVERE_CRISIS",
        re.compile(r"活不下去|彻底失控|立即报警|紧急危险|immediate danger|severe crisis", re.IGNORECASE),
    ),
)

# Port of `assessStructuredSafetySignals`'s two escalation tiers, scoped to
# the signal vocabulary this domain actually uses (all 5 reflection signals
# are ESCALATION-tier; SELF_HARM/HARM_TO_OTHERS/SEVERE_CRISIS are the
# CRITICAL subset) — same tiering as `safety-assessment.policy.ts`.
_CRITICAL_REFLECTION_SIGNALS: frozenset[ReflectionSafetySignal] = frozenset(
    {"SELF_HARM", "HARM_TO_OTHERS", "SEVERE_CRISIS"}
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


def assess_reflection_safety(reflection: str) -> ReflectionSafetyDisposition:
    """Port of `assessReflectionSafety` (reflection-safety.policy.ts).

    Regex-scans `reflection` (case-insensitive) against the 5 signal
    categories, then reduces to a disposition using the same
    CRITICAL/ESCALATION/NORMAL tiering `assessStructuredSafetySignals` uses.
    Pure function, no I/O — matches the NestJS source, which is also a
    plain function, not a repository call.
    """
    signals: list[ReflectionSafetySignal] = [
        signal for signal, pattern in _REFLECTION_SIGNAL_PATTERNS if pattern.search(reflection)
    ]

    if any(signal in _CRITICAL_REFLECTION_SIGNALS for signal in signals):
        severity, disposition = "CRITICAL", "SAFETY_ESCALATION"
    elif signals:
        severity, disposition = "HIGH", "SAFETY_ESCALATION"
    else:
        severity, disposition = "LOW", "NORMAL"

    return ReflectionSafetyDisposition(
        severity=severity,  # type: ignore[arg-type]
        disposition=disposition,  # type: ignore[arg-type]
        policy_version=REFLECTION_SAFETY_POLICY_VERSION,
        signals=signals,
    )


def assert_reflection_safety_route(reflection: str | None) -> None:
    """Port of `assertReflectionSafetyRoute` (reflection-safety.policy.ts).

    Called from `completeGrowthAction` step 5
    (`architecture/notes/batch2-domain-research-v1.md` section 5.3 point 5):
    if the reflection text trips any of the 5 sensitive-signal regexes,
    raise 403 `reflection_requires_safety_support` instead of silently
    accepting the check-in. Empty/None reflection is a no-op (matches the
    NestJS source: `complete-growth-action.dto.ts` allows an empty string,
    and an empty string never matches any of the regexes below either way).
    """
    if not reflection:
        return
    disposition = assess_reflection_safety(reflection)
    if disposition.disposition != "NORMAL":
        raise InterventionForbiddenError("reflection_requires_safety_support")


def assert_normal_safety_route_placement_note() -> None:
    """Placement marker, not a real check — intentionally a no-op.

    Per `architecture/notes/batch2-cross-cutting-integration-check-v1.md`,
    the real `assertNormalSafetyRoute` judgment (research doc section 7.2:
    onboarding severity=LOW AND disposition=NORMAL, AND every perspective's
    disposition=NORMAL) currently lives only in the GrowthPriority domain's
    `domain/policies.py::assert_normal_safety_route` as a pure function.
    This domain's own `assert_normal_safety_route` (still on
    `InterventionRepositoryPort`, implemented in `infrastructure/`) is
    currently a SIMPLIFIED boolean check ("is this (family_id,
    onboarding_id) in a blocked set"), not an equivalent port of the full
    rule -- it does not distinguish severity from disposition, and does not
    check every perspective individually.

    Do NOT read this module having a `policies.py` file as evidence the
    full rule has been ported here — it has not. This marker exists so a
    future pass that ports the complete rule (alongside filling in this
    domain's `sqlalchemy_repository.py` `NotImplementedError` for the same
    method) has an obvious place to land it, matching GrowthPriority's
    domain-layer-pure-function placement rather than leaving it in
    infrastructure. Until then, this domain's existing simplified check is
    UNCHANGED -- this is a placement note, not a behavior change.
    """
