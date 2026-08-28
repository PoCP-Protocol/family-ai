# FAMILY AI — PYTHON-ONLY BACKEND MIGRATION PLAN V1

```text
DOC_KIND        = GOVERNANCE_SSOT / TECHNICAL_ARCHITECTURE_FREEZE (NEW BASELINE)
ARCHITECTURE_ID = FAMILY_AI_PLATFORM_PYTHON_ONLY_V1
TASK            = FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001 (first authorized task)
DATE            = 2026-08-28
SUPERSEDES      = FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md (kept as historical record, not deleted)
STATUS          = TARGET_FROZEN
AUTHORIZED_BY   = project-owner (verbal in-session override, recorded in CURRENT_SPRINT.md Override #3)
```

Recorded verbatim from the project owner's directive (2026-08-28) as the paper trail for `CURRENT_SPRINT.md` Override #3. This document is the SSOT for the Python-only migration; `CURRENT_SPRINT.md` tracks which batch is currently authorized.

---

## 1. Decision

Target architecture is Python-only backend + TypeScript frontend:

```text
Frontend  = TypeScript (React Native app, React/Next.js web, ops/admin web, OpenAPI-generated SDK, minimal BFF types)
Backend   = Python (API, identity/auth, tenancy/org/family, consent, assessment, growth intent/plan/action/outcome,
            program delivery, content/resource/service, teacher/expert/org collaboration, Principal + all agents,
            Family Context & Memory, AI Runtime, Workflow, RAG/knowledge, Eval/learning, product/service design
            platform, background jobs, data access & migrations)
```

Eventually removed: NestJS business API, `@family/ai-gateway`, TS `principal-runtime`, TS `program-runtime`, TS
`family-model` execution logic, mobile-server direct LLM calls, all TS provider SDKs and keys. Domain rules,
schemas, tests and governance assets with lasting value are ported to Python, not discarded — see "port, don't
discard" note per batch below.

Migration mode: **one-way domain takeover**, not a big-bang rewrite. Per domain:

```text
NEST_ACTIVE → PYTHON_READY → CUTOVER → PYTHON_ACTIVE → NEST_REMOVED
```

`PYTHON_READY` runs only in test/staging, never against production family traffic. No domain has two active
primaries at any time. Dual-write is forbidden. Rollback = roll back the Python deployment + compatible DB
migration; do not resurrect NestJS as a long-running fallback.

## 2. Three Python runtime processes, one monorepo

```text
family-api        = business API, auth, family/growth/plan/service, canonical facts
ai-runtime         = skills, agents, model providers, RAG, safety, eval, AI run ledger
workflow-worker    = long-running tasks, human confirmation waits, multi-day flows, cross-module orchestration
```

All three share `packages/contracts`, `packages/platform_kernel`, `packages/persistence`, `packages/events`,
`packages/observability`, `packages/security`, `packages/testing` inside one `uv` workspace, independently
deployable/scalable.

## 3. Monorepo layout

```text
50_开发_dev/backend/
  pyproject.toml
  uv.lock
  apps/{family_api,ai_runtime,workflow_worker}/main.py
  packages/{contracts,platform_kernel,persistence,events,observability,security,testing}/
  domains/{identity,tenancy,organization,family,consent,assessment,growth,journey,action,outcome,
           program,content,resource,service,expert,community,commerce,entitlement}/
  intelligence/{context,memory,skills,prompts,schemas,providers,conversation,agents,tools,safety,
                evaluation,knowledge,recommendation,design_copilot}/
  workflows/{assessment_workflow,growth_plan_workflow,program_workflow,service_workflow,
             human_review_workflow,design_release_workflow}/
  migrations/{identity,family,growth,program,service,ai_runtime}/
  tests/{unit,contract,integration,e2e,golden,safety,livecheck,load}/
```

Each domain follows a fixed four-layer structure (example: `domains/assessment/`):

```text
api/{routes,requests,responses}.py           # HTTP only
application/{commands,queries,handlers,ports}.py  # use-case orchestration
domain/{entities,value_objects,policies,events,errors}.py  # no FastAPI/SQLAlchemy/provider SDK dependency
infrastructure/{sqlalchemy_models,repositories,projections}.py  # DB + external services
```

Cross-domain interaction only through Command/Query/Event/Port — no domain imports another domain's
repository directly.

## 4. Tech stack

Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 · Alembic · PostgreSQL · Redis · Temporal (Python SDK) ·
httpx · pytest/pytest-asyncio · Ruff · mypy · OpenTelemetry · uv · S3-compatible storage · PostgreSQL
Transactional Outbox (event bus starting point; Kafka/Redpanda/Pulsar for scale) · pgvector (starting point
for vector search).

