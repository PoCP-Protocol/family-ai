"""Integration test: Outcome's `InterventionEpisodeReadPort` wired to a
*real* Intervention/Action domain repository (`FakeInterventionRepository`
— the only concrete implementation of `InterventionRepositoryPort` that
exists on this branch; no SQLAlchemy repository has landed yet for either
domain) via `InterventionEpisodeReaderAdapter`, instead of Outcome's own
`FakeInterventionEpisodeReader` test double.

This proves the adapter is a real cross-domain seam, not a relabeled fake:
episodes/actions are created through Intervention's *own* command handler
(`InterventionCommandHandler.start`), and Outcome reads them back purely
through the adapter + `InterventionRepositoryPort` — no shortcut into
Intervention's repository internals from Outcome's test code.

The key regression this guards: `FakeInterventionEpisodeReader.load_episode`
silently returns `None` for any episode_id it wasn't explicitly seeded with
(same "fail silently" shape a not-found lookup would have). The real
Intervention repository's `load_episode_by_id` must behave identically for
Outcome's port contract (`None`, not a leaked exception) for genuinely
unknown IDs, while episodes that *do* exist in the real repository must
resolve with the real `dimension_id` joined from the real priority record
— something the old Fake could only ever get right by manual seeding, and
would give a false pass on if the adapter's join logic were wrong.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from domains.intervention.application.commands import (
    InterventionCommandHandler,
    MutationMeta as InterventionMutationMeta,
    StartInterventionCommand,
)
from domains.intervention.domain.value_objects import INTERVENTION_CODE
from domains.intervention.infrastructure.fake_repository import (
    DEFAULT_TEST_ACTOR,
    FakeInterventionRepository,
)
from domains.outcome.infrastructure.intervention_episode_reader_adapter import (
    InterventionEpisodeReaderAdapter,
)

TENANT_ID = "tenant-1"


@pytest.fixture
def family_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def onboarding_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def child_person_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def guardian_person_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def priority_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def intervention_repo(
    family_id: str,
    onboarding_id: str,
    child_person_id: str,
    guardian_person_id: str,
    priority_id: str,
) -> FakeInterventionRepository:
    repo = FakeInterventionRepository()
    repo.seed_family(family_id)
    repo.seed_growth_subject(family_id, onboarding_id, child_person_id, [guardian_person_id])
    repo.grant_consent(family_id, child_person_id)
    repo.seed_active_priority(family_id, priority_id, onboarding_id, dimension_id="R03")
    return repo


@pytest.fixture
def adapter(intervention_repo: FakeInterventionRepository) -> InterventionEpisodeReaderAdapter:
    return InterventionEpisodeReaderAdapter(repository=intervention_repo)


async def _start_real_episode(
    intervention_repo: FakeInterventionRepository, family_id: str, priority_id: str
) -> str:
    handler = InterventionCommandHandler(intervention_repo)
    result = await handler.start(
        StartInterventionCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id=DEFAULT_TEST_ACTOR,
            priority_id=priority_id,
            intervention_code=INTERVENTION_CODE,
            meta=InterventionMutationMeta(correlation_id="corr-1", idempotency_key="idem-1", source="test"),
        )
    )
    return result["episode"]["episode_id"]


class TestRealInterventionEpisodeReaderAdapter:
    async def test_load_episode_resolves_real_episode_with_real_dimension_id(
        self,
        adapter: InterventionEpisodeReaderAdapter,
        intervention_repo: FakeInterventionRepository,
        family_id: str,
        onboarding_id: str,
        priority_id: str,
    ) -> None:
        episode_id = await _start_real_episode(intervention_repo, family_id, priority_id)

        context = await adapter.load_episode(family_id, episode_id)

        assert context is not None
        assert context.intervention_episode_id == episode_id
        assert context.family_id == family_id
        assert context.onboarding_id == onboarding_id
        assert context.priority_id == priority_id
        assert context.dimension_id == "R03"
        assert context.status == "ACTIVE"

    async def test_load_episode_returns_none_for_unknown_episode_not_silently_fabricated(
        self, adapter: InterventionEpisodeReaderAdapter, family_id: str
    ) -> None:
        # This is the regression the task calls out explicitly: querying an
        # episode that was never created through the real Intervention
        # domain must resolve to None (which Outcome's own command handler
        # turns into `OutcomeNotFoundError("intervention_episode_not_found")`
        # — a real 404), not be waved through the way a permissive Fake
        # seeded with unrelated data might.
        context = await adapter.load_episode(family_id, str(uuid.uuid4()))
        assert context is None

    async def test_load_episode_returns_none_for_wrong_family_even_if_episode_exists(
        self,
        adapter: InterventionEpisodeReaderAdapter,
        intervention_repo: FakeInterventionRepository,
        family_id: str,
        priority_id: str,
    ) -> None:
        episode_id = await _start_real_episode(intervention_repo, family_id, priority_id)
        other_family_id = str(uuid.uuid4())

        context = await adapter.load_episode(other_family_id, episode_id)

        assert context is None

    async def test_list_episode_action_statuses_reflects_real_growth_actions(
        self,
        adapter: InterventionEpisodeReaderAdapter,
        intervention_repo: FakeInterventionRepository,
        family_id: str,
        priority_id: str,
    ) -> None:
        episode_id = await _start_real_episode(intervention_repo, family_id, priority_id)

        statuses = await adapter.list_episode_action_statuses(episode_id)

        assert len(statuses) == 7  # PLANNED_DAYS growth actions created by start()
        assert [status.day_index for status in statuses] == sorted(status.day_index for status in statuses)
        assert all(status.status == "PENDING" for status in statuses)

    async def test_list_episode_action_statuses_empty_for_unknown_episode(
        self, adapter: InterventionEpisodeReaderAdapter
    ) -> None:
        statuses = await adapter.list_episode_action_statuses(str(uuid.uuid4()))
        assert statuses == []
