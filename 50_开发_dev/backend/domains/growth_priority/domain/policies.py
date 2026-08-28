"""Pure domain policy checks shared by the GrowthPriority command handler.

Ports of `assertNormalSafetyRoute` (research doc section 7.2) and the
decision/candidate matching rules embedded in `confirmGrowthPriority`
(research doc section 3.2 steps 6-8). These are pure functions over already
-loaded data; the repository/consent ports are responsible for loading that
data, this module only judges it — same separation as
`domains/assessment/domain/policies.py`.
"""
from __future__ import annotations

from .entities import GrowthPriorityCandidate, GrowthPriorityDraft
from .errors import GrowthPriorityConflictError, GrowthPriorityForbiddenError
from .value_objects import GrowthPriorityDecisionType, SafetyDisposition, SafetySeverity


def assert_normal_safety_route(
    onboarding_disposition: SafetyDisposition,
    onboarding_severity: SafetySeverity,
    perspective_dispositions: list[SafetyDisposition | None],
) -> None:
    """Port of `assertNormalSafetyRoute` (research doc section 7.2).

    1. The onboarding-start safety assessment must be exactly
       severity=LOW and disposition=NORMAL.
    2. Every perspective recorded under the onboarding must also carry
       disposition=NORMAL (an empty/missing disposition on a perspective is
       treated as *not* normal — fail closed, per the research note: "any
       later perspective record showing an abnormal safety signal
       permanently blocks further Growth writes for that onboarding").
    """
    if onboarding_severity != SafetySeverity.LOW or onboarding_disposition != SafetyDisposition.NORMAL:
        raise GrowthPriorityForbiddenError("normal_safety_route_not_verified")
    for disposition in perspective_dispositions:
        if disposition != SafetyDisposition.NORMAL:
            raise GrowthPriorityForbiddenError("normal_safety_route_not_verified")


def assert_draft_is_fresh(draft: GrowthPriorityDraft, request_draft_id: str) -> None:
    """Research doc section 3.2 step 6: `growth_priority_draft_stale`."""
    if draft.draft_id != request_draft_id:
        raise GrowthPriorityConflictError("growth_priority_draft_stale")


def assert_decision_matches_draft(
    decision: GrowthPriorityDecisionType, candidate: GrowthPriorityCandidate | None
) -> None:
    """Port of `assertDecisionMatchesDraft` (research doc section 3.2 step 7)
    plus step 8's extra dimension-match check, folded into one policy
    function. `NO_PRIORITY_YET` is always consistent with an absent
    candidate or a present one (the parent may decline a proposed
    candidate); any concrete dimension decision requires a candidate whose
    `dimension_id` matches exactly.
    """
    if decision == "NO_PRIORITY_YET":
        return
    if candidate is None:
        raise GrowthPriorityConflictError("growth_priority_decision_not_eligible")
    if candidate.dimension_id != decision:
        raise GrowthPriorityConflictError("growth_priority_decision_not_eligible")


def assert_no_active_intervention_episode(has_active_episode: bool) -> None:
    """Research doc section 3.2 step 4: `active_intervention_episode_exists`."""
    if has_active_episode:
        raise GrowthPriorityConflictError("active_intervention_episode_exists")
