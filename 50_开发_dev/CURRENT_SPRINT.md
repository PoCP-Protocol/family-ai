# Current Sprint

task_id: FAMILY-AI-ARCHITECTURE-V4-1-CONVERGENCE-001
gate: G1-A (ARCHITECTURE_AND_CONTRACT_CONVERGENCE)
status: IN_PROGRESS

## Current Executable Truth (2026-08-23, Chief Architect)

```text
TASK               = FAMILY-AI-ARCHITECTURE-V4-1-CONVERGENCE-001
GATE               = G1-A ARCHITECTURE_AND_CONTRACT_CONVERGENCE
BASE_SHA           = f2eeacc69fff78b17f45b78a7ab631543ee8cf2a
WORK_BRANCH        = architecture/family-ai-v4-1-convergence-001
TECH_ARCHITECTURE  = FAMILY_AI_PLATFORM_V4_1 TARGET_FROZEN
CONSUMER_UI_BASELINE     = KEEP
UI35_DELETED       = YES
AI_DIAGNOSIS       = KEEP
G1_A_AUTHORIZED    = YES
G1_B_PLUS          = AUTHORIZED  # 2026-08-26, Project Owner override (not Chief Architect) — see note below
BUSINESS_RUNTIME   = INTERNAL_LOCAL_AUTHORIZED_FOR_FAMILY_ASSESSMENT_MODEL
DB_SCHEMA_CHANGE   = AUTHORIZED  # 2026-08-26, Project Owner override (not Chief Architect) — see note below
LIVE_EXTERNAL_AI   = INTERNAL_LOCAL_AUTHORIZED_FOR_UI02_FAMILY_MODEL_GATEWAY
DIRECT_PUSH_MAIN   = NO
AUTO_MERGE         = NO
AGENT_SELF_AUTH    = NO
EXACT_HEAD_REVIEW  = REQUIRED
```

Authorization scope:

- Authorization source: `governance/AUTHORIZATION_REGISTRY.yaml` capability `G1A_FAMILY_EDUCATION_ASSESSMENT_MODEL_INTERNAL`.
- Allowed now: package/API-local wiring for UI-02/UI-03 Family Education Assessment Model runtime, through `@family/family-model` and `@family/ai-gateway` only.
- Live external model call: allowed only in local/internal explicitly configured environments; default `.env.example` remains mock and fail-closed.
- Still forbidden: direct provider calls, client-side model calls, pilot exposure, production default enablement, and AI direct canonical Family/Growth state mutation.

**2026-08-26 Project Owner Override (not a Chief Architect ruling — recorded separately, original G1-A block above left unmodified in substance):**
The project owner explicitly authorized `G1_B_PLUS` and `DB_SCHEMA_CHANGE` for the pre-existing service-collaboration-allocation feature line (`feat/service-collab-allocation-p0-002` and its history: `9d9de4d`→`e84a919`→`a0ea305`→`8427997`→`6eef592`), plus the 4 branches built on top of it today (`feat/theory-whitelist-registry-001`, `feat/academic-need-classification-g1a-001`, `feat/service-product-registry-001`, `feat/growth-priority-theory-basis-001`). This override was requested verbally in-session by the project owner, not by the Chief Architect who signed the G1-A block above — recorded here for traceability, not silently merged into the original ruling. `governance/AUTHORIZATION_REGISTRY.yaml` has no corresponding entry yet; a formal registry entry should still be added before treating this as durable (this note is the interim record). `AUTO_MERGE` and `DIRECT_PUSH_MAIN` remain `NO` — this override unblocks PR creation and review, not unreviewed merge.

