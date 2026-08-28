"""Read-model queries — ported from `InterventionService.getInterventionCard`
/ `.getActiveIntervention` and `GrowthActionService.getTodayAction` /
`.listTodayActions` / `.listCompletedJourneyActions`. See
`architecture/notes/batch2-domain-research-v1.md` sections 4.1 and 5.1 for
the source method signatures this is a direct translation of.

This module is the piece a prior agent run left unfinished (stopped mid-file
with only the module docstring / imports sketched, no handler bodies) — it
has been written from scratch here against the same NestJS source, not
recovered from any partial draft.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from ..domain.policies import get_intervention_card
from .ports import InterventionRepositoryPort


@dataclass(frozen=True)
class GetInterventionCardQuery:
    family_id: str
    actor_id: str


@dataclass(frozen=True)
class GetActiveInterventionQuery:
    family_id: str
    onboarding_id: str
    actor_id: str


@dataclass(frozen=True)
class GetTodayActionQuery:
    family_id: str
    actor_id: str
    today: date = field(default_factory=date.today)


@dataclass(frozen=True)
class ListTodayActionsQuery:
    family_id: str
    actor_id: str
    today: date = field(default_factory=date.today)
    limit: int = 3


@dataclass(frozen=True)
class ListCompletedJourneyActionsQuery:
    family_id: str
    actor_id: str
    limit: int = 12


class InterventionQueryHandler:
    """Port of `InterventionService.getInterventionCard` /
    `.getActiveIntervention`. Both are read-only; family scope is verified
    the same way every mutation does (`ensureFamilyExists` — this domain has
    no separate `assertTenantFamilyScope`, per the NestJS source: Intervention
    reads only ever gate on family existence, not on a tenant-page policy
    flag like Assessment's UI-02/UI-03 projections do).
    """

    def __init__(self, repository: InterventionRepositoryPort):
        self._repository = repository

    async def get_intervention_card(self, query: GetInterventionCardQuery) -> dict:
        await self._repository.ensure_family_exists(query.family_id)
        return get_intervention_card()

    async def get_active_intervention(self, query: GetActiveInterventionQuery) -> dict | None:
        await self._repository.ensure_family_exists(query.family_id)
        episode = await self._repository.get_active_intervention(query.family_id, query.onboarding_id)
        return episode.model_dump(mode="json") if episode is not None else None


class GrowthActionQueryHandler:
    """Port of `GrowthActionService.getTodayAction` / `.listTodayActions` /
    `.listCompletedJourneyActions`.

    Date-boundary note (ported behavior, not a design choice made here):
    "today" is compared against `growth_actions.due_date` — a plain DATE
    column — using the caller-supplied `today` (defaults to the server's
    local `date.today()`, matching the NestJS source's use of the request's
    processing-time "today" rather than a client-supplied timezone). A
    `due_date` exactly equal to `today` is "due today"; the source performs
    no timezone conversion here — the comparison is calendar-day equality,
    the same UTC-calendar-day arithmetic `buildGrowthActionAssignments` used
    to compute `due_date` in the first place (see
    `domain/policies.py::build_growth_action_assignments`).
    """

    def __init__(self, repository: InterventionRepositoryPort):
        self._repository = repository

    async def get_today_action(self, query: GetTodayActionQuery) -> dict | None:
        await self._repository.ensure_family_exists(query.family_id)
        action = await self._repository.get_today_action(query.family_id, query.actor_id, query.today)
        return action.model_dump(mode="json") if action is not None else None

    async def list_today_actions(self, query: ListTodayActionsQuery) -> list[dict]:
        await self._repository.ensure_family_exists(query.family_id)
        actions = await self._repository.list_today_actions(
            query.family_id, query.actor_id, query.today, limit=query.limit
        )
        return [action.model_dump(mode="json") for action in actions[: query.limit]]

    async def list_completed_journey_actions(self, query: ListCompletedJourneyActionsQuery) -> list[dict]:
        await self._repository.ensure_family_exists(query.family_id)
        actions = await self._repository.list_completed_journey_actions(query.family_id, limit=query.limit)
        return [action.model_dump(mode="json") for action in actions[: query.limit]]