## 5. Database

One PostgreSQL cluster, per-domain schemas (`identity.*`, `tenancy.*`, `family.*`, `consent.*`, `assessment.*`,
`growth.*`, `journey.*`, `program.*`, `service.*`, `content.*`, `ai_runtime.*`), each with its own DB role
scoped to that schema plus minimal cross-domain read projections — never direct cross-schema writes.

Each schema has exactly one migration owner at a time: NestJS/SQL migrations until cutover, Alembic after.
Never both simultaneously on the same schema. Pre-existing schemas get an Alembic baseline revision rather
than being rewritten from scratch; all migrations after baseline are Alembic-only.

No dual-write during migration:

```text
build Python impl → offline data validation → stop NestJS writes → switch API routes → Python is sole writer
→ remove NestJS write path
```

Cross-domain consistency: intra-domain PostgreSQL transactions; cross-domain via
Command → Domain Transaction → Transactional Outbox → Event → idempotent downstream consumer. No global
distributed transactions.

## 6. AI Runtime (Python, full ownership)

```text
AI Control Plane · Skill Runtime · Prompt Registry · Schema Registry · Context Broker · Memory System ·
Conversation Runtime · Agent Runtime · Tool Runtime · Model Router · Provider Gateway · RAG · Safety ·
Evidence · Evaluation · AI Run Ledger · Design Copilot
```

Call chain:

```text
Python Business Domain → Consent & Purpose → Immutable Context Snapshot → Python AI Runtime → Skill →
Model Provider → Schema/Evidence/Safety/Eval → AI Run → Domain Draft → family/human confirmation →
Domain Command
```

Logical isolation preserved even though both sides are Python: AI Runtime code must not import a business
domain's repository directly (e.g. `ai_runtime` code importing `domains.growth.infrastructure.repositories`
is forbidden). AI Runtime returns only Draft/Hypothesis/Explanation/Proposal/ActionCandidate. Only the
business domain's Application Handler may write canonical state.

Agents (咪莉校长 and all others) are registered via a typed `AgentDefinition` (agent_id, persona_ref,
allowed_skills, context_policy_ref, allowed_tools, safety_policy_ref, human_handoff_policy_ref,
`may_mutate_business_state: bool = False`). Agents call only registered tools
(`read_family_context`, `draft_growth_plan`, `propose_named_action`, `search_knowledge`,
`request_human_review`, ...); tools re-enforce permission/consent/purpose checks, agents never touch the
database directly.

## 7. Scale posture

Python is not a scale ceiling. FastAPI stateless services + asyncio for DB/model I/O, horizontal scaling,
CPU-heavy work in dedicated workers, per-Family-Home-Cell data isolation, PostgreSQL partitioning per cell,
Redis for rebuildable cache only, event stream decoupling for high-volume events, provider-concurrency/token
scaling for AI Runtime, no raw family data in the global control plane. Future cells are independent groups
of Python services (family-api replicas, ai-runtime replicas, Temporal workers, PostgreSQL, Redis, object
storage, search/vector, event stream) — one cell's failure does not affect others.

## 8. Migration batches (order; only Batch 1 currently authorized — see CURRENT_SPRINT.md)

```text
Batch 1 = Platform foundation + Assessment domain (UI-02/UI-03)              — AUTHORIZED, IN_PROGRESS
Batch 2 = Family/Relationship/Consent/GrowthIntent/GrowthPlan/Intervention/Action/Outcome
Batch 3 = Principal/Conversation/Agent Runtime/Human Handoff/Daily Coach
Batch 4 = 21-Day Program (Enrollment/Curriculum/Daily Action/Check-in/Milestone/Completion/Outcome)
Batch 5 = Resource/Expert/Organization/Teacher/ServiceCase/ServiceTask/Collaboration/Allocation/Entitlement
Batch 6 = Content/Community/Private Note/Moderation/Product Catalog/Commerce/Payment/Settlement
Batch 7 = Design/Product Blueprint/Program Blueprint/Service Blueprint/Curriculum Design/Content Generation/
          Safety-Evidence-Delivery Lint/Release Package/Design Experiment
Batch 8 = Full NestJS deletion + production hardening (delete apps/api NestJS, all TS backend packages,
          Node backend deployment, TS DB accounts; frontend TypeScript is the only TS remaining)
```

Each batch requires its own explicit project-owner confirmation before starting (same pattern as this
override: concrete plan review, not verbal blanket delegation) — see `CURRENT_SPRINT.md` for current batch
authorization status.

## 9. Batch 1 task definition (verbatim from project-owner directive)

