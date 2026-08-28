"""Outcome domain policies — pure, no DB/AI dependency.

Ported from the in-memory (non-SQL) helper functions inside
`growth-review.service.ts`, per `architecture/notes/batch2-domain-research-v1.md`
section 5.5: `assertObservationSubject`, `assertObservationObserver`,
`assertReviewEligible`, `buildActionSummary`, `buildReviewLimitations`.
"""
from __future__ import annotations

from .entities import ActionSummary, EpisodeActionStatus, InterventionEpisodeContext
from .errors import OutcomeConflictError
from .value_objects import PerspectiveType, ReviewLimitation


def assert_observation_subject(request_subject_person_id: str, resolved_child_person_id: str) -> None:
    """Port of `assertObservationSubject` — the observation's subject must be
    the one child the onboarding's `GrowthSubjectResolver.resolve` resolved,
    never an arbitrary person_id supplied by the request.
    """
    if request_subject_person_id != resolved_child_person_id:
        raise OutcomeConflictError("observation_subject_mismatch")


def assert_observation_observer(
    perspective_type: PerspectiveType,
    observer_person_type: str,
    observer_person_id: str,
    subject_person_id: str,
    guardian_person_ids: set[str],
) -> None:
    """Port of `assertObservationObserver`.

    PARENT_OBSERVATION requires the observer to be a PARENT who is one of the
    resolved guardians of the subject child. CHILD_OBSERVATION requires the
    observer to be the CHILD subject observing themselves — no third party
    may record a CHILD_OBSERVATION on another child's behalf.
    """
    if perspective_type == "PARENT_OBSERVATION":
        if observer_person_type != "PARENT" or observer_person_id not in guardian_person_ids:
            raise OutcomeConflictError("parent_observation_observer_mismatch")
        return
    # CHILD_OBSERVATION
    if observer_person_type != "CHILD" or observer_person_id != subject_person_id:
        raise OutcomeConflictError("child_observation_observer_mismatch")


def assert_review_eligible(
    episode: InterventionEpisodeContext, action_statuses: list[EpisodeActionStatus], now: object
) -> None:
    """Port of `assertReviewEligible`.

    Two OR'd eligibility conditions — either is sufficient, they need not
    both hold:
      1. all `planned_days` actions exist and none is still PENDING (every
         day already checked in, whether early or on schedule), or
      2. the episode's planned window (`started_at` + `planned_days`) has
         already elapsed relative to `now`, regardless of check-in state.

    `now` is typed `object` here (rather than `datetime`) purely to keep this
    module import-free of the stdlib `datetime` type name colliding with the
    `started_at`/`now` comparison done by the caller — the Application layer
    passes a `datetime` and this function performs the actual comparison.
    """
    from datetime import datetime, timedelta

    assert isinstance(now, datetime)
    all_checked_in = len(action_statuses) == episode.planned_days and all(
        status.status != "PENDING" for status in action_statuses
    )
    window_elapsed = now >= episode.started_at + timedelta(days=episode.planned_days)
    if not all_checked_in and not window_elapsed:
        raise OutcomeConflictError("growth_review_not_eligible")


def build_action_summary(action_statuses: list[EpisodeActionStatus], planned_days: int) -> ActionSummary:
    """Port of `buildActionSummary` — `total_actions` is fixed to the
    episode's `planned_days` (not `len(action_statuses)`; a not-yet-created
    action still counts toward `missing`).
    """
    completed = sum(1 for status in action_statuses if status.completion_status == "COMPLETED")
    partial = sum(1 for status in action_statuses if status.completion_status == "PARTIAL")
    not_completed = sum(1 for status in action_statuses if status.completion_status == "NOT_COMPLETED")
    checked_in = completed + partial + not_completed
    return ActionSummary(
        total_actions=planned_days,
        completed=completed,
        partial=partial,
        not_completed=not_completed,
        missing=planned_days - checked_in,
    )


def build_review_limitations(
    action_summary: ActionSummary, observation_perspectives: list[PerspectiveType]
) -> list[ReviewLimitation]:
    """Port of `buildReviewLimitations` — pure rule derivation, no AI. The
    three observation-coverage branches (`PARENT_OBSERVATION_ONLY`,
    `CHILD_OBSERVATION_ONLY`, `PARENT_CHILD_DIVERGENCE`) are mutually
    exclusive; at most one of the three is ever added.
    """
    limitations: list[ReviewLimitation] = []
    if action_summary.missing > 0:
        limitations.append("MISSING_CHECK_INS")

    if not observation_perspectives:
        limitations.append("NO_OUTCOME_OBSERVATION")
    else:
        has_parent = "PARENT_OBSERVATION" in observation_perspectives
        has_child = "CHILD_OBSERVATION" in observation_perspectives
        if has_parent and has_child:
            limitations.append("PARENT_CHILD_DIVERGENCE")
        elif has_parent:
            limitations.append("PARENT_OBSERVATION_ONLY")
        elif has_child:
            limitations.append("CHILD_OBSERVATION_ONLY")

    return limitations


def assert_normal_safety_route_placement_note() -> None:
    """Placement marker, not a real check — intentionally a no-op.

    Per `architecture/notes/batch2-cross-cutting-integration-check-v1.md`,
    the real `assertNormalSafetyRoute` judgment (research doc section 7.2:
    onboarding severity=LOW AND disposition=NORMAL, AND every perspective's
    disposition=NORMAL) currently lives only in the GrowthPriority domain's
    `domain/policies.py::assert_normal_safety_route` as a pure function.
    This domain's own `assert_normal_safety_route` (still on
    `OutcomeRepositoryPort`, implemented in `infrastructure/`) is currently
    a SIMPLIFIED boolean check ("does this (family_id, onboarding_id) map
    to exactly the string 'NORMAL'"), not an equivalent port of the full
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
