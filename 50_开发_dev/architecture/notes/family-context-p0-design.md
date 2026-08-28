# Family Context P0 -- minimal cross-session retrieval design

Status: implemented (this task). Scope: read-only, no new storage, no
embeddings. Code: `backend/domains/family_context/` (domain/application/
infrastructure/tests, four-layer structure mirroring
`backend/domains/assessment/`).

## Problem this solves

Per `FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md` section 8 (San Qu methodology),
Family Context (cross-session long-term family memory) is the most basic of
the four exclusive-zone candidates, P0 priority. Before this task there was
no way for any caller (Principal, Assessment domain, a future orchestration
layer) to ask "what has this family told us / what has happened before,
across sessions" -- the only existing pieces were:

- `packages/family-model/src/index.ts`'s `FamilyMemoryDialogueRuntime` -- a
  pure candidate-builder (turns in, `FamilyMemoryUpdateCandidate` out), not
  wired to any call site, no persistence.
- `perspectives` / `evidence_records` queries in
  `backend/domains/assessment/infrastructure/sqlalchemy_repository.py` --
  scoped to one `onboarding_id` (via `idx_perspectives_onboarding_time`) or
  joined to one `assessment_session_id`, never read across a family's whole
  history.
- `packages/ai-gateway`'s `embed()` -- `FakeAiGateway` returns all-zero
  vectors, the real provider throws. No embeddings/pgvector exist anywhere
  in this codebase today.

## What was built

`FamilyContextPort` (Protocol, `application/ports.py`):

```python
async def get_recent_context(self, family_id: str, limit: int = 20) -> list[ContextEntry]
```

One method. Time-ordered (newest first), family-scoped, no
onboarding/session filter -- this is the entire P0 surface. Two
implementations, both with unit tests:

- `SqlAlchemyFamilyContextRepository` (`infrastructure/sqlalchemy_family_context.py`)
  -- real Postgres, reads `perspectives` and `evidence_records`, merges
  client-side, sorts, truncates to `limit`. Integration-tested against a
  real Postgres instance the same way
  `domains/assessment/infrastructure/ai_run_ledger.py` /
  `sqlalchemy_repository.py` are (`PY_ASSESSMENT_TEST_DATABASE_URL` env var,
  skipped if unset).
- `FakeFamilyContextRepository` (`infrastructure/fake_family_context.py`) --
  in-memory, for unit tests of any future caller (mirrors
  `FakeAiRunLedger`).

`ContextEntry` (`domain/entities.py`) is the single entity: `entry_id`,
`family_id`, `source` (`"perspective" | "evidence"`), `recorded_at`,
`summary`, `fact_boundary` (perspective's `PERSPECTIVE_NOT_FACT` label,
`None` for evidence rows -- evidence_records are not someone's statement, so
the perspective/fact boundary label does not apply), `raw` (the
source-specific payload, undecoded beyond jsonb parsing).

## Why this scope, and not more

This mirrors the `AssessmentInterpretationPort` / `AiRunLedgerPort` pattern
in `backend/domains/assessment/application/ports.py`: a small Protocol the
domain depends on, a real DB-backed adapter, and a Fake for tests -- no
speculative extra methods, no premature abstraction over "what kind of
context" a caller might want later.

The single most important constraint driving the P0 scope: **reuse, don't
duplicate storage**. Both `perspectives` and `evidence_records`
(`database/migrations/0003_growth_foundation.sql`) already carry `family_id`
as a direct column, not only reachable via `onboarding_id` -- so "read across
this family's whole history" required zero schema changes to the base
tables. The only DB change in this task is
`database/migrations/0046_family_context_recent_index.sql`, which adds two
indexes -- `(family_id, recorded_at desc)` on `perspectives` and
`(family_id, observed_at desc, created_at desc)` on `evidence_records` -- to
make the family-scoped-not-onboarding-scoped read efficient, without
touching or removing the existing onboarding-scoped index
(`idx_perspectives_onboarding_time`) that other callers still use. No new
tables were created.

## Explicitly NOT done in this task (deferred)

These are real gaps, deliberately deferred to keep this task "minimal
useful" rather than "complete Context Engine":

- **No embeddings / pgvector / semantic search.** `get_recent_context`
  returns the most recent N rows by timestamp only -- no relevance ranking,
  no similarity search. `packages/ai-gateway`'s `embed()` is still
  unimplemented for any real provider; wiring a real embedding path and a
  vector index is a separate, larger task once there is a concrete
  consumer that needs relevance-ranked (not just recency-ranked) retrieval.
- **No summarization / compression.** Long family histories are returned as
  raw `ContextEntry` rows, unbounded in total text size beyond the
  `limit` row count. A "long-term memory compressed into a running summary"
  layer (the kind of thing `FamilyMemoryDialogueRuntime`'s
  `FamilyMemoryUpdateCandidate` shape gestures at) is out of scope here.
- **No write path / update-candidate persistence.** This task is read-only.
  `FamilyMemoryDialogueRuntime.buildUpdateCandidate` still produces a
  candidate object with nowhere to land; wiring it to actually persist
  memory updates (and deciding whether that persistence is a new
  `perspectives`/`evidence_records` row vs. a new table) is separate future
  work.
- **No cross-table DB-side UNION.** The real repository queries
  `perspectives` and `evidence_records` separately and merges/sorts in
  Python, because the two tables' timestamp columns differ in name and
  nullability (`evidence_records.observed_at` is nullable, falls back to
  `created_at`); a hand-written SQL UNION would need to reconcile these
  anyway and is easy to get subtly wrong. If this call site becomes
  hot-path/high-volume, revisit as a materialized view or DB-side UNION.
- **No caller wiring.** Nothing in Assessment/Principal/`apps/family_api`
  calls `FamilyContextPort` yet -- this task delivers the port + two
  implementations + tests, not an integration into any existing request
  flow. The next step for whoever picks this up is choosing one concrete
  call site (e.g. `AssessmentQueryHandler` when building a UI-02/UI-03
  projection) and injecting a `FamilyContextPort` the same way
  `AiRunLedgerPort` is injected into the interpretation adapters today.

## Files

- `backend/domains/family_context/domain/entities.py` -- `ContextEntry`
- `backend/domains/family_context/application/ports.py` -- `FamilyContextPort`
- `backend/domains/family_context/infrastructure/sqlalchemy_family_context.py` -- real impl
- `backend/domains/family_context/infrastructure/fake_family_context.py` -- fake impl
- `backend/domains/family_context/tests/test_fake_family_context.py` -- unit tests
- `backend/domains/family_context/tests/test_sqlalchemy_family_context_integration.py` -- integration tests (skipped without `PY_ASSESSMENT_TEST_DATABASE_URL`)
- `database/migrations/0046_family_context_recent_index.sql` -- the two new indexes
