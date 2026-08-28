"""In-memory fake for `InterventionEpisodeReadPort` — the cross-domain
read-only double this domain's own tests run against, per
`application/ports.py`'s module docstring. Once the real Intervention/Action
domain lands its own SQLAlchemy repository implements this same Protocol and
gets wired in at the composition root instead.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.entities import EpisodeActionStatus, InterventionEpisodeContext


@dataclass
class FakeInterventionEpisodeReader:
    episodes: dict[str, InterventionEpisodeContext] = field(default_factory=dict)
    action_statuses: dict[str, list[EpisodeActionStatus]] = field(default_factory=dict)

    def seed_episode(self, episode: InterventionEpisodeContext) -> None:
        self.episodes[episode.intervention_episode_id] = episode

    def seed_action_statuses(self, intervention_episode_id: str, statuses: list[EpisodeActionStatus]) -> None:
        self.action_statuses[intervention_episode_id] = statuses

    async def load_episode(self, family_id: str, intervention_episode_id: str) -> InterventionEpisodeContext | None:
        episode = self.episodes.get(intervention_episode_id)
        if episode is None or episode.family_id != family_id:
            return None
        return episode

    async def list_episode_action_statuses(self, intervention_episode_id: str) -> list[EpisodeActionStatus]:
        return list(self.action_statuses.get(intervention_episode_id, []))