**2026-08-27 Project Owner Override #2 (GOLDEN_GROWTH_LOOP UI-02 real-content closure — confirmed after concrete-plan review):**
The project owner reviewed a concrete implementation plan (per-file breakdown of the 8 hardcoded `M2GrowthDimensionId` sites across 6 files + 2 DB CHECK constraints, and the family-model package's actual dependency footprint) and explicitly authorized:
1. Bringing `@family/family-model`'s `FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK` constant data (not the LLM runtime — `FamilyEducationModelRuntime`/`assertInterpretationBoundary` and any live external model call remain out of scope, unaffected by G1-A's existing mock/fail-closed default) into `main`, sourced fresh from `packages/family-model/` on `feat/family-memory-p0-subject-scope-001` as standalone files in a new commit — not a cherry-pick of `c53a040` or `44aa11c`, both of which carry unrelated changes.
2. Widening `M2GrowthDimensionId` by exactly two values: `C_HOMEWORK_PROCESS`, `C_DEVICE_USE_CONTEXT` (confirmed naming, not the full 16-construct item-bank vocabulary).
3. A new `family.service.ts` orchestration method that, on UI-02 assessment submission, auto-chains `recordPerspective`(per item) → `buildGrowthProfileDrafts` → `confirmGrowthPriority` → `startIntervention` — i.e. all the way through to real `growth_actions` creation, so UI-09 shows a real today-task after a parent submits the assessment. This is a wider automation than the original plan draft (which stopped at priority-confirm); the project owner explicitly extended it to `startIntervention` in this confirmation round.
Excluded (unchanged from the original G1-A scope and from `confirmGrowthPriority`'s DB-level evidence rule): `assertRequiredGrowthConsents` is not bypassed; perspectives must still originate from the onboarding they're confirmed against; no live external model call. `AUTO_MERGE`/`DIRECT_PUSH_MAIN` remain `NO`. `governance/AUTHORIZATION_REGISTRY.yaml` needs a corresponding formal entry (capability `G1A_FAMILY_EDUCATION_ASSESSMENT_MODEL_INTERNAL` was never registered on `main` at all — this is being added, not amended) before this is durable; this note is the interim record.

Program: 21-Day Program is carried by UI-14/UI-09/UI-31/UI-34; UI-35 is deleted from the product baseline.
Architecture: `architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` — **SUPERSEDED as of 2026-08-28, see below.**

---

## 2026-08-28 Project Owner Override #3 — ARCHITECTURE BASELINE REPLACEMENT: Python-only backend (SUPERSEDES V4.1 `TARGET_FROZEN`)

**This is a project-owner architectural override, not a Chief Architect ruling.** It replaces the frozen target of `architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` (business=TypeScript/NestJS, intelligence=Python split) with a new target:

```text
NEW_TARGET_ARCHITECTURE = PYTHON_ONLY_BACKEND
FRONTEND                = TypeScript (React Native app / React-Next.js web / ops web / OpenAPI-generated SDK) — UNCHANGED
BACKEND                 = Python (API, identity/tenancy, all business domains, AI runtime, workflow, data access, migrations)
MIGRATION_MODE          = ONE_WAY_DOMAIN_TAKEOVER  # per domain: NEST_ACTIVE → PYTHON_READY → CUTOVER → PYTHON_ACTIVE → NEST_REMOVED
DUAL_WRITE              = FORBIDDEN
DUAL_PRIMARY            = FORBIDDEN
V4_1_STATUS             = SUPERSEDED_NOT_DELETED  # kept as historical record of the prior frozen target
FIRST_TASK              = FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001 (assessment domain full vertical migration)
```

**Decision recorded (project owner, in-session, 2026-08-28):**
1. New frozen architecture baseline is Python-only backend + TypeScript frontend, per the plan authored this session (`50_开发_dev/architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` — committed as part of this override's paper trail).
2. Migration is one-way domain takeover, not a big-bang rewrite — one domain has exactly one active runtime owner at any time; NestJS/Python dual-write and dual-primary are explicitly forbidden for any domain during transition.
3. First development task authorized: `FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001` — build the Python workspace (`backend/` under `50_开发_dev/`) and migrate the Assessment domain (UI-02/UI-03, AssessmentSession/Response/Evidence/Interpretation, GrowthHypothesis, GrowthIntent bridging) as the first full vertical slice, **including** deregistering/removing the NestJS assessment Controller once the Python path is verified end-to-end. This is a wider authorization than a workspace-skeleton-only start — deregistration/removal of the NestJS assessment module is explicitly in scope for this first task, not deferred to a later confirmation round.
4. Three PRs opened earlier today under the now-superseded V4.1 target (`#19` communication-conflict closed loop, `#10` `@family/family-model` package, `#21` AI use case ↔ code mapping) are **paused** — no further development or merge review continues on them while this migration is in flight. They remain open (not closed) as a record of validated NestJS-era work; whether their domain logic is ported into the Python migration or left to lapse is a decision for when their respective domains are reached in the migration order below, not now.

**Migration order (per the plan; first batch only is currently authorized to start):**
```text
Batch 1 (AUTHORIZED, IN_PROGRESS) = Platform foundation + Assessment domain (UI-02/UI-03)
Batch 2 (NOT YET AUTHORIZED)      = Family/Relationship/Consent/GrowthIntent/GrowthPlan/Intervention/Action/Outcome
Batch 3 (NOT YET AUTHORIZED)      = Principal/Conversation/Agent Runtime/Human Handoff
Batch 4 (NOT YET AUTHORIZED)      = 21-Day Program
Batch 5 (NOT YET AUTHORIZED)      = Resource/Service/Expert/Organization
Batch 6 (NOT YET AUTHORIZED)      = Content/Community/Commerce
Batch 7 (NOT YET AUTHORIZED)      = Design/Product Blueprint platform
Batch 8 (NOT YET AUTHORIZED)      = Full NestJS deletion + production hardening
```
Only Batch 1 is authorized to begin. Each subsequent batch requires its own explicit project-owner confirmation before starting, following the same pattern as this override (concrete plan review, not verbal blanket delegation).

**Unchanged from prior governance (still binding):** `AUTO_MERGE=NO`, `DIRECT_PUSH_MAIN=NO`, `AGENT_SELF_AUTH=NO`, `EXACT_HEAD_REVIEW=REQUIRED`. Consent/safety/human-confirmation/fact-boundary rules carried over from the NestJS implementation must be preserved in the Python port, not weakened in translation. `governance/AUTHORIZATION_REGISTRY.yaml` needs a corresponding formal entry (new capability id, e.g. `PYTHON_ONLY_ARCHITECTURE_MIGRATION_BATCH_1`) before this override is durable; this note is the interim record.

All older sprint/M2/M3/G0 sections below are historical context, not current execution truth.

---

# HISTORICAL_IMPORTED_CONTEXT — M3-RB-002 (前 Current, PASS_CLOSED)

sprint_id: M3-RB-002
sprint_name: Family 1.0 MOS V3.3 Execution Rebaseline
status: PASS_CLOSED

## M3-RB-002 Status

```text
M3_RB_001 = PASS_CLOSED
M3_RB_002 = PASS_CLOSED           # V3.3 SSOT 收敛完成(2026-08-11)
EXECUTION_SSOT = V3.3
V3_0 = SUPERSEDED_FOR_EXECUTION
M2 = CLOSED
M3 = NOW (FAMILY_1_0_MINIMUM_OPERABLE_SYSTEM)
M3_000 = PASS_CLOSED
M3_101A = PASS_ACCEPTED           # 架构师裁决正式验收(见 admission 分支 M3_RUNTIME_ARCHITECT_ADJUDICATION)
M3_101B_108 = INTEGRATION_CANDIDATE  # 代码在 m3/fpai-runtime-admission-fix;经 M3-INT-001 治理约束
M3_INT_001 = TRANCHE_1_2_DONE (B1-B3);B4=本 RB-002(已收口)
M3_REAL_EXTERNAL_MODEL = NOT_AUTHORIZED  # 默认外呼关闭;授权唯一来源=governance/AUTHORIZATION_REGISTRY.yaml
PROGRAM_BASELINE_SHA = 8cadeb65cca205f3d2fe23b141988d6342444cc7
PROGRAM_INTEGRATION_BRANCH = m3/family-1-0-mos
DEFAULT_BRANCH = master
M2_WAVE4_INTELLIGENCE = SUPERSEDED_FOR_EXECUTION_BY_CCR (owner: M3-W1)
NEXT_GATE = M3-INT-001 Runtime Admission PR (m3/fpai-runtime-admission-fix → m3/family-1-0-mos) → M3-W1 最终评审;AUTO_MERGE=NO
```

---

# HISTORICAL — M2 Wave 3 (CLOSED)

sprint_id: M2-WAVE3 · status: CLOSED · 仅保留历史，不再作为 Current。

## Wave3 Closed Status

```text
M2_WAVE3 = CLOSED
PHASE_A_CONTRACT_FREEZE = PASS
API_REAL_POSTGRESQL_HTTP_E2E = PASS_12_TESTS
WEB_UNIT_TESTS = PASS_19_TESTS
WEB_TYPECHECK = PASS
BROWSER_F10_F11_GATE = PASS_REAL_API_DESKTOP_MOBILE
AI06_INDEPENDENT_GOVERNANCE_REVIEW = PASS
AI07_INDEPENDENT_ARCHITECTURE_PRODUCT_REVIEW = PASS
GITHUB_CI = PASS_RUN_31438263608
GITHUB_REMOTE_CONVERGENCE = PASS_758B1ED_BASELINE
FINAL_ARCHITECT_SIGNOFF = PASS
WAVE3_BLOCKERS = 0
READY_FOR_M3_RUNTIME = NO
START_M3_RUNTIME = NO
M3_RUNTIME = NOT_AUTHORIZED
F12_AI = NOT_STARTED
```

Latest Wave3 browser evidence:

- `reports/m2/wave3/M2_WAVE3_BROWSER_EVIDENCE.md`
- `reports/m2/wave3/M2_WAVE3_GOVERNANCE_PRE_REVIEW.md`
- `reports/m2/wave3/AI06_GOVERNANCE_REVIEW_REPORT.md`
- `reports/m2/wave3/AI07_ARCHITECTURE_PRODUCT_REVIEW_REPORT.md`

Closure record:

1. Final Wave3 closure certificate reviewed and signed off by the chief architect: FINAL_ARCHITECT_SIGNOFF = PASS.
2. `PROJECT_STATUS.md` reconciled from authoritative remote HEAD `758b1ed` with targeted Wave3 closure edits; unrelated dirty worktree files left untouched.
3. WAVE3_BLOCKERS = 0. Next step is a separate M3 / Famili Principal Intelligence Architecture & Contract Gate; M3 runtime remains NOT_AUTHORIZED.

---

# Sprint 0 — Bootstrap

按顺序：

1. `TASK-000_REPO_AUDIT`
2. `TASK-001_ENGINEERING_BOOTSTRAP`
3. `TASK-002_ENGINEERING_CONTRACT_VALIDATION`

Sprint 0只有TASK-002验证PASS后才完成。

Sprint 0完成条件：
- Repo结构清楚
- 本地/DEV可运行
- lint/test/build可执行
- API基础项目可启动
- DB migration机制存在
- Audit基础能力存在

---

# Sprint 1 — Family Core

只有Sprint 0 PASS后才能开始。

Approved Tasks：

1. `TASK-101_CREATE_FAMILY`
2. `TASK-102_ADD_PARENT`
3. `TASK-103_ADD_CHILD`
4. `TASK-104_CREATE_RELATIONSHIP`
5. `TASK-105_ASSIGN_LIFE_STAGE`
6. `TASK-106_GRANT_CONSENT`
7. `TASK-107_FAMILY_CORE_INTEGRATION`

Sprint 1 status: CLOSED after TASK-107 PASS on 2026-08-10.

---

# Explicitly Out of Scope

本Sprint禁止开发：

- GrowthProfile
- GrowthPriority
- 90-Day Journey
- Intervention
- AI Agent
- Model Gateway
- Membership
- Community
- World Model
- CRM migration beyond interface placeholder

---

# Sprint Definition of Done

最终必须能通过API和Integration Test完成：

```text
Create Family
→ Add Parent
→ Add Child
→ Create Relationship
→ Assign LifeStage = EARLY_ADOLESCENCE_12_15
→ Grant SERVICE consent
→ Read Family Aggregate
```

并且：

- 每个写操作有Audit
- 支持correlation_id
- 关键写操作具备幂等策略
- 权限失败正确返回
- Schema invalid正确返回
- Unit / Integration tests通过

Sprint DoD status: PASS. M1 is closed.

---

# M2 Planning Gate — V3.0 Rebaseline

Approved planning task:

1. `M2-000_FIRST_GROWTH_SLICE_DEFINITION`

M2-000 status: PASS_V3_0_CONTRACT_GATE on 2026-08-10.

V3.0 SSOT: `10_规格_spec/04_实施计划/PLAN_SSOT_V3.0.md`.
Active M2 sprint brief: `CURRENT_SPRINT_M2_000.md`.

Previous M2-000 attempt failed because Frontend / UI / UX was insufficient. V3.0 rebaseline kept that ruling as input and restarted M2-000 as a stricter Product Vertical Slice Contract Gate. The V3.0 M2-000 gate is now PASS with BLOCKERS=0 and READY_FOR_M2_WAVE1=YES.

M2-000 outputs:

- First Growth Slice definition.
- Domain Objects.
- Proposed contracts.
- AI minimum architecture.
- Consent/Safety/Human Gate.
- Outcome evaluation plan.
- User Journey.
- Information Architecture.
- Frontend Architecture.
- Screen Map F01-F12.
- UI State Model.
- Frontend Backend Contract Matrix.
- M2 implementation backlog.

M2 delivery rule:

```text
Domain Contract + API + Frontend + E2E + Demo
```

Family Web / Responsive Web is the only approved first frontend target. Native App and Mini Program are deferred.

M2 business implementation status: M2_101_COMPLETED_ONLY.
M2 frontend runtime implementation status: F01_F02_COMPLETED_ONLY.
M2 gate blocker: NONE for M2-000.

User approval recorded: automatic review completed and automatic continuation approved on 2026-08-10.

M2 Wave 1 status: PASS / CLOSED on 2026-08-10.

Completed Wave 1 tasks:

1. `M2-101_START_GROWTH_ONBOARDING`
2. `M2-102_RECORD_PERSPECTIVE_AND_EVIDENCE`
3. `M2-103_EVIDENCE_SYNTHESIS_AND_LIMITED_GROWTH_PROFILE`

Last completed task:

```text
M2-103_EVIDENCE_SYNTHESIS_AND_LIMITED_GROWTH_PROFILE
```

M2 Wave 2 Phase A status: PASS / CLOSED.

Approved Phase B task:

```text
M2-WAVE2-PHASE-B
```

Current wave:

```text
M2_WAVE_3_OBSERVE_AND_REVIEW
```

Current phase:

```text
PHASE_B_PRODUCT_CLOSURE_IN_PROGRESS
```

Active task:

```text
none; Wave3 CLOSED; awaiting separate M3 Contract / Architecture Authorization Gate
```

Stage ruling:

```text
M2_WAVE_1 = CLOSED
M2_WAVE_2_DECIDE_AND_ACT = PASS
M2_WAVE_2 = CLOSED
AI05_REAL_SYSTEM = PASS
WAVE2_AI06_FINAL_GOVERNANCE = PASS_HISTORICAL
WAVE2_AI07_INDEPENDENT_REVIEW = PASS_HISTORICAL
WAVE3_AI06_INDEPENDENT_GOVERNANCE = PASS
WAVE3_AI07_INDEPENDENT_REVIEW = PASS
BLOCKERS = 0
V3_2_ARCHITECTURE_REBASELINE = APPROVED
V3_2_ARCHITECTURE_GATE = PASS
M2_WAVE_3 = AUTHORIZED
READY_FOR_WAVE3 = YES
START_WAVE3 = YES
M3_RUNTIME = NOT_AUTHORIZED
```

Wave3 product scope:

```text
F10 Family Timeline = YES
F11 Growth Review = YES
F12 Family AI = NO
```

Wave3 runtime scope:

```text
DETERMINISTIC = YES
LLM_RUNTIME = NO
MODEL_GATEWAY = NO
AGENT_RUNTIME = NO
FPAI_RUNTIME = NO
WORLD_MODEL = NO
CAUSAL_ENGINE = NO
```

Approved Phase A outputs:

- `reports/m2/wave3/CCR-M2-WAVE4-001.md`
- `reports/m2/wave3/M2_WAVE3_CONTRACT_FREEZE_V1.md`
- `reports/m2/wave3/M2_WAVE3_SHARED_FILE_MATRIX.md`

Wave3 deterministic F10/F11 implementation, browser validation, governance (AI06/AI07), GitHub Required Gates, remote convergence, and final architect signoff have all passed. Wave3 is CLOSED; M3 runtime remains closed and requires a separate authorization gate.

Stage ruling:

```text
M2_WAVE_1 = CLOSED
M2_WAVE_2 = CLOSED
M2_WAVE_3 = CLOSED
M2_DETERMINISTIC_GROWTH_LOOP = CLOSED
FINAL_ARCHITECT_SIGNOFF = PASS
WAVE3_BLOCKERS = 0
READY_FOR_M3_RUNTIME = NO
START_M3_RUNTIME = NO
M3_RUNTIME = NOT_AUTHORIZED
STATE_ALIGNMENT = PASS_WAVE3_CLOSED_M3_NOT_AUTHORIZED
```

Historical Wave2 integration streams:

1. STREAM-A Schema / Contract Compatibility — AI-03
2. STREAM-B API / Module / Orchestration Integration — AI-00
3. STREAM-C Frontend F01/F06/F07/F08/F09 Real Integration — AI-04
4. STREAM-D Real PostgreSQL + HTTP E2E + Browser QA — AI-05
5. STREAM-E Governance Pre-Review — AI-06
6. Domain Fix Owner: GrowthPriority — AI-01
7. Domain Fix Owner: Intervention / GrowthAction — AI-02
8. Independent Review after Barriers 1-5 — AI-07

Historical Wave2 Phase B boundary:

- `reports/m2/wave2/M2_WAVE2_CONTRACT_FREEZE.md` is immutable baseline `M2_WAVE2_CF_V1`.
- `reports/m2/wave2/SHARED_FILE_CONFLICT_MATRIX.md` is approved and binding.
- Any contract change requires `CONTRACT_CHANGE_REQUEST`; no role may freely edit the freeze baseline.
- Wave 3 planning and deterministic F10/F11 runtime were later authorized by Wave3 Phase A gate and are now browser-verified. M3 runtime code remains forbidden without explicit authorization.
- `growth_journeys.subject_person_id` is not approved; subject resolution must use canonical Family/Growth/Onboarding/Profile relations or a minimal resolver boundary.
- `growth_actions` legacy dual-write is allowed only as `TEMPORARY_SCHEMA_COMPATIBILITY` after semantic audit.

Phase B2 status artifacts:

- `reports/m2/wave2/integration/PHASE_B2_INTEGRATION_CONVERGENCE_DIRECTIVE.md`
- `reports/m2/wave2/integration/INTEGRATION_DASHBOARD.md`
- `reports/m2/wave2/integration/status/AI00_STATUS.md` through `AI06_STATUS.md`
