"""Unit tests for the Intervention + Action domain command/query handlers,
run against the in-memory `FakeInterventionRepository`. These exercise the
ported behavior of `InterventionService`/`GrowthActionService` (NestJS)
end-to-end at the application layer, without HTTP or a real database — per
migration plan section 9's "FakeProvider" requirement.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from domains.intervention.application.commands import (
    CompleteGrowthActionCommand,
    GrowthActionCommandHandler,
    InterventionCommandHandler,
    MutationMeta,
    StartInterventionCommand,
    TransitionTaskExecutionCommand,
)
from domains.intervention.application.queries import (
    GetActiveInterventionQuery,
    GetInterventionCardQuery,
    GetTodayActionQuery,
    GrowthActionQueryHandler,
    InterventionQueryHandler,
    ListTodayActionsQuery,
)
from domains.intervention.domain.errors import (
    InterventionConflictError,
    InterventionForbiddenError,
    InterventionNotFoundError,
    InterventionValidationError,
)
from domains.intervention.domain.value_objects import (
    EXECUTION_TRANSITIONS,
    ExecutionStatus,
    InterventionEpisodeStatus,
)
from domains.intervention.infrastructure.fake_repository import DEFAULT_TEST_ACTOR, FakeInterventionRepository

ACTOR_ID = DEFAULT_TEST_ACTOR


def _meta(key: str = "idem-1") -> MutationMeta:
    return MutationMeta(correlation_id="corr-1", idempotency_key=key, source="test")


@pytest.fixture
def repo() -> FakeInterventionRepository:
    repository = FakeInterventionRepository()
    family_id = str(uuid.uuid4())
    onboarding_id = str(uuid.uuid4())
    priority_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    repository.seed_family(family_id)
    repository.seed_growth_subject(family_id, onboarding_id, child_id, [ACTOR_ID])
    repository.grant_consent(family_id, child_id)
    repository.seed_active_priority(family_id, priority_id, onboarding_id, dimension_id="R03")
    repository._test_family_id = family_id  # type: ignore[attr-defined]
    repository._test_onboarding_id = onboarding_id  # type: ignore[attr-defined]
    repository._test_priority_id = priority_id  # type: ignore[attr-defined]
    repository._test_child_id = child_id  # type: ignore[attr-defined]
    return repository


@pytest.fixture
def intervention_commands(repo: FakeInterventionRepository) -> InterventionCommandHandler:
    return InterventionCommandHandler(repo)


@pytest.fixture
def action_commands(repo: FakeInterventionRepository) -> GrowthActionCommandHandler:
    return GrowthActionCommandHandler(repo)


@pytest.fixture
def intervention_queries(repo: FakeInterventionRepository) -> InterventionQueryHandler:
    return InterventionQueryHandler(repo)


@pytest.fixture
def action_queries(repo: FakeInterventionRepository) -> GrowthActionQueryHandler:
    return GrowthActionQueryHandler(repo)


async def _start(intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository, key: str = "start-1"):
    return await intervention_commands.start(
        StartInterventionCommand(
            family_id=repo._test_family_id,  # type: ignore[attr-defined]
            actor_id=ACTOR_ID,
            priority_id=repo._test_priority_id,  # type: ignore[attr-defined]
            intervention_code="LISTEN_BEFORE_RESPOND",
            meta=_meta(key),
        )
    )


# --- 1. InterventionEpisode 启动成功 ---


class TestStartIntervention:
    async def test_start_creates_active_episode_and_seven_actions(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        receipt = await _start(intervention_commands, repo)

        assert receipt["replayed"] is False
        episode = receipt["episode"]
        assert episode["status"] == "ACTIVE"
        assert episode["intervention_code"] == "LISTEN_BEFORE_RESPOND"
        assert episode["planned_days"] == 7
        assert len(receipt["actions"]) == 7

        stored_episode = next(iter(repo.episodes.values()))
        assert stored_episode.status == InterventionEpisodeStatus.ACTIVE

    async def test_start_is_idempotent_on_replay(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        first = await _start(intervention_commands, repo, key="dup-key")
        second = await _start(intervention_commands, repo, key="dup-key")

        assert first["episode"]["episode_id"] == second["episode"]["episode_id"]
        assert second["replayed"] is True
        # Only one episode should have actually been inserted.
        assert len(repo.episodes) == 1

    async def test_start_rejects_unsupported_intervention_code(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        with pytest.raises(InterventionConflictError) as excinfo:
            await intervention_commands.start(
                StartInterventionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    priority_id=repo._test_priority_id,  # type: ignore[attr-defined]
                    intervention_code="SOMETHING_ELSE",
                    meta=_meta(),
                )
            )
        assert excinfo.value.code == "intervention_code_not_supported"

    async def test_start_rejects_unsupported_dimension(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        other_priority_id = str(uuid.uuid4())
        repo.seed_active_priority(
            repo._test_family_id, other_priority_id, repo._test_onboarding_id, dimension_id="R04"  # type: ignore[attr-defined]
        )
        with pytest.raises(InterventionNotFoundError) as excinfo:
            await intervention_commands.start(
                StartInterventionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    priority_id=other_priority_id,
                    intervention_code="LISTEN_BEFORE_RESPOND",
                    meta=_meta(),
                )
            )
        assert excinfo.value.code == "active_growth_priority_not_found"

    async def test_start_rejects_second_active_episode_for_same_onboarding(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        await _start(intervention_commands, repo, key="first")
        with pytest.raises(InterventionConflictError) as excinfo:
            await _start(intervention_commands, repo, key="second")
        assert excinfo.value.code == "active_intervention_episode_exists"

    async def test_start_rejects_missing_consent(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        repo.consents.clear()
        with pytest.raises(InterventionForbiddenError):
            await _start(intervention_commands, repo)

    async def test_start_requires_family_manage_permission(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        with pytest.raises(InterventionForbiddenError):
            await intervention_commands.start(
                StartInterventionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id="not-a-guardian",
                    priority_id=repo._test_priority_id,  # type: ignore[attr-defined]
                    intervention_code="LISTEN_BEFORE_RESPOND",
                    meta=_meta(),
                )
            )


# --- 2. 7天 GrowthAction 生成正确性 ---


class TestGrowthActionGeneration:
    async def test_seven_actions_have_sequential_day_index_and_due_dates(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        receipt = await _start(intervention_commands, repo)
        started_at_date = date.fromisoformat(receipt["episode"]["started_at"][:10])

        actions = sorted(receipt["actions"], key=lambda action: action["day_index"])
        assert [action["day_index"] for action in actions] == list(range(1, 8))

        for action in actions:
            expected_due = started_at_date + timedelta(days=action["day_index"] - 1)
            assert date.fromisoformat(action["due_date"]) == expected_due
            assert action["action_type"] == "LISTEN_BEFORE_RESPOND_DAILY_ACTION"
            assert action["status"] == "PENDING"
            assert action["intervention_episode_id"] == receipt["episode"]["episode_id"]

    async def test_action_texts_are_distinct_and_non_empty(
        self, intervention_commands: InterventionCommandHandler, repo: FakeInterventionRepository
    ):
        receipt = await _start(intervention_commands, repo)
        texts = [action["assignment_text"] for action in receipt["actions"]]
        assert len(texts) == 7
        assert all(text.strip() for text in texts)
        assert len(set(texts)) == 7


# --- 3. 完成状态转换(合法/非法白名单) ---


class TestCompleteGrowthAction:
    async def _completable_action_id(self, intervention_commands, repo) -> str:
        receipt = await _start(intervention_commands, repo)
        return receipt["actions"][0]["action_id"]

    async def test_complete_with_valid_status_transitions_and_locks(
        self, intervention_commands: InterventionCommandHandler, action_commands: GrowthActionCommandHandler, repo
    ):
        action_id = await self._completable_action_id(intervention_commands, repo)
        receipt = await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status="COMPLETED",
                reflection="今天做到了先听。",
                occurred_at=None,
                meta=_meta("complete-1"),
            )
        )
        assert receipt["growth_action"]["status"] == "COMPLETED"
        assert receipt["growth_action"]["completion_status"] == "COMPLETED"
        assert receipt["growth_action"]["reflection_boundary"] == "REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME"

        # Re-completing (same PENDING->terminal transition) must now conflict.
        with pytest.raises(InterventionConflictError) as excinfo:
            await action_commands.complete(
                CompleteGrowthActionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    action_id=action_id,
                    completion_status="PARTIAL",
                    reflection=None,
                    occurred_at=None,
                    meta=_meta("complete-2"),
                )
            )
        assert excinfo.value.code == "growth_action_already_checked_in"

    @pytest.mark.parametrize("valid_status", ["COMPLETED", "PARTIAL", "NOT_COMPLETED"])
    async def test_complete_accepts_every_whitelisted_status(
        self, intervention_commands, action_commands, repo, valid_status: str
    ):
        receipt = await _start(intervention_commands, repo, key=f"start-{valid_status}")
        action_id = receipt["actions"][1]["action_id"]
        result = await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status=valid_status,
                reflection=None,
                occurred_at=None,
                meta=_meta(f"complete-{valid_status}"),
            )
        )
        assert result["growth_action"]["completion_status"] == valid_status

    async def test_complete_rejects_status_outside_whitelist(
        self, intervention_commands, action_commands, repo
    ):
        action_id = await self._completable_action_id(intervention_commands, repo)
        with pytest.raises(InterventionValidationError) as excinfo:
            await action_commands.complete(
                CompleteGrowthActionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    action_id=action_id,
                    completion_status="IN_PROGRESS",
                    reflection=None,
                    occurred_at=None,
                    meta=_meta(),
                )
            )
        assert excinfo.value.code == "growth_action_completion_status_invalid"

    async def test_complete_unknown_action_raises_not_found(self, action_commands, repo):
        with pytest.raises(InterventionNotFoundError):
            await action_commands.complete(
                CompleteGrowthActionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    action_id=str(uuid.uuid4()),
                    completion_status="COMPLETED",
                    reflection=None,
                    occurred_at=None,
                    meta=_meta(),
                )
            )


class TestReflectionSafetyRoute:
    """Port of `assertReflectionSafetyRoute` (reflection-safety.policy.ts),
    wired into `completeGrowthAction` step 5
    (`architecture/notes/batch2-domain-research-v1.md` section 5.3 point 5
    / section 7.3). A reflection that trips any of the 5 sensitive-signal
    regexes must be rejected with 403, not silently persisted.
    """

    @pytest.mark.parametrize(
        "reflection",
        [
            "我今天真的不想活了，感觉快撑不住了。",  # SELF_HARM
            "我真的很想杀了他，气到发抖。",  # HARM_TO_OTHERS
            "他总是虐待孩子，我很担心。",  # ABUSE
            "昨晚又家暴了，场面很吓人。",  # VIOLENCE
            "情况已经彻底失控，感觉要立即报警了。",  # SEVERE_CRISIS
            "I don't want to kill myself but I feel awful.",  # SELF_HARM (English)
        ],
    )
    async def test_complete_rejects_reflection_with_safety_signal(
        self, intervention_commands, action_commands, repo, reflection: str
    ):
        receipt = await _start(intervention_commands, repo)
        action_id = receipt["actions"][0]["action_id"]

        with pytest.raises(InterventionForbiddenError) as excinfo:
            await action_commands.complete(
                CompleteGrowthActionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    action_id=action_id,
                    completion_status="COMPLETED",
                    reflection=reflection,
                    occurred_at=None,
                    meta=_meta(),
                )
            )
        assert excinfo.value.code == "reflection_requires_safety_support"

        # The rejected reflection must not have been persisted — the action
        # stays PENDING, not silently completed with a flagged reflection.
        action = repo.actions[action_id]
        assert action.status.value == "PENDING"
        assert action.reflection is None

    async def test_complete_accepts_ordinary_reflection_text(
        self, intervention_commands, action_commands, repo
    ):
        action_id = (await self._completable_action_id(intervention_commands, repo))

        receipt = await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status="COMPLETED",
                reflection="今天我先听孩子说完，再回应，感觉好一些了。",
                occurred_at=None,
                meta=_meta(),
            )
        )
        assert receipt["growth_action"]["reflection"] == "今天我先听孩子说完，再回应，感觉好一些了。"

    async def _completable_action_id(self, intervention_commands, repo) -> str:
        receipt = await _start(intervention_commands, repo)
        return receipt["actions"][0]["action_id"]

    async def test_complete_with_empty_or_none_reflection_is_not_blocked(
        self, intervention_commands, action_commands, repo
    ):
        receipt = await _start(intervention_commands, repo)
        action_id = receipt["actions"][0]["action_id"]

        result = await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status="COMPLETED",
                reflection=None,
                occurred_at=None,
                meta=_meta(),
            )
        )
        assert result["growth_action"]["completion_status"] == "COMPLETED"


class TestJourneyPlanExecutionRefresh:
    """`completeGrowthAction` step 7 (research note section 5.3 point 7 /
    section 3.4 `refreshJourneyPlanExecution`): completing a
    journey-plan-linked action (as opposed to an intervention-episode-linked
    one) must call into the GrowthPlan-domain side effect. This domain does
    not own `family_journey_plans` — see
    `application/commands.py`'s `refresh_journey_plan_execution` port call
    and `infrastructure/fake_repository.py`'s fake implementation, which
    records the call on the outbox for this assertion instead of mutating
    cross-domain state.
    """

    async def test_completing_a_journey_plan_action_triggers_refresh(self, action_commands, repo):
        journey_plan_id = str(uuid.uuid4())
        action = repo.seed_journey_plan_action(repo._test_family_id, journey_plan_id)  # type: ignore[attr-defined]

        await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action.action_id,
                completion_status="COMPLETED",
                reflection=None,
                occurred_at=None,
                meta=_meta(),
            )
        )

        refresh_events = [event for event in repo.outbox if event.get("event") == "JourneyPlanExecutionRefreshRequested"]
        assert len(refresh_events) == 1
        assert refresh_events[0]["journey_plan_id"] == journey_plan_id

    async def test_completing_an_intervention_action_does_not_trigger_journey_plan_refresh(
        self, intervention_commands, action_commands, repo
    ):
        receipt = await _start(intervention_commands, repo)
        action_id = receipt["actions"][0]["action_id"]

        await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status="COMPLETED",
                reflection=None,
                occurred_at=None,
                meta=_meta(),
            )
        )

        refresh_events = [event for event in repo.outbox if event.get("event") == "JourneyPlanExecutionRefreshRequested"]
        assert refresh_events == []


class TestExecutionTransitions:
    async def test_legal_transition_chain_start_pause_resume_and_terminal_cancel(
        self, intervention_commands, action_commands, repo
    ):
        receipt = await _start(intervention_commands, repo)
        action_id = receipt["actions"][2]["action_id"]

        started = await action_commands.transition_execution(
            TransitionTaskExecutionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                execution_action="START",
                meta=_meta("t1"),
            )
        )
        assert started["growth_action"]["execution_status"] == "IN_PROGRESS"

        paused = await action_commands.transition_execution(
            TransitionTaskExecutionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                execution_action="PAUSE",
                meta=_meta("t2"),
            )
        )
        assert paused["growth_action"]["execution_status"] == "PAUSED"

        resumed = await action_commands.transition_execution(
            TransitionTaskExecutionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                execution_action="RESUME",
                meta=_meta("t3"),
            )
        )
        assert resumed["growth_action"]["execution_status"] == "IN_PROGRESS"

        cancelled = await action_commands.transition_execution(
            TransitionTaskExecutionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                execution_action="CANCEL",
                meta=_meta("t4"),
            )
        )
        # CANCEL also writes status/completion_status = NOT_COMPLETED (ported side effect).
        assert cancelled["growth_action"]["execution_status"] == "NOT_COMPLETED"
        assert cancelled["growth_action"]["status"] == "NOT_COMPLETED"
        assert cancelled["growth_action"]["completion_status"] == "NOT_COMPLETED"

    async def test_illegal_transition_from_not_started_is_rejected(self, intervention_commands, action_commands, repo):
        receipt = await _start(intervention_commands, repo)
        action_id = receipt["actions"][3]["action_id"]

        with pytest.raises(InterventionConflictError) as excinfo:
            await action_commands.transition_execution(
                TransitionTaskExecutionCommand(
                    family_id=repo._test_family_id,  # type: ignore[attr-defined]
                    actor_id=ACTOR_ID,
                    action_id=action_id,
                    execution_action="PAUSE",
                    meta=_meta(),
                )
            )
        assert excinfo.value.code == "task_transition_not_allowed:NOT_STARTED:PAUSE"

    async def test_no_transition_is_defined_out_of_any_terminal_state(self):
        for terminal in (
            ExecutionStatus.COMPLETED,
            ExecutionStatus.PARTIAL,
            ExecutionStatus.NOT_COMPLETED,
            ExecutionStatus.CANCELLED,
        ):
            assert terminal not in EXECUTION_TRANSITIONS


# --- 4. 今日读取的日期边界逻辑 ---


class TestTodayActionDateBoundary:
    async def test_get_today_action_matches_only_actions_due_exactly_today(
        self, intervention_commands, action_queries, repo
    ):
        receipt = await _start(intervention_commands, repo)
        started_at_date = date.fromisoformat(receipt["episode"]["started_at"][:10])
        day3_due = started_at_date + timedelta(days=2)  # day_index 3

        result = await action_queries.get_today_action(
            GetTodayActionQuery(family_id=repo._test_family_id, actor_id=ACTOR_ID, today=day3_due)  # type: ignore[attr-defined]
        )
        assert result is not None
        assert result["day_index"] == 3
        assert date.fromisoformat(result["due_date"]) == day3_due

    async def test_get_today_action_returns_none_for_a_day_with_no_due_action(
        self, intervention_commands, action_queries, repo
    ):
        receipt = await _start(intervention_commands, repo)
        started_at_date = date.fromisoformat(receipt["episode"]["started_at"][:10])
        far_future = started_at_date + timedelta(days=30)

        result = await action_queries.get_today_action(
            GetTodayActionQuery(family_id=repo._test_family_id, actor_id=ACTOR_ID, today=far_future)  # type: ignore[attr-defined]
        )
        assert result is None

    async def test_list_today_actions_excludes_adjacent_days(self, intervention_commands, action_queries, repo):
        receipt = await _start(intervention_commands, repo)
        started_at_date = date.fromisoformat(receipt["episode"]["started_at"][:10])

        today_list = await action_queries.list_today_actions(
            ListTodayActionsQuery(family_id=repo._test_family_id, actor_id=ACTOR_ID, today=started_at_date)  # type: ignore[attr-defined]
        )
        assert len(today_list) == 1
        assert today_list[0]["day_index"] == 1

        yesterday_list = await action_queries.list_today_actions(
            ListTodayActionsQuery(
                family_id=repo._test_family_id, actor_id=ACTOR_ID, today=started_at_date - timedelta(days=1)  # type: ignore[attr-defined]
            )
        )
        assert yesterday_list == []

    async def test_completed_action_no_longer_shows_up_as_todays_action(
        self, intervention_commands, action_commands, action_queries, repo
    ):
        receipt = await _start(intervention_commands, repo)
        started_at_date = date.fromisoformat(receipt["episode"]["started_at"][:10])
        action_id = receipt["actions"][0]["action_id"]

        await action_commands.complete(
            CompleteGrowthActionCommand(
                family_id=repo._test_family_id,  # type: ignore[attr-defined]
                actor_id=ACTOR_ID,
                action_id=action_id,
                completion_status="COMPLETED",
                reflection=None,
                occurred_at=None,
                meta=_meta("complete-today"),
            )
        )

        result = await action_queries.get_today_action(
            GetTodayActionQuery(family_id=repo._test_family_id, actor_id=ACTOR_ID, today=started_at_date)  # type: ignore[attr-defined]
        )
        assert result is None


# --- Query handlers: card / active episode ---


class TestInterventionQueries:
    async def test_get_intervention_card_is_static_and_family_scoped(self, intervention_queries, repo):
        card = await intervention_queries.get_intervention_card(
            GetInterventionCardQuery(family_id=repo._test_family_id, actor_id=ACTOR_ID)  # type: ignore[attr-defined]
        )
        assert card["intervention_code"] == "LISTEN_BEFORE_RESPOND"
        assert card["planned_days"] == 7

        with pytest.raises(InterventionNotFoundError):
            await intervention_queries.get_intervention_card(
                GetInterventionCardQuery(family_id=str(uuid.uuid4()), actor_id=ACTOR_ID)
            )

    async def test_get_active_intervention_returns_episode_then_none_is_never_forced_terminal(
        self, intervention_commands, intervention_queries, repo
    ):
        await _start(intervention_commands, repo)
        active = await intervention_queries.get_active_intervention(
            GetActiveInterventionQuery(
                family_id=repo._test_family_id, onboarding_id=repo._test_onboarding_id, actor_id=ACTOR_ID  # type: ignore[attr-defined]
            )
        )
        assert active is not None
        assert active["status"] == "ACTIVE"

        # KNOWN DEFECT (ported, not fixed): there is no command that ever
        # moves this status off ACTIVE, so `get_active_intervention` will
        # keep returning this same episode indefinitely — even well past
        # its 7 planned days. This test documents that fact rather than
        # asserting a (nonexistent) termination path.
        assert active["status"] != "COMPLETED"
        assert active["status"] != "CANCELLED"
