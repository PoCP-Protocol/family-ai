"""Explicit state machine for `growth_priorities.status`.

Port of the DB constraint pair from `architecture/notes/batch2-domain-research-v1.md`
section 3.3: `status` is limited to `ACTIVE`/`SUPERSEDED`, a row's `rank`
must be 1 unless `status = SUPERSEDED`, and a row can never move status
backward from `SUPERSEDED` to `ACTIVE` — the only legal transition is
`ACTIVE -> SUPERSEDED` via `supersedeActivePriority`. This module makes that
transition table explicit and independently testable, separate from the
`insert_priority` repository call that performs it as a side effect.
"""
from __future__ import annotations

from .errors import GrowthPriorityConflictError
from .value_objects import GrowthPriorityStatus

_ALLOWED_TRANSITIONS: dict[GrowthPriorityStatus, frozenset[GrowthPriorityStatus]] = {
    GrowthPriorityStatus.ACTIVE: frozenset({GrowthPriorityStatus.SUPERSEDED}),
    GrowthPriorityStatus.SUPERSEDED: frozenset(),  # terminal — no legal outgoing transition
}


def assert_legal_transition(current: GrowthPriorityStatus, target: GrowthPriorityStatus) -> None:
    if target not in _ALLOWED_TRANSITIONS.get(current, frozenset()):
        raise GrowthPriorityConflictError("growth_priority_status_transition_illegal")


def supersede(current: GrowthPriorityStatus) -> GrowthPriorityStatus:
    assert_legal_transition(current, GrowthPriorityStatus.SUPERSEDED)
    return GrowthPriorityStatus.SUPERSEDED
