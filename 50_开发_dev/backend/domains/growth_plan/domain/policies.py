"""Pure policy functions for the GrowthPlan (JourneyPlan) domain — no I/O,
no repository access. Ported from the phase-transition rules embedded in
`journey-plan.service.ts`'s `createPlan`/`pausePlan`/`reviewCurrentPhase`
methods (`architecture/notes/batch2-domain-research-v1.md` section 3.4).
"""
from __future__ import annotations

from .value_objects import (
    FIXED_PHASE_FOCUS_DIMENSIONS,
    PHASE_DEFINITIONS,
    JourneyPhaseName,
    JourneyPhaseStatus,
)


def build_initial_phase_specs(priority_dimension: str) -> list[dict]:
    """Port of `insertPhases` in `createPlan` step 7 — SEE and STABILIZE
    inherit the active priority's dimension; PARENT_FIRST/CO_CREATE are
    fixed regardless of priority.
    """
    specs: list[dict] = []
    for name, start_day, review_due_day in PHASE_DEFINITIONS:
        if name in FIXED_PHASE_FOCUS_DIMENSIONS:
            focus_dimensions = list(FIXED_PHASE_FOCUS_DIMENSIONS[name])
        else:
            focus_dimensions = [priority_dimension]
        specs.append(
            {
                "name": name,
                "start_day": start_day,
                "review_due_day": review_due_day,
                # Port of the research note: only SEE starts ACTIVE-eligible
                # once the plan is confirmed; at createPlan (still DRAFT) all
                # phases start PENDING. confirmPlan (out of scope for this
                # batch) is what flips SEE to ACTIVE.
                "status": JourneyPhaseStatus.PENDING,
                "focus_dimensions": focus_dimensions,
            }
        )
    return specs


def resolve_review_outcome(current_phase_name: JourneyPhaseName, decision: str) -> dict:
    """Port of `reviewCurrentPhase` steps 3-4. Returns a plain dict describing
    the resulting transition so the command handler / fake repository can
    apply it without re-deriving the rule. `decision` is intentionally typed
    as `str`, not the `ReviewDecision` literal — per the research note, the
    real implementation performs no enum whitelist on `decision`; the SQL
    branch only distinguishes `CONTINUE` from everything else (ADJUST is one
    such "everything else" value, described in the task as "先调整节奏").
    """
    if decision == "CONTINUE":
        return {
            "current_phase_becomes": JourneyPhaseStatus.COMPLETED,
            "plan_pauses": False,
        }
    return {
        "current_phase_becomes": JourneyPhaseStatus.BLOCKED,
        "plan_pauses": True,
    }
