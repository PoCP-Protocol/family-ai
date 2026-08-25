# Family Engineering Contract Index V1.1

## 这次补齐的7类工程契约

### 1. Database

`database/`

- ER Diagram
- Full DDL
- migrations

### 2. Agent

`agents/`

- Agent Card Template
- Registry
- 5个初始Agent规格

### 3. API

`specs/api/openapi-family-platform-v0.2.yaml`

- Family Core
- Growth foundation
- auth / idempotency / correlation / errors

### 4. Human Gate

`policies/HUMAN_GATE_POLICY.yaml`
`policies/HUMAN_GATE_MATRIX.md`

### 5. Model Router + Eval

`models/`
`evals/specs/`
`evals/golden_jsonl/`

### 6. Monorepo / CI / Test / Coding

`scaffold/`

### 7. Consent / Minor / Event / Adapter DTO

`security/`
`events/`
`integrations/`

### 8. Technical Architecture Rebaseline V3.2

`docs/FAMILY_TECH_ARCH_V3.2.md`
`docs/PRODUCT_BOUNDARY_MAP_V3.2.md`
`docs/DATA_OWNERSHIP_MATRIX_V3.2.md`
`docs/EVENT_TAXONOMY_V3.2.md`
`docs/AI_FAMILY_INTEGRATION_CONTRACT_V3.2.md`
`docs/FAMILY_1_0_MOS_ARCHITECTURE_GATE.md`

V3.2 keeps Family Strategy V3.0 and the validated Family Core, but upgrades architecture planning to Build-to-Operate product boundaries.

### 9. Family Education Industry Model

`docs/FAMILY_EDUCATION_INDUSTRY_MODEL_PLAN.md`
`docs/FAMILY_EDUCATION_INTELLIGENCE_MODEL_V0_1.md`
`docs/FAMILY_EDUCATION_AI_ERA_MODEL_GAP_ANALYSIS.md`
`docs/FAMILY_EDUCATION_MODEL_HARNESS_STRATEGY_V0_1.md`
`docs/FAMILY_ASSESSMENT_AI_SKILL_RESEARCH.md`
`docs/model/family_education_model_foundation.manifest.yaml`
`docs/model/family_ui_model_binding.registry.yaml`
`docs/model/family_model_component.registry.yaml`
`docs/model/family_memory_conversation.schema.yaml`
`docs/model/family_multimodal_artifact.schema.yaml`

Industry-model layer for family education domains, child/parent/family needs, constructs, academic/K12 learning, AI literacy, multimodal literacy, componentized extensibility, memory, realtime dialogue, multimodal artifact understanding, assessment memory, intervention matching, small-model strategy, evaluation gates, and outcome feedback. UI-02/UI-03 assessment work should derive from this layer rather than remaining a single questionnaire feature. Model construction follows a "stand on the shoulders of giants" strategy: adopt mature harness/tooling for engineering and evaluation, while keeping Family-owned domain intelligence as first-party assets.

### 10. Family Growth Platform V4.2 Rebaseline

`docs/FAMILY_GROWTH_PLATFORM_BLUEPRINT_V4_2.md`
`docs/FAMILY_GROWTH_PLATFORM_TECH_ARCH_V4_2.md`
`docs/FAMILY_GROWTH_PLATFORM_FUNCTIONAL_COMPONENTS_V4_2.md`
`docs/FAMILY_GROWTH_PLATFORM_IMPLEMENTATION_PLAN_V4_2.md`

V4.2 rebaseline defines the Family Education Large Model as the foundation of the Family Growth Platform. Product surfaces, assessment, realtime dialogue, memory, multimodal artifacts, action/outcome loops, human-service collaboration, small models, and localization extensions must compose from the componentized model foundation rather than becoming scattered standalone features.

### 11. Family AI Platform V5 Adoption

`docs/FAMILY_AI_PLATFORM_V5_ADOPTION_PLAN.md`
`backlog/tasks/FAMILY-AI-V5-RUNTIME-FOUNDATION-001.md`
`docs/FAMILY_MEMBERSHIP_OS_V2_BASELINE.md`

V5 adoption raises the target from a family education app to Family Growth Intelligence & Ecosystem OS. It adds nine-plane architecture, Family Trusted Context Capsule, Growth Evidence Graph, FamilyHarnessAdapter boundary, durable service workflow direction, ecosystem interop direction, and a 90-day Patch Line. V5 is adopted as engineering direction and task-entry guidance; it does not by itself rewrite the current authorized sprint or mutate the conceptual SSOT under `10_规格_spec`.

Membership-specific direction: retain exactly three initial relationship-depth tiers (`M0_FREE`, `M1_GROWTH`, `M2_ANNUAL`), while keeping Growth Stage, Loyalty Points, and Community Role independent. Do not equate subscription with `Lv.3`, points with tier, or community role with paid status. The current fixture-only DEV/TEST boundary remains active.

---

## AI开发前加载顺序

1. CLAUDE.md
2. PROJECT_STATUS.md
3. CURRENT_SPRINT.md
4. ENGINEERING_CONTRACT_INDEX.md
5. V3.2 architecture rebaseline docs when planning product, AI, community, operations, analytics, frontend, data, or pilot scope
6. Family Growth Platform V4.2 docs when planning family education, growth platform, assessment, realtime dialogue, memory, multimodal, human-service, or model-foundation work
7. Family Education Industry Model docs when planning family assessment, small models, intervention matching, or education-domain intelligence
8. Family AI Platform V5 adoption docs when planning Agent Harness, Trusted Context, school/provider ecosystem, durable service workflow, professional model stack, or 90-day runtime foundation work
9. Family Membership OS V2 baseline when planning membership tier, period, activation, benefits, points, referral, renewal, or annual companion work
10. 当前Task Pack
11. Task引用的数据库/API/Policy/Agent/DTO Spec

AI不应该一次性加载全部文件。
