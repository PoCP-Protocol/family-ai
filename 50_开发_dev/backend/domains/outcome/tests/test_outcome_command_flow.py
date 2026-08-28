"""Unit tests for the Outcome domain command/query handlers, run against the
in-memory `FakeOutcomeRepository` + `FakeInterventionEpisodeReader`. These
exercise the ported behavior of `GrowthReviewService` (NestJS) end-to-end at
the application layer, without HTTP or a real database — per migration plan
section 9's "FakeProvider" requirement.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from domains.outcome.application.commands import (
    CompleteGrowthReviewCommand,
    MutationMeta,
    OutcomeCommandHandler,
    RecordNextStepDecisionCommand,
    RecordOutcomeObservationCommand,
)
from domains.outcome.application.queries import GetTimelineQuery, OutcomeQueryHandler
from domains.outcome.domain.entities import EpisodeActionStatus, InterventionEpisodeContext
from domains.outcome.domain.errors import (
    OutcomeConflictError,
    OutcomeForbiddenError,
    OutcomeNotFoundError,
    OutcomeValidationError,
)
from domains.outcome.infrastructure.fake_intervention_episode_reader import FakeInterventionEpisodeReader
from domains.outcome.infrastructure.fake_repository import FakeOutcomeRepository

TENANT_ID = "tenant-1"


def _meta(key: str = "idem-1") -> MutationMeta:
    return MutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


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
def episode_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def repo(
    family_id: str,
    onboarding_id: str,
    child_person_id: str,
    guardian_person_id: str,
) -> FakeOutcomeRepository:
    repository = FakeOutcomeRepository()
    repository.seed_family(TENANT_ID, family_id)
    repository.seed_growth_subject(family_id, onboarding_id, child_person_id, {guardian_person_id})
    repository.seed_consent(family_id, child_person_id, "SERVICE")
    repository.seed_consent(family_id, child_person_id, "ASSESSMENT")
    repository.seed_consent(family_id, child_person_id, "GROWTH_TRACKING")
    repository.seed_normal_safety_route(family_id, onboarding_id)
    repository.seed_person_type(guardian_person_id, "PARENT")
    repository.seed_person_type(child_person_id, "CHILD")
    return repository


@pytest.fixture
def episodes(family_id: str, priority_id: str, episode_id: str) -> FakeInterventionEpisodeReader:
    reader = FakeInterventionEpisodeReader()
    reader.seed_episode(
        InterventionEpisodeContext(
            intervention_episode_id=episode_id,
            family_id=family_id,
            onboarding_id="",  # overwritten per-test where onboarding_id matters
            priority_id=priority_id,
            dimension_id="R03",
            status="ACTIVE",
            started_at=datetime.now(UTC) - timedelta(days=8),
            planned_days=7,
        )
    )
    return reader


@pytest.fixture
def command_handler(repo: FakeOutcomeRepository, episodes: FakeInterventionEpisodeReader) -> OutcomeCommandHandler:
    return OutcomeCommandHandler(repo, episodes)


@pytest.fixture
def query_handler(repo: FakeOutcomeRepository) -> OutcomeQueryHandler:
    return OutcomeQueryHandler(repo)


def _seed_episode_with_onboarding(
    episodes: FakeInterventionEpisodeReader,
    family_id: str,
    episode_id: str,
    priority_id: str,
    onboarding_id: str,
    started_at: datetime,
    planned_days: int = 7,
) -> None:
    episodes.seed_episode(
        InterventionEpisodeContext(
            intervention_episode_id=episode_id,
            family_id=family_id,
            onboarding_id=onboarding_id,
            priority_id=priority_id,
            dimension_id="R03",
            status="ACTIVE",
            started_at=started_at,
            planned_days=planned_days,
        )
    )


class TestRecordOutcomeObservation:
    async def test_parent_observation_success(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
        guardian_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=child_person_id,
            observer_person_id=guardian_person_id,
            perspective_type="PARENT_OBSERVATION",
            observation_text="孩子这周主动完成了作业。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        receipt = await command_handler.record_outcome_observation(command)

        assert receipt["replayed"] is False
        assert receipt["observation"]["perspective_type"] == "PARENT_OBSERVATION"
        assert receipt["observation"]["boundary"] == "OBSERVATION_IS_NOT_FACT_OR_CAUSAL_EFFECT"

    async def test_child_observation_success(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=child_person_id,
            observer_person_id=child_person_id,
            perspective_type="CHILD_OBSERVATION",
            observation_text="我觉得这周作业没那么难了。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        receipt = await command_handler.record_outcome_observation(command)

        assert receipt["observation"]["perspective_type"] == "CHILD_OBSERVATION"

    async def test_parent_observer_mismatch_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        stranger_id = str(uuid.uuid4())
        command_handler._repository.seed_person_type(stranger_id, "PARENT")
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=child_person_id,
            observer_person_id=stranger_id,
            perspective_type="PARENT_OBSERVATION",
            observation_text="非监护人观察。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        with pytest.raises(OutcomeConflictError) as exc_info:
            await command_handler.record_outcome_observation(command)
        assert exc_info.value.code == "parent_observation_observer_mismatch"

    async def test_subject_mismatch_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        guardian_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        wrong_subject_id = str(uuid.uuid4())
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=wrong_subject_id,
            observer_person_id=guardian_person_id,
            perspective_type="PARENT_OBSERVATION",
            observation_text="观察对象不是resolver解析出的孩子。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        with pytest.raises(OutcomeConflictError) as exc_info:
            await command_handler.record_outcome_observation(command)
        assert exc_info.value.code == "observation_subject_mismatch"

    async def test_episode_not_found_is_404(
        self, command_handler: OutcomeCommandHandler, family_id: str, onboarding_id: str, child_person_id: str
    ):
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=str(uuid.uuid4()),
            subject_person_id=child_person_id,
            observer_person_id=child_person_id,
            perspective_type="CHILD_OBSERVATION",
            observation_text="任意文本。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        with pytest.raises(OutcomeNotFoundError) as exc_info:
            await command_handler.record_outcome_observation(command)
        assert exc_info.value.code == "intervention_episode_not_found"

    async def test_blank_observation_text_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=child_person_id,
            observer_person_id=child_person_id,
            perspective_type="CHILD_OBSERVATION",
            observation_text="   ",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta(),
        )

        with pytest.raises(OutcomeValidationError):
            await command_handler.record_outcome_observation(command)

    async def test_replay_returns_same_receipt(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        command = RecordOutcomeObservationCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            subject_person_id=child_person_id,
            observer_person_id=child_person_id,
            perspective_type="CHILD_OBSERVATION",
            observation_text="重复请求应回放同一结果。",
            action_refs=[],
            reflection_refs=[],
            evidence_refs=[],
            meta=_meta("idem-replay"),
        )

        first = await command_handler.record_outcome_observation(command)
        second = await command_handler.record_outcome_observation(command)

        assert second["replayed"] is True
        assert second["observation"]["observation_id"] == first["observation"]["observation_id"]


class TestCompleteGrowthReview:
    async def test_completes_when_all_actions_checked_in(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        episodes.seed_action_statuses(
            episode_id,
            [
                EpisodeActionStatus(action_id=str(uuid.uuid4()), status="CHECKED_IN", completion_status="COMPLETED", day_index=day)
                for day in range(7)
            ],
        )
        command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta(),
        )

        receipt = await command_handler.complete_growth_review(command)

        assert receipt["review"]["status"] == "COMPLETED"
        assert receipt["review"]["action_summary"]["completed"] == 7
        assert receipt["review"]["action_summary"]["missing"] == 0
        assert "NO_OUTCOME_OBSERVATION" in receipt["review"]["limitations"]

    async def test_completes_when_window_elapsed_even_if_not_checked_in(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=8)
        )
        command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta(),
        )

        receipt = await command_handler.complete_growth_review(command)

        assert receipt["review"]["action_summary"]["missing"] == 7
        assert "MISSING_CHECK_INS" in receipt["review"]["limitations"]

    async def test_not_eligible_when_window_open_and_not_all_checked_in(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        episodes.seed_action_statuses(
            episode_id,
            [
                EpisodeActionStatus(action_id=str(uuid.uuid4()), status="PENDING", completion_status=None, day_index=0)
            ],
        )
        command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta(),
        )

        with pytest.raises(OutcomeConflictError) as exc_info:
            await command_handler.complete_growth_review(command)
        assert exc_info.value.code == "growth_review_not_eligible"

    async def test_already_completed_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=8)
        )
        command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta("idem-a"),
        )
        await command_handler.complete_growth_review(command)

        second_command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta("idem-b"),
        )
        with pytest.raises(OutcomeConflictError) as exc_info:
            await command_handler.complete_growth_review(second_command)
        assert exc_info.value.code == "growth_review_already_completed"

    async def test_limitations_reflect_parent_child_divergence(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
        guardian_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=1)
        )
        episodes.seed_action_statuses(
            episode_id,
            [
                EpisodeActionStatus(action_id=str(uuid.uuid4()), status="CHECKED_IN", completion_status="COMPLETED", day_index=day)
                for day in range(7)
            ],
        )
        await command_handler.record_outcome_observation(
            RecordOutcomeObservationCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                onboarding_id=onboarding_id,
                intervention_episode_id=episode_id,
                subject_person_id=child_person_id,
                observer_person_id=guardian_person_id,
                perspective_type="PARENT_OBSERVATION",
                observation_text="家长观察记录。",
                action_refs=[],
                reflection_refs=[],
                evidence_refs=[],
                meta=_meta("idem-parent"),
            )
        )
        await command_handler.record_outcome_observation(
            RecordOutcomeObservationCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                onboarding_id=onboarding_id,
                intervention_episode_id=episode_id,
                subject_person_id=child_person_id,
                observer_person_id=child_person_id,
                perspective_type="CHILD_OBSERVATION",
                observation_text="孩子自己的观察记录。",
                action_refs=[],
                reflection_refs=[],
                evidence_refs=[],
                meta=_meta("idem-child"),
            )
        )

        command = CompleteGrowthReviewCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            meta=_meta("idem-review"),
        )
        receipt = await command_handler.complete_growth_review(command)

        assert receipt["review"]["limitations"] == ["PARENT_CHILD_DIVERGENCE"]
        assert len(receipt["review"]["observation_ids"]) == 2


class TestRecordNextStepDecision:
    async def _complete_review(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ) -> str:
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=8)
        )
        receipt = await command_handler.complete_growth_review(
            CompleteGrowthReviewCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                onboarding_id=onboarding_id,
                intervention_episode_id=episode_id,
                priority_id=priority_id,
                meta=_meta("idem-review-for-decision"),
            )
        )
        return receipt["review"]["review_id"]

    async def test_records_decision_successfully(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        review_id = await self._complete_review(
            command_handler, episodes, family_id, onboarding_id, episode_id, priority_id
        )
        command = RecordNextStepDecisionCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            review_id=review_id,
            decision="CONTINUE",
            rationale="孩子进展顺利，继续当前计划。",
            meta=_meta(),
        )

        receipt = await command_handler.record_next_step_decision(command)

        assert receipt["decision"]["decision"] == "CONTINUE"
        assert receipt["decision"]["boundary"] == "NEXT_STEP_DECISION_IS_NOT_NEXT_ACTION"

    async def test_review_not_found_is_404(self, command_handler: OutcomeCommandHandler, family_id: str):
        command = RecordNextStepDecisionCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            review_id=str(uuid.uuid4()),
            decision="CONTINUE",
            rationale=None,
            meta=_meta(),
        )

        with pytest.raises(OutcomeNotFoundError) as exc_info:
            await command_handler.record_next_step_decision(command)
        assert exc_info.value.code == "growth_review_not_found"

    async def test_already_recorded_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        review_id = await self._complete_review(
            command_handler, episodes, family_id, onboarding_id, episode_id, priority_id
        )
        await command_handler.record_next_step_decision(
            RecordNextStepDecisionCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                review_id=review_id,
                decision="CONTINUE",
                rationale=None,
                meta=_meta("idem-first-decision"),
            )
        )

        with pytest.raises(OutcomeConflictError) as exc_info:
            await command_handler.record_next_step_decision(
                RecordNextStepDecisionCommand(
                    family_id=family_id,
                    tenant_id=TENANT_ID,
                    actor_id="actor-1",
                    review_id=review_id,
                    decision="ADJUST",
                    rationale=None,
                    meta=_meta("idem-second-decision"),
                )
            )
        assert exc_info.value.code == "next_step_decision_already_recorded"

    async def test_invalid_decision_value_is_rejected(
        self,
        command_handler: OutcomeCommandHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
    ):
        review_id = await self._complete_review(
            command_handler, episodes, family_id, onboarding_id, episode_id, priority_id
        )
        command = RecordNextStepDecisionCommand(
            family_id=family_id,
            tenant_id=TENANT_ID,
            actor_id="actor-1",
            review_id=review_id,
            decision="INVALID_VALUE",  # type: ignore[arg-type]
            rationale=None,
            meta=_meta(),
        )

        with pytest.raises(OutcomeValidationError):
            await command_handler.record_next_step_decision(command)


class TestGetTimeline:
    async def test_returns_entries_sorted_by_occurrence(
        self,
        command_handler: OutcomeCommandHandler,
        query_handler: OutcomeQueryHandler,
        episodes: FakeInterventionEpisodeReader,
        family_id: str,
        onboarding_id: str,
        episode_id: str,
        priority_id: str,
        child_person_id: str,
    ):
        _seed_episode_with_onboarding(
            episodes, family_id, episode_id, priority_id, onboarding_id, datetime.now(UTC) - timedelta(days=8)
        )
        await command_handler.record_outcome_observation(
            RecordOutcomeObservationCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                onboarding_id=onboarding_id,
                intervention_episode_id=episode_id,
                subject_person_id=child_person_id,
                observer_person_id=child_person_id,
                perspective_type="CHILD_OBSERVATION",
                observation_text="第一条时间线事件。",
                action_refs=[],
                reflection_refs=[],
                evidence_refs=[],
                meta=_meta("idem-obs"),
            )
        )
        review_receipt = await command_handler.complete_growth_review(
            CompleteGrowthReviewCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                onboarding_id=onboarding_id,
                intervention_episode_id=episode_id,
                priority_id=priority_id,
                meta=_meta("idem-review"),
            )
        )
        review_id = review_receipt["review"]["review_id"]
        await command_handler.record_next_step_decision(
            RecordNextStepDecisionCommand(
                family_id=family_id,
                tenant_id=TENANT_ID,
                actor_id="actor-1",
                review_id=review_id,
                decision="CONTINUE",
                rationale=None,
                meta=_meta("idem-decision"),
            )
        )

        projection = await query_handler.get_timeline(
            GetTimelineQuery(family_id=family_id, tenant_id=TENANT_ID, actor_id="actor-1", onboarding_id=onboarding_id)
        )

        event_types = [entry["event_type"] for entry in projection["entries"]]
        assert set(event_types) == {
            "OUTCOME_OBSERVATION_RECORDED",
            "GROWTH_REVIEW_COMPLETED",
            "NEXT_STEP_DECISION_RECORDED",
        }
        occurred_ats = [entry["occurred_at"] for entry in projection["entries"]]
        assert occurred_ats == sorted(occurred_ats)
        assert projection["boundary"] == "TIMELINE_IS_PROVENANCE_NOT_SCORE_OR_RANKING"

    async def test_load_timeline_sorts_by_occurred_at_regardless_of_insertion_order(
        self, repo: FakeOutcomeRepository, family_id: str, onboarding_id: str, episode_id: str, priority_id: str
    ):
        """Direct proof against the repository's merge/sort step: insert the
        three event rows out of chronological order and assert `load_timeline`
        still returns them oldest-first.
        """
        from domains.outcome.domain.entities import GrowthReview, NextStepDecision, OutcomeObservation
        from domains.outcome.domain.value_objects import (
            NEXT_STEP_DECISION_BOUNDARY,
            OBSERVATION_BOUNDARY,
            REVIEW_BOUNDARY,
        )

        t0 = datetime.now(UTC) - timedelta(days=3)
        t1 = datetime.now(UTC) - timedelta(days=2)
        t2 = datetime.now(UTC) - timedelta(days=1)

        # Insert NEWEST first, then oldest, then middle — deliberately not
        # in chronological order, to prove sorting is by `occurred_at`, not
        # insertion/dict order.
        review = GrowthReview(
            review_id=str(uuid.uuid4()),
            family_id=family_id,
            onboarding_id=onboarding_id,
            intervention_episode_id=episode_id,
            priority_id=priority_id,
            dimension_id="R03",
            action_summary={"total_actions": 7, "completed": 7, "partial": 0, "not_completed": 0, "missing": 0},
            observation_ids=[],
            limitations=[],
            boundary=REVIEW_BOUNDARY,
            policy_version="OUTCOME_V1",
            completed_by_actor_id="actor-1",
            completed_at=t2,
        )
        repo.reviews[review.review_id] = review

        observation = OutcomeObservation(
            observation_id=str(uuid.uuid4()),
            family_id=family_id,
            subject_person_id=str(uuid.uuid4()),
            observer_person_id=str(uuid.uuid4()),
            intervention_episode_id=episode_id,
            perspective_type="CHILD_OBSERVATION",
            observation_text="最早的一条。",
            observed_at=t0,
            boundary=OBSERVATION_BOUNDARY,
            policy_version="OUTCOME_V1",
        )
        repo.observations[observation.observation_id] = observation

        decision = NextStepDecision(
            decision_id=str(uuid.uuid4()),
            family_id=family_id,
            review_id=review.review_id,
            intervention_episode_id=episode_id,
            decision="CONTINUE",
            rationale=None,
            boundary=NEXT_STEP_DECISION_BOUNDARY,
            policy_version="OUTCOME_V1",
            decided_by_actor_id="actor-1",
            decided_at=t1,
        )
        repo.decisions[decision.decision_id] = decision

        entries = await repo.load_timeline(family_id, onboarding_id)

        assert [entry.event_type for entry in entries] == [
            "OUTCOME_OBSERVATION_RECORDED",
            "NEXT_STEP_DECISION_RECORDED",
            "GROWTH_REVIEW_COMPLETED",
        ]
        assert [entry.occurred_at for entry in entries] == [t0, t1, t2]

    async def test_scope_denied_when_tenant_family_unbound(
        self, query_handler: OutcomeQueryHandler, onboarding_id: str
    ):
        unbound_family_id = str(uuid.uuid4())
        query = GetTimelineQuery(
            family_id=unbound_family_id, tenant_id=TENANT_ID, actor_id="actor-1", onboarding_id=onboarding_id
        )

        with pytest.raises(OutcomeForbiddenError) as exc_info:
            await query_handler.get_timeline(query)
        assert exc_info.value.code == "tenant_family_scope_denied"
