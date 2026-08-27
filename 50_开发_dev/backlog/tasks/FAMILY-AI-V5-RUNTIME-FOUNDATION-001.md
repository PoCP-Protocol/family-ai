# FAMILY-AI-V5-RUNTIME-FOUNDATION-001

status: PROPOSED_FOR_APPROVAL
type: ARCHITECTURE_AND_CONTRACT_GATE
gate: V5-00_RUNTIME_TRUTH
source_plan: docs/FAMILY_AI_PLATFORM_V5_ADOPTION_PLAN.md

## Goal

Adopt the V5 runtime foundation without expanding product scope. Establish the engineering contracts required for Family Growth Intelligence & Ecosystem OS before any new UI, autonomous agent, school integration, or model-training work proceeds.

## Scope

This task is a planning and contract convergence task. It may create or update architecture docs, contract indexes, backlog tasks, and validation checklists. It must not add business runtime features, database migrations, production AI autonomy, pilot exposure, or direct external model calls.

## Must Preserve

- V4/V4.1 hard rules remain active.
- `Perspective != Fact`.
- `Hypothesis != Fact`.
- `Recommendation != Decision != Action`.
- No Family Total Score.
- No child/family ranking.
- AI cannot directly mutate canonical state.
- Named Action remains the only write path for core state.
- Model Gateway remains the only model invocation path.
- Human Gate remains mandatory for high-risk family scenarios.

## Required Reads

1. `CLAUDE.md`
2. `PROJECT_STATUS.md`
3. `CURRENT_SPRINT.md`
4. `ENGINEERING_CONTRACT_INDEX.md`
5. `docs/FAMILY_AI_PLATFORM_V5_ADOPTION_PLAN.md`
6. `architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md`
7. `docs/FAMILY_GROWTH_PLATFORM_TECH_ARCH_V4_2.md`
8. `docs/FAMILY_AI_CODEX_HARNESS_ENGINEERING_CAPABILITY_ROADMAP_V0_1.md`
9. `docs/model/family_model_harness.integration.yaml`

## Work Items

1. Runtime truth inventory
   - Map existing Family Core, Growth, Principal Runtime, Case/SLA, Consent, Model Gateway, and Harness assets to V5 planes.
   - Identify stale or conflicting runtime claims.
   - Produce a no-code convergence report.

2. Subject isolation contract
   - Define the canonical subject boundary for child, parent, teacher, school, provider, and operations views.
   - Confirm that no implementation path depends on a global child super-profile.
   - Identify API and data contracts needing future tightening.

3. Authorization planes contract
   - Separate Family Trust Zone, School Trust Zone, Partner Trust Zone, and Operations visibility.
   - Define minimum Purpose Grant semantics for future school/provider access.
   - Keep DB direct access forbidden for providers and agents.

4. FamilyNow contract
   - Define FamilyNow as an aggregated current-state read model, not canonical truth.
   - Specify allowed inputs: facts, perspectives, observations, evidence, hypotheses, actions, service cases, and reviews.
   - Specify forbidden outputs: total scores, rankings, fixed child labels, and unreviewed clinical claims.

5. FTCC v1 contract
   - Define `FamilyTrustedContextCapsule` fields and lifecycle.
   - Require purpose, requester, recipient, subject, consent snapshot, provenance, expiry, risk flags, human gate, and trace ID.
   - Require different capsules for parent, teacher, school, provider, and operations.

6. Harness boundary contract
   - Define `FamilyHarnessAdapter` as the only boundary between Family Intelligence Use Case and Codex App Server.
   - Forbid UI-to-Codex and Codex-to-SQL paths.
   - Require agent write paths to produce Proposal only.

7. 90-day execution decomposition
   - Create follow-up task packs V5-01 through V5-10.
   - Each task must declare scope, non-goals, gates, validation, and rollback posture.

## Non-Goals

- No UI-36.
- No direct Codex fork.
- No direct Agent SQL.
- No new production model training.
- No autonomous high-risk AI.
- No Kafka, Neo4j, or Kubernetes adoption as a phase target.
- No school/provider integration implementation before trust-zone contracts are accepted.
- No database schema migration in this task.

## Deliverables

- `reports/v5/V5_00_RUNTIME_TRUTH_CONVERGENCE_REPORT.md`
- `architecture/platform/FAMILY_TRUSTED_CONTEXT_CAPSULE_V1.md`
- `architecture/orchestration/FAMILY_HARNESS_ADAPTER_BOUNDARY_V1.md`
- `architecture/platform/FAMILY_GROWTH_EVIDENCE_GRAPH_DIRECTION_V1.md`
- Follow-up task packs for V5-01 through V5-10

## Acceptance Criteria

- V5 nine-plane architecture is mapped to current V4.1/V4.2 assets.
- FTCC v1 minimum field set is documented and aligned with consent and purpose boundaries.
- FamilyHarnessAdapter boundary is documented and forbids direct UI-to-Codex, Codex-to-SQL, and agent canonical-state mutation.
- Growth Evidence Graph direction explicitly rejects total scoring, ranking, and fixed child labels.
- 90-day Patch Line exists as task packs with non-goals and validation gates.
- Existing validation commands still pass where applicable.

## Suggested Validation

```powershell
pnpm --dir .\50_开发_dev run validate:model-assets
pnpm --dir .\50_开发_dev run harness:family-model:distill-full
git diff --check
```
