"""GrowthPlan (JourneyPlan) domain entities.

Ported from the `family_journey_plans` / `family_journey_plan_phases` row
shapes implied by `journey-plan.service.ts`
(`architecture/notes/batch2-domain-research-v1.md` section 3.4).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .value_objects import (
    JOURNEY_PLAN_BOUNDARY,
    JourneyPhaseName,
    JourneyPhaseStatus,
    JourneyPlanStatus,
)


class JourneyPlanPhase(BaseModel):
    phase_id: str
    plan_id: str
    name: JourneyPhaseName
    start_day: int
    review_due_day: int
    status: JourneyPhaseStatus
    focus_dimensions: list[str]


class JourneyPlan(BaseModel):
    plan_id: str
    family_id: str
    onboarding_id: str
    priority_id: str
    status: JourneyPlanStatus
    current_phase: JourneyPhaseName
    current_day: int
    total_days: int
    version: int
    created_at: datetime
    confirmed_at: datetime | None = None
    confirmed_by_actor_id: str | None = None
    paused_at: datetime | None = None
    boundary: str = JOURNEY_PLAN_BOUNDARY
    phases: list[JourneyPlanPhase] = Field(default_factory=list)

    def phase_by_name(self, name: JourneyPhaseName) -> JourneyPlanPhase:
        for phase in self.phases:
            if phase.name == name:
                return phase
        raise KeyError(name)

    def next_phase_after(self, name: JourneyPhaseName) -> JourneyPlanPhase | None:
        names = [phase.name for phase in self.phases]
        index = names.index(name)
        if index + 1 >= len(self.phases):
            return None
        return self.phases[index + 1]
