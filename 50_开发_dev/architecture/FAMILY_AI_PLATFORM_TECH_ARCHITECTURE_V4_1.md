# FAMILY AI PLATFORM — TECH ARCHITECTURE V4.1

```text
DOC_KIND        = GOVERNANCE_SSOT / TECHNICAL_ARCHITECTURE_FREEZE
ARCHITECTURE_ID = FAMILY_AI_PLATFORM_V4_1
TASK            = FAMILY-AI-ARCHITECTURE-V4-1-CONVERGENCE-001
DATE            = 2026-08-22
BASE_REPO       = PoCP-Protocol/family-ai
BASE_BRANCH     = main
BASE_SHA        = f2eeacc69fff78b17f45b78a7ab631543ee8cf2a
SUPERSEDES      = FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4.md FOR EXECUTION
STATUS          = TARGET_FROZEN
```

## 1. Architecture thesis

Family is not an LLM application. It is a Family Growth Intelligence & Service Platform.

Stable boundaries:

```text
Business Truth       = TypeScript / NestJS / PostgreSQL
AI Intelligence      = Python AI Runtime
Professional Ability = Versioned Skill Platform
Longitudinal Memory  = Permissioned Family Context Platform
Long-running Process = Temporal
Domain Events        = PostgreSQL Transactional Outbox
Model Providers      = Replaceable implementations
```

Changing model vendor, cloud, vector engine, deployment platform or Agent framework MUST NOT require redesigning Family domain truth.

## 2. Six runtime planes + horizontal control plane

```text
┌─────────────────────────────────────────────────────────┐
│ 1 EXPERIENCE PLANE                                      │
│ Mobile / Consumer Web / Ops+Advisor Web / UI-01..UI-35 │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2 INTERACTION / API PLANE                               │
│ REST / OpenAPI / Projection / Named Action / SSE        │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 3 DOMAIN / TRUTH PLANE                                  │
│ NestJS + TypeScript + PostgreSQL                        │
│ canonical mutation only through domain Named Actions    │
└───────────────┬────────────────────────┬────────────────┘
                ▼                        ▼
┌──────────────────────────┐  ┌───────────────────────────┐
│ 4 WORKFLOW / EVENT PLANE │  │ 5 AI INTELLIGENCE PLANE  │
│ Outbox / Temporal /      │  │ Python Runtime / Skill / │
│ Workers                  │  │ Agent / RAG / Eval       │
└───────────────┬──────────┘  └─────────────┬─────────────┘
                └──────────────┬─────────────┘
                               ▼
┌─────────────────────────────────────────────────────────┐
│ 6 DATA / KNOWLEDGE PLANE                               │
│ PostgreSQL / pgvector / S3-compatible / Redis           │
└─────────────────────────────────────────────────────────┘

════════════════ HORIZONTAL CONTROL PLANE ════════════════
Identity / Tenant scope / Family scope / RBAC + ABAC
Consent / Visibility / Purpose / Safety / Human Gate
AI Use Case Policy / Skill Policy / Provider Policy
Audit / Eval / OpenTelemetry / Cost / Secrets / Governance
══════════════════════════════════════════════════════════
```

Control is horizontal. Consent or authorization is never a final after-the-fact check.

## 3. Canonical business domains

Canonical business domains are exactly:

```text
FAMILY_CORE
GROWTH_INTELLIGENCE
GROWTH_JOURNEY
RESOURCE_NETWORK
SERVICE_OS
COMMERCE_ENTITLEMENT
CONTENT_COMMUNITY
```

`RESOURCE_NETWORK` is deliberately separate from `COMMERCE_ENTITLEMENT`.

`RESOURCE_NETWORK` owns capability/resource/provider eligibility and fiduciary recommendation.

`COMMERCE_ENTITLEMENT` owns membership, subscription, benefit, order intent, payment boundary, entitlement, points and assets.

Mandatory direction:

```text
Need
→ Capability
→ Eligible Resource
→ Fiduciary Ranking
→ Recommendation
→ Family Decision
→ Commercial Intent / Entitlement (only if needed)
```

Forbidden:

```text
margin / commission / platform revenue → recommendation rank
PLATFORM_MARGIN_RANKING_SIGNAL = 0
```

## 4. Family Context is NOT a business domain

`FAMILY_CONTEXT_PLATFORM` is cross-domain infrastructure.

It may `READ / COMPOSE / INDEX / SUMMARIZE / RETRIEVE / PROJECT`.

It may not arbitrarily create canonical Family/Growth/Service/Commerce truth. Context is derived from domain truth, domain events, perspectives, evidence, AI artifacts and service events.

## 5. Canonical business loops

The ONLY canonical product/business loop vocabulary is:

```text
GROWTH
PLAN
ASSESSMENT
SERVICE
COMMERCE
COMMUNITY
```

