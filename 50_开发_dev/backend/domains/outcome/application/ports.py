"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Domain code never imports SQLAlchemy/FastAPI directly; it
depends on these Protocols instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.

Two ports are declared here:

- `OutcomeRepositoryPort` — this domain's own read/write surface
  (`outcome_observations` / `growth_reviews` / `next_step_decisions` +
  shared cross-domain gates it must re-check per-write: tenant/family scope,
  consent, safety route, subject resolution).
- `InterventionEpisodeReadPort` — a **cross-domain read-only dependency**.
  Per `architecture/notes/batch2-domain-research-v1.md` section 5.5,
  `recordOutcomeObservation` / `completeGrowthReview` both start with
  `getEpisode` (a join against `intervention_episodes` + `growth_priorities`)
  and `completeGrowthReview` additionally reads every `growth_actions` row
  under that episode (`listEpisodeActionStatuses`) to compute eligibility and
  the action summary. Those two tables are owned and written by the
  Intervention/Action domain (Batch 2's parallel in-flight domain, not yet
  landed on this branch — see `outcome-domain-p0-001` task notes). Rather
  than block on that domain landing, or reach into its repository directly
  (forbidden — "no domain imports another domain's repository directly",
  migration plan section 3), Outcome declares the read-only slice it needs as
  its own Port here. `infrastructure/fake_intervention_episode_reader.py`
  provides the in-memory double this domain's own tests run against; once the
  real Intervention/Action domain lands, its SQLAlchemy repository (or a thin
  cross-domain read projection per migration plan section 5) implements this
  same Protocol and gets wired in at the composition root — no change needed
  in this domain's application/domain layers.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.entities import (
    EpisodeActionStatus,
    GrowthReview,
    InterventionEpisodeContext,
    NextStepDecision,
    OutcomeObservation,
    TimelineEntry,
)


class InterventionEpisodeReadPort(Protocol):
    """Read-only cross-domain dependency on Intervention/Action. See module
    docstring — Outcome never writes through this port.
    """

    async def load_episode(self, family_id: str, intervention_episode_id: str) -> InterventionEpisodeContext | None: ...

    async def list_episode_action_statuses(
        self, intervention_episode_id: str
    ) -> list[EpisodeActionStatus]: ...


class OutcomeRepositoryPort(Protocol):
    """Mirrors the query/mutation surface of `growth-review.service.ts`'s
    four public methods, per `architecture/notes/batch2-domain-research-v1.md`
    section 5.5. Every method here corresponds 1:1 to a query/mutation step
    documented there.
    """

    # --- shared cross-domain gates, re-checked on every write (never cached
    # across the whole flow), per migration plan section 10 ---

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None: ...

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None: ...

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None: ...

    async def resolve_growth_subject(
        self, family_id: str, onboarding_id: str
    ) -> tuple[str, set[str]]:
        """Port of `GrowthSubjectResolver.resolve` — returns
        `(child_person_id, guardian_person_ids)`. Raises `OutcomeConflictError`
        with the resolver's own error codes (`growth_subject_unresolved`,
        `growth_subject_ambiguous`, `growth_subject_is_not_child`,
        `growth_subject_guardian_unresolved`, `growth_subject_guardian_mismatch`)
        on failure, per batch2-domain-research-v1.md section 7.1.
        """
        ...

    async def load_person_type(self, person_id: str) -> str | None: ...

    # --- idempotency / audit / outbox, ported from lockOperation/loadOperationReplay/persistOperation/auditAndEmit ---

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None: ...

    async def load_operation_replay(
        self, tenant_id: str, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None: ...

    async def persist_operation(
        self,
        tenant_id: str,
        family_id: str,
        resource_id: str,
        actor_id: str,
        action: str,
        request_hash: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
    ) -> None: ...

    async def write_audit_and_outbox(
        self,
        family_id: str,
        actor_id: str,
        resource_id: str,
        action: str,
        event_name: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
        source: str,
    ) -> None: ...

    # --- OutcomeObservation ---

    async def insert_outcome_observation(self, observation: OutcomeObservation) -> None: ...

    async def list_observations_for_episode(self, intervention_episode_id: str) -> list[OutcomeObservation]: ...

    # --- GrowthReview ---

    async def load_review_by_episode(self, intervention_episode_id: str) -> GrowthReview | None: ...

    async def insert_growth_review(self, review: GrowthReview) -> None: ...

    # --- NextStepDecision ---

    async def load_review(self, family_id: str, review_id: str) -> GrowthReview | None: ...

    async def load_decision_by_review(self, review_id: str) -> NextStepDecision | None: ...

    async def insert_next_step_decision(self, decision: NextStepDecision) -> None: ...

    # --- Timeline (read-only 5-way union projection) ---

    async def load_timeline(self, family_id: str, onboarding_id: str) -> list[TimelineEntry]: ...
