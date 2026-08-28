"""Read-model queries — ported from `GrowthReviewService.getTimeline`."""
from __future__ import annotations

from dataclasses import dataclass

from .ports import OutcomeRepositoryPort


@dataclass(frozen=True)
class GetTimelineQuery:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str


class OutcomeQueryHandler:
    def __init__(self, repository: OutcomeRepositoryPort):
        self._repository = repository

    async def get_timeline(self, query: GetTimelineQuery) -> dict:
        """Port of `getTimeline` — a read-only 5-way union across
        `intervention_episodes` / `growth_actions` / `outcome_observations` /
        `growth_reviews` / `next_step_decisions`, sorted by occurrence time
        (and event type as the tiebreak), per
        `architecture/notes/batch2-domain-research-v1.md` section 5.5.
        `load_timeline` on the repository port already returns the merged,
        sorted rows — this handler only adds the scope check and the fixed
        boundary label / named-actions envelope.
        """
        await self._repository.assert_tenant_family_scope(query.tenant_id, query.family_id, query.actor_id)
        entries = await self._repository.load_timeline(query.family_id, query.onboarding_id)
        return {
            "projection_version": "OUTCOME_TIMELINE_V1",
            "tenant_id": query.tenant_id,
            "family_id": query.family_id,
            "onboarding_id": query.onboarding_id,
            "entries": [entry.model_dump(mode="json") for entry in entries],
            "boundary": "TIMELINE_IS_PROVENANCE_NOT_SCORE_OR_RANKING",
        }
