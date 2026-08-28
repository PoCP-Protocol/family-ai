"""Intervention + Action domain entities.

Ported from the `intervention_episodes` / `growth_actions` row shapes as
loaded by `intervention.service.ts` / `growth-action.service.ts`. See
`architecture/notes/batch2-domain-research-v1.md` sections 4.3 and 5.4 for
the underlying migration/table fact-finding.
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from .value_objects import (
    ExecutionStatus,
    GrowthActionStatus,
    InterventionEpisodeStatus,
    JourneyPhase,
)


class InterventionEpisode(BaseModel):
    """Port of the `intervention_episodes` row (migration 0020).

    KNOWN DEFECT (ported, not fixed): `status` has no code path that ever
    moves it off ACTIVE. See `value_objects.InterventionEpisodeStatus`
    docstring and `architecture/notes/batch2-domain-research-v1.md` section
    4.1. This entity does not expose a `complete()`/`cancel()` method
    because none exists in the source — adding one here would be a design
    change, not a port.
    """

    episode_id: str
    family_id: str
    onboarding_id: str
    priority_id: str
    intervention_id: str
    intervention_code: str
    status: InterventionEpisodeStatus
    started_by_actor_id: str
    started_at: datetime
    planned_days: int
    policy_version: str

    def is_active(self) -> bool:
        return self.status == InterventionEpisodeStatus.ACTIVE


class GrowthAction(BaseModel):
    """Port of the `growth_actions` row (migrations 0003/0008/0020/0035/
    0036/0042). Carries both the M1-legacy `journey_id`/`journey_plan_id`
    fields and the Intervention-episode fields — a single row can belong to
    either an `intervention_episode_id` or a `journey_plan_id` (paired with
    `journey_phase`), per the exclusive-pairing constraint documented in the
    research note section 5.4.
    """

    action_id: str
    family_id: str
    journey_id: str | None = None
    intervention_id: str | None = None
    dimension_id: str | None = None
    action_type: str
    instruction: str
    status: GrowthActionStatus
    onboarding_id: str | None = None
    priority_id: str | None = None
    intervention_episode_id: str | None = None
    day_index: int
    assignment_text: str
    due_date: date
    completion_status: str | None = None
    reflection: str | None = None
    reflection_boundary: str | None = None
    boundary: str = "ACTION_IS_NOT_OUTCOME"
    journey_plan_id: str | None = None
    journey_phase: JourneyPhase | None = None
    execution_status: ExecutionStatus = ExecutionStatus.NOT_STARTED
    started_at: datetime | None = None
    paused_at: datetime | None = None
    cancelled_at: datetime | None = None
    row_version: int = 1

    def is_pending(self) -> bool:
        return self.status == GrowthActionStatus.PENDING

    def is_due_on(self, day: date) -> bool:
        return self.due_date == day