Historical values `CORE_LOOP / GROWTH_LOOP / COMMERCE_LOOP / TEACHER_SALON_LOOP / COMMUNITY_LOOP / CUSTOMER_BACKEND_LOOP` are `LegacyFamilySurfaceLoop` only. They are historical DEV/UI surface grouping vocabulary and MUST NOT be exported as `FamilyBusinessLoop`.

## 6. CQRS-light, not full Event Sourcing

Family uses:

```text
Relational Canonical Tables
+ Append-only Domain Events
+ Transactional Outbox
+ Derived Projections / Context
```

Do NOT rebuild the platform as full Event Sourcing. Canonical relational state remains authoritative for objects such as Consent, GrowthIntent, Program, ServiceCase and Entitlement.

## 7. Transactional Outbox contract

Every domain mutation that must emit an event follows:

```text
BEGIN
  mutate canonical tables
  insert outbox event
COMMIT
```

Event envelope:

```text
event_id
event_type
event_version
aggregate_type
aggregate_id
family_id
tenant_id?
occurred_at
actor_type
actor_id?
correlation_id
causation_id?
trace_id
payload
```

Delivery semantics are `AT_LEAST_ONCE + IDEMPOTENT_CONSUMER`. Do not promise “exactly once”.

## 8. Temporal boundary

Use Temporal only for durable long-running coordination: wait/timer/retry/pause-resume/human-in-loop/21-day program/90-day program/booking confirmation/follow-up/long report generation.

Do not use Temporal for ordinary CRUD or a single database transaction.

```text
Temporal = process state
PostgreSQL = business truth
```

## 9. AI control plane

Target AI route:

```text
Mobile/Web
→ NestJS API
→ Authentication
→ Tenant + Family Authorization
→ Consent / Purpose / Data Classification
→ AI Use Case Registry
→ Permissioned Context Set
→ Skill Resolver
→ Python AI Orchestrator
→ Model Provider Gateway
→ Structured Output
→ Validator / Safety / Eval hooks
→ AI Run Audit
→ Draft / Hypothesis / Recommendation
→ Family/Human confirmation
→ NestJS Named Action
→ PostgreSQL
```

Client direct provider calls are forbidden.

## 10. AI Orchestrator vs Model Provider Gateway

`AI Orchestrator` owns AI use case, Skill, Context, Retrieval, Agent flow, Output schema and Eval hooks.

`Model Provider Gateway` owns provider credentials, model selection, request/stream transport, timeout/retry, token/cost accounting and policy-aware fallback.

Provider fallback MUST be policy-aware. Data class, consent, region, retention policy and provider allow-list are evaluated before fallback.

## 11. AI Use Case Registry

No model-backed capability exists outside the registry. Each use case declares use_case_id, domain, allowed_skills, allowed_model_classes, input_data_class, required_consent, max_context_scope, provider_policy, human_confirmation, may_propose_action, `may_mutate_business_state=false`, latency_slo, cost_budget, eval_suite and runtime_authorization.

Examples: `AI_DIAGNOSIS`, `ASSESSMENT_INTERPRETATION`, `GROWTH_PLAN_DRAFT`, `PRIVATE_NOTE_TAGGING`, `RESOURCE_RECOMMENDATION`, `EXPERT_ROUTING`.

## 12. Assessment + AI diagnosis dual-engine architecture

Assessment professional conclusions are not free-form LLM output.

```text
Assessment Evidence
→ Versioned Assessment Skill Engine
→ Structured Assessment Result
→ Permissioned Family Context
→ AI Diagnosis Skill
→ GrowthDiagnosticHypothesis
→ Family-readable explanation
→ Family acknowledgement
→ GrowthIntent
```

`GrowthDiagnosticHypothesis != Fact`.

Product language `AI诊断` is retained. Medical/psychiatric diagnosis, permanent child labels and direct canonical fact writes remain forbidden.

## 13. Context and memory

Memory types:

```text
Working   = transient session state
Episodic  = events that happened
Semantic  = reusable derived understanding
Evidence  = source evidence and provenance
```

Semantic memory never auto-promotes to Fact.

Retrieval is hybrid and permission-first:

```text
Family/Tenant scope
→ Consent / Visibility / Purpose
→ Time validity / supersession
→ Truth type (Fact/Perspective/Hypothesis/etc.)
→ Structured filters
→ Full text / keyword
→ Vector retrieval
→ Rerank
→ Context budget
```

Vector similarity alone is never an authorization mechanism.

## 14. Data architecture

Architecture identity:

```text
Canonical relational DB = PostgreSQL
Semantic index          = pgvector
Ephemeral/cache         = Redis
Object/multimodal       = S3-compatible storage
AI/data artifacts       = Object storage + policy
```

Current deployment target may pin PostgreSQL 18 and Node 22, but major versions are deployment baselines, not architecture identity.

Future data lake: `Operational data → Outbox/approved export → S3+Parquet → Dataset/Eval/Analytics/Training`.