```text
TASK_ID              = FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001
PRIORITY              = P0
TARGET_ARCHITECTURE   = PYTHON_ONLY_BACKEND
MIGRATION_MODE        = ONE_WAY_DOMAIN_TAKEOVER
AUTO_MERGE            = NO
DUAL_WRITE            = NO
DUAL_PRIMARY          = NO
```

Goal: establish the Python-only backend foundation and fully migrate the Assessment domain as the first
Python business vertical slice.

**Workspace**: `50_开发_dev/backend/` per the layout in section 3 (scoped to `pyproject.toml`, `uv.lock`,
`apps/family_api`, `apps/ai_runtime`, `apps/workflow_worker`, `packages/contracts`, `packages/platform_kernel`,
`packages/persistence`, `packages/events`, `domains/assessment`, `intelligence/*`, `tests/*`).

**Tech baseline**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL, httpx, pytest, Ruff,
mypy, OpenTelemetry, uv.

**First migration scope**: AssessmentSession, AssessmentResponse, EvidenceSnapshot, AssessmentInterpretation,
GrowthHypothesis, AssessmentDecision, GrowthIntent bridging, UI-02 API, UI-03 API,
`ASSESSMENT_TURN_EXTRACTION`, `ASSESSMENT_INTERPRETATION`.

**Single-track requirements**:
1. Once Python is switched over, the NestJS Assessment Controller stops being registered.
2. Only the Python service account may write to `assessment.*`.
3. No dual-write between NestJS and Python.
4. No TS provider calls.
5. AI Runtime returns only Draft/Hypothesis, never writes canonical state directly.
6. GrowthIntent must go through the Python business layer's Named Action.
7. Legacy assessment data maps onto existing tables or gets a one-time migration.
8. Old NestJS assessment module is kept for one release cycle after cutover, then deleted.

**Must complete**: OpenAPI contract + auto-generated TypeScript frontend SDK; Auth/Family/Subject/Consent
checks; Assessment domain model; SQLAlchemy repositories; Alembic baseline; Python AI Runtime; at least one
real provider; FakeProvider; Evidence/Safety/Eval; AI Run Ledger; UI-02/UI-03 E2E; Transactional Outbox;
OpenTelemetry; Docker + CI.

**Acceptance criteria**:
1. UI-02/UI-03 no longer call the NestJS assessment API.
2. The full assessment path goes only through Python.
3. No provider calls exist outside Python.
4. No fake scores, rankings, radar charts, or same-age-peer references.
5. Raw responses trace through Evidence, Hypothesis, and UI-03.
6. AI Runtime cannot run once consent is withdrawn.
7. AI cannot directly write canonical business facts.
8. Same input + same version → semantically consistent result.
9. Provider failure fails closed, explicitly.
10. Python contracts, types, unit/integration/E2E tests pass.
11. Frontend-generated SDK passes TypeScript checks.
12. Existing non-assessment NestJS modules still pass regression.

Completion gate: STOP for exact-head review. Do not start a second domain migration in parallel.

## 10. Preserving safety/governance guarantees across the port

The Python port MUST preserve, not weaken, everything the NestJS implementation already enforces for the
assessment domain — this is a translation, not a relaxation:

- `fact_boundary` / `hypothesis_not_fact` / `recommendation_not_decision` boundary labeling (currently
  `assertInterpretationBoundary` in `packages/family-model/src/index.ts`).
- Construct-ref whitelist enforcement (`LEGAL_CONSTRUCT_REFS`) against AI-fabricated theory/vocabulary.
- Safety screening combination rules (`FamilySafetyScreeningService`) — multi-signal and missing-safety-item
  detection depend on seeing the full response batch, not a single new answer; the Python port must preserve
  this batch-visibility property, not simplify it away.
- Consent-gated execution (`assertRequiredGrowthConsents` equivalent) re-checked at every step, not cached
  across the whole flow.
- `may_mutate_business_state = false` for all AI Runtime output — canonical writes only through the business
  domain's own Named Action / Application Handler.

## 11. Reference timeline (non-binding)

Assuming a stable 6–8 person backend/AI core team: platform foundation 4–6 weeks; assessment domain full
vertical migration 6–8 weeks; Family/Consent/Growth core 8–12 weeks; Principal & growth companionship
6–10 weeks; Program & 21-day camp 6–10 weeks; Resource/Service/Expert 8–12 weeks; content/community/other
8–12 weeks; NestJS deletion & production hardening 4–6 weeks. Compressible to 6–9 months pre-scale, or
9–15 months if already carrying stable production traffic — never compress at the cost of business
correctness.
