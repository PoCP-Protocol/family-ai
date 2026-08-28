# SHARDING KEY REGISTRY V1

```text
DOC_KIND     = GOVERNANCE_REFERENCE (not architecture freeze — see note below)
PARENT_DOC   = FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md (sections 5/7)
STATUS       = KEY_RESERVATION_ONLY — no physical sharding implemented
DATE         = 2026-08-28
```

## Purpose

Records the shard-key choice for every domain table, so that a future move to
physical horizontal sharding requires only a routing-layer change, not a data
model redesign. This is a documentation commitment, not an implementation —
per project-owner decision recorded 2026-08-28 (see
`50_开发_dev/CURRENT_SPRINT.md`): borrow the *shard-key-first* discipline
seen in large-scale platform architectures (reserve the key now, shard
physically only once real traffic data justifies the operational cost), not
the physical sharding itself. Family currently carries zero production
traffic — see migration plan section 11's own premise
("若当前尚未形成大规模生产用户，可以压缩为6-9个月").

## Rule

**Shard key is `family_id`, not `tenant_id`.** A family's data must never be
split across shards — cross-shard joins on a single family's own history
(sessions, responses, hypotheses, growth intents) would be the single most
common query pattern, and splitting them defeats the point of sharding.
`tenant_id` remains a secondary routing dimension (e.g. tenant-level policy
lookups), never the primary shard key.

This is the concrete form of the "per-Family-Home-Cell data isolation"
principle already stated in `FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 7 — this registry is where that intent becomes a literal per-table
decision, not a new principle.

## Assessment domain (Batch 1)

| Table | Shard key | Status | Note |
|---|---|---|---|
| `family_assessment_sessions` | `family_id` | Already shard-friendly | `idx_family_assessment_sessions_scope` is already `(tenant_id, family_id, status, updated_at)` — `family_id` is a natural index prefix, no schema change needed. |
| `family_assessment_responses` | `family_id` (via `assessment_session_id` FK) | Already shard-friendly | Always queried scoped to one session, which is scoped to one family. |
| `family_assessment_operations` | `family_id` | Already shard-friendly | Idempotency table, unique on `(tenant_id, family_id, action_name, idempotency_key)` — `family_id` already leads. |
| `family_growth_hypothesis_decisions` | `family_id` | Already shard-friendly | Same pattern as above. |
| `family_assessment_tools` | Not sharded (global reference table) | N/A | Tool definitions are tenant/family-independent; small, rarely written, replicated to every shard if sharding is ever implemented. |
| `family_need_types` | Not sharded (global reference table) | N/A | Same reasoning as `family_assessment_tools`. |
| `evidence_records` | `family_id` | Already shard-friendly | Queried via `source_ref`/`family_id`, both scoped within one family. |
| `growth_intents` | `family_id` | Already shard-friendly | Batch 2 will confirm this when that domain is migrated — recorded here because Assessment's `load_or_create_growth_intent` already writes to it. |

**Conclusion for Batch 1**: no table structure changes required. The existing
NestJS schema was already designed with `family_id` as a natural index
prefix (likely for tenant/family scoping reasons, not sharding foresight —
but the effect is the same). This registry formalizes that property as a
guarantee for future physical sharding, not a new requirement on the schema.

## Deferred to later batches

- **Batch 2** (Family/GrowthPlan/Intervention/Action/Outcome) must confirm
  `growth_actions`/`intervention_episodes`/`growth_profiles` follow the same
  `family_id`-first rule when that domain is ported.
- **Physical sharding implementation** (routing layer, shard-aware
  connection pool, cross-shard query prohibition enforcement) is explicitly
  out of scope until real production read/write QPS data justifies it. Do
  not implement a shard router speculatively.

## Feed-style wide-table pattern — recorded for Batch 2, not applied here

The project owner also asked to borrow the Feed/timeline wide-table design
pattern common in large-scale content platforms (heterogeneous event types
in one denormalized, reverse-chronological-read-optimized table, rather than
strict relational normalization). Assessment domain is NOT a fit for this —
it is a strongly structured "session + response" relational model where
normalization is the correct choice.

The natural fit is the family growth timeline (`growth_actions` and related
event streams in Batch 2's scope) — "scroll reverse-chronologically through
mixed event types" is exactly the Feed pattern's classic use case. This is
recorded here as a design note for whoever picks up Batch 2, not implemented
in this document or in Batch 1's code.

## Read/write separation + caching — recorded, partially implemented in Batch 1

- **Cache reads, never writes.** Mutation paths (start/save_response/submit/
  decide) must stay strongly consistent (idempotency-key replay, advisory
  locks, audit writes) — caching them would break those guarantees. This
  mirrors the same large-scale-platform principle: writes go through the
  primary for consistency, reads can tolerate short staleness.
- Read-side caching for the two highest-frequency read paths (`get_ui02_projection`/
  `get_ui03_projection`) is implemented in
  `backend/domains/assessment/infrastructure/cached_query_handler.py` —
  see that file and its tests for the concrete short-TTL, passive-expiry
  design (no active invalidation on write; justified there for this
  domain's write frequency).
- **Read replicas (primary/replica DB topology) are a deployment-topology
  decision, not a code decision** — not implemented in this task. Requires
  real read QPS data to justify before introducing replica-lag handling
  complexity.