No MongoDB, independent vector DB, Kafka, Neo4j or Kubernetes dependency is required now.

## 15. AI Run storage

Split runtime metadata from sensitive payload:

```text
ai_run      = PostgreSQL metadata
ai_artifact = encrypted/policy-controlled object payload or NOT_STORED
```

Do not copy raw family prompts or model outputs into generic application logs.

## 16. Identity, tenant, family and consent

Distinct concepts:

```text
Account = login principal
Person  = real family member
Family  = family sovereignty / continuity boundary
Tenant  = service/operations organization
```

A Tenant never owns a Family. Tenant access exists through explicit binding/purpose.

Authorization is `Authentication + Tenant Role + Family Relationship + Object Scope + Purpose + Consent + Visibility + Policy`.

Use application authorization as primary control. PostgreSQL RLS may be added as defense-in-depth for strong family/tenant-scoped tables.

## 17. Frontend

Mobile canonical client: React Native + Expo + TypeScript + React Query + SecureStore; local cache/draft only.

Mobile business server, MySQL/openId identity and direct model provider are transitional debt and must be retired through strangler migration.

Target Web: `consumer-web = Next.js`, `ops-web = Next.js`. Current static `apps/web` console is a transitional prototype, not the target Ops architecture.

## 18. Language/runtime

Business: TypeScript + NestJS + Node active LTS (release-pinned).

AI: Python >=3.12 + uv + FastAPI where synchronous API is needed + Pydantic + httpx + pytest + ruff + pyright.

Python AI Runtime MUST NOT own business repositories or directly mutate canonical business tables.

## 19. Contract-first cross-language boundary

Canonical interface sources:

```text
External/API       = OpenAPI
AI structured I/O = JSON Schema
Domain events      = JSON Schema
Tool invocation    = JSON Schema
```

Generate TS SDK, Python/Pydantic bindings, Mobile and Ops clients. Do not maintain independently handwritten DTO copies across runtimes.

## 20. Eval and release lifecycle

Every production AI Skill requires Unit, Golden, Safety, Regression, Model comparison, Prompt comparison, Human judge, Model judge, Latency, Cost and Online quality signal.

Independent release lifecycles: Application Release, Skill Release, Prompt Release, Model Routing Release, Dataset Release.

Typical Skill stages: `DEV → INTERNAL → SHADOW → PILOT → PROD`.

## 21. Observability

OpenTelemetry trace id spans Client → API → DB → Outbox/Workflow → Context → Skill → AI Runtime → Model → Validator → Named Action.

AI trace metadata includes model/skill/prompt versions, retrieval refs, token/cost/latency, safety and human review.

## 22. Runtime authorization vs feature flags

Do not conflate:

```text
Authorization = whether a capability may exist/run in a scope
Runtime Flag  = whether it is currently enabled in an environment
```

## 23. Repository and engineering governance

Architecture requirements:

```text
main branch protection = mandatory
required CI checks      = mandatory
exact-head review       = mandatory
agent direct merge      = forbidden
document status > runtime evidence = forbidden
```

Owner waiver is exceptional and must record exact head, waived gate, known failures, reason and risk acceptance.

Production-core repository visibility SHOULD be private. Public protocol/SDK/spec assets should be separated if open source is desired.

## 24. Permanent invariants

```text
NO_SECOND_BUSINESS_BACKEND
NO_SECOND_IDENTITY_SYSTEM
NO_SECOND_CANONICAL_DB
NO_CLIENT_DIRECT_MODEL_CALL
NO_AGENT_DIRECT_DATABASE_WRITE
NO_CONTEXT_PLATFORM_CANONICAL_WRITE
NO_SKILL_WITHOUT_VERSION
NO_AI_USE_CASE_OUTSIDE_REGISTRY
NO_AI_WITHOUT_TRACE
NO_AI_WITHOUT_EVAL
NO_PRODUCTION_AI_WITHOUT_CONSENT_POLICY
NO_UI_CAPABILITY_WITHOUT_BACKEND_OWNER
NO_DOCUMENT_STATUS_ABOVE_RUNTIME_TRUTH
NO_VENDOR_MODEL_AS_ARCHITECTURE
PLATFORM_MARGIN_RANKING_SIGNAL = 0
```

## 25. Program order after this freeze

```text
G0   Product + Tech Architecture Freeze                         PASS_CLOSED
G1-A Architecture / Contract Convergence                        current
G1-B Runtime Convergence
G1-C Data / Workflow Foundation
G1-D Observability / CI / Contract Generation
G2   AI Platform Foundation
G3   Family Core + Context
G4   Assessment + AI诊断       ← first real AI business vertical slice
G5   Growth Journey
G6   Resource Network + Service OS + Commerce/Entitlement
G7   Content + Community
G8   35UI cross-loop full E2E
```

No G2+ business/runtime capability is authorized by this document alone.
