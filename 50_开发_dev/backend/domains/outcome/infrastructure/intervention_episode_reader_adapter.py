"""Adapter that implements Outcome's `InterventionEpisodeReadPort` against
the real Intervention/Action domain's `InterventionRepositoryPort`, per
`application/ports.py`'s module docstring: "once the real Intervention/
Action domain lands, its ... repository ... implements this same Protocol
and gets wired in at the composition root — no change needed in this
domain's application/domain layers."

This class is that wiring. It does not duplicate Intervention's domain
logic; it only translates Intervention's own entities
(`InterventionEpisode`, `GrowthAction`) into Outcome's read-only view types
(`InterventionEpisodeContext`, `EpisodeActionStatus`), calling three
narrow read methods added to `InterventionRepositoryPort` for exactly this
purpose (`load_episode_by_id`, `load_priority_dimension`,
`list_growth_actions_for_episode` — see that port's docstring). Outcome
never writes through this adapter, and never imports Intervention's
repository directly from application/domain code — only this
infrastructure-layer adapter does, keeping "no domain imports another
domain's repository directly" (migration plan section 3) intact: the
*port* Outcome depends on is still its own `InterventionEpisodeReadPort`.

Not-found handling: unlike Intervention's own command handlers (which raise
typed 404s for lookups the caller expects to already have validated),
Outcome's `InterventionEpisodeReadPort` contract returns `None` for a
missing episode — its own command handlers (`OutcomeCommandHandler`) turn
that `None` into `OutcomeNotFoundError("intervention_episode_not_found")`
themselves (see `application/commands.py`). This adapter preserves that
contract: it returns `None` rather than letting an
`InterventionNotFoundError` leak across the domain boundary as a foreign
exception type.
"""
from __future__ import annotations

from dataclasses import dataclass

from ...intervention.application.ports import InterventionRepositoryPort
from ..domain.entities import EpisodeActionStatus, InterventionEpisodeContext


@dataclass
class InterventionEpisodeReaderAdapter:
    """Implements `InterventionEpisodeReadPort` on top of a real
    `InterventionRepositoryPort` instance (the Intervention domain's own
    concrete repository — `FakeInterventionRepository` today, its future
    SQLAlchemy repository once that lands, per the same Protocol)."""

    repository: InterventionRepositoryPort

    async def load_episode(self, family_id: str, intervention_episode_id: str) -> InterventionEpisodeContext | None:
        episode = await self.repository.load_episode_by_id(family_id, intervention_episode_id)
        if episode is None:
            return None

        dimension_id = await self.repository.load_priority_dimension(family_id, episode.priority_id)
        if dimension_id is None:
            # The priority backing this episode no longer resolves under
            # this family — same "episode is unusable without its
            # dimension" situation `getEpisode`'s join would hit if the
            # join failed; treat it as episode-not-found rather than
            # returning a context with a missing required field.
            return None

        return InterventionEpisodeContext(
            intervention_episode_id=episode.episode_id,
            family_id=episode.family_id,
            onboarding_id=episode.onboarding_id,
            priority_id=episode.priority_id,
            dimension_id=dimension_id,
            status=episode.status.value if hasattr(episode.status, "value") else str(episode.status),
            started_at=episode.started_at,
            planned_days=episode.planned_days,
        )

    async def list_episode_action_statuses(self, intervention_episode_id: str) -> list[EpisodeActionStatus]:
        actions = await self.repository.list_growth_actions_for_episode(intervention_episode_id)
        return [
            EpisodeActionStatus(
                action_id=action.action_id,
                status=action.status.value if hasattr(action.status, "value") else str(action.status),
                completion_status=action.completion_status,
                day_index=action.day_index,
            )
            for action in actions
        ]
