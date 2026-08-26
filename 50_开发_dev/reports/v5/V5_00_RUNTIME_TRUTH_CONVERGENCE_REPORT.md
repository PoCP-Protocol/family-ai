# V5-00 Runtime Truth Convergence Report

```text
REPORT_ID       = V5-00_RUNTIME_TRUTH_CONVERGENCE
DATE            = 2026-08-26
REPOSITORY      = D:\family-ai
SCOPE           = 50_开发_dev engineering execution layer
TASK           = FAMILY-AI-V5-RUNTIME-FOUNDATION-001
GATE            = V5-00_RUNTIME_TRUTH
MODE            = EVIDENCE_REPORT_ONLY
```

## 1. Executive conclusion

V5 can be adopted as an engineering direction, but the repository is **not yet a V5 nine-plane production runtime**. The current executable base is a V4.1-target-frozen modular monolith with V4.2 model-foundation contracts and selected M3 internal runtime slices. Several V5 contracts already exist as types, policy code, adapter skeletons, fixture behavior, and evaluation assets; most V5 planes remain design/contract/preparation rather than an admitted product runtime.

The strongest current runtime truth is:

- Family Core / Growth / Consent / ServiceCase / Named Action / Audit / PostgreSQL: existing deterministic internal business runtime.
- Principal Runtime and Principal AI: controlled internal runtime with deterministic fallback, safety gates, consent/purpose checks, proposal-first behavior, and optional explicitly configured internal live text path.
- Family Education Assessment Model and Model Gateway: package/API-local wiring exists; default is mock/deterministic and fail-closed; internal live external calls are separately gated.
- Harness: `@family/harness` adapter skeleton and policy contract exist; Codex App Server is not a public or production Family runtime.
- GrowthEpisode: V5 contract exists, but no evidence was found here that a complete canonical persisted GrowthEpisode runtime is admitted.
- Trusted Context Capsule, complete trust-zone authorization fabric, FamilyNow, ecosystem interop, durable Temporal service runtime, and V5 learning flywheel: primarily contracts/design or gaps.

This report does **not** authorize or implement business runtime expansion. V5-00 remains a truth-convergence and contract-gate task only.

## 2. Evidence basis and authority order

Reviewed:

1. `CLAUDE.md` repository rules.
2. `50_开发_dev/CURRENT_SPRINT.md` and `CURRENT_SPRINT_M2_000.md`.
3. `50_开发_dev/governance/AUTHORIZATION_REGISTRY.yaml`.
4. `50_开发_dev/PROJECT_STATUS.md`.
5. V4.1 architecture: `architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md`.
6. V4.2 architecture: `docs/FAMILY_GROWTH_PLATFORM_TECH_ARCH_V4_2.md`.
7. V5 adoption direction: `docs/FAMILY_AI_PLATFORM_V5_ADOPTION_PLAN.md`.
8. Harness capability and integration contracts: `docs/FAMILY_AI_CODEX_HARNESS_ENGINEERING_CAPABILITY_ROADMAP_V0_1.md`, `docs/model/family_model_harness.integration.yaml`, and `architecture/FAMILY_INTELLIGENCE_OS_HARNESS_BOUNDARY_V0_1.md`.
9. Actual package/application code and contracts under `packages/`, `apps/`, and relevant validation/evaluation assets.

Repository governance states that authorization comes from `AUTHORIZATION_REGISTRY.yaml`; code presence, tests, planning documents, or this report cannot self-authorize a capability. The current sprint remains `FAMILY-AI-ARCHITECTURE-V4-1-CONVERGENCE-001`, G1-A, with G1-B+ not authorized. The explicit authorization in this conversation is used only to produce this V5-00 report and is intentionally **not** written into the authorization registry.

## 3. Runtime status vocabulary

| Status | Meaning in this report |
| --- | --- |
| `deterministic` | Local rule/typed/fixture-free logic with reproducible output and no model/provider dependency. |
| `mock` | Fake gateway, test double, fixture, or synthetic path; not evidence of production behavior. |
| `internal` | Controlled local/internal runtime capability, not public pilot or production default. |
| `live` | Real external provider call is technically reachable under explicit environment and policy gates; it is not automatically pilot/production. |
| `pilot` | Authorized for real pilot users. |
| `production` | Authorized and enabled as a production default. |
| `design/contract` | Documented or typed direction without evidence of a complete admitted runtime. |

## 4. V5 nine-plane convergence matrix

### Plane 1 — Experience Plane

**V5 target:** child, parent, teacher, school, advisor, provider, operations experiences across mobile/web/voice/digital-human surfaces.

**Current assets and code facts:**

- Consumer Web, mobile, ops web, FES web/API, and legacy/isolated surfaces exist under `apps/`.
- V4.1 UI baseline and UI-01 through UI-34 contract mappings exist; UI-35 is deleted from the product baseline.
- Existing web and API paths render/read Family projections, assessment flows, service/case projections, and selected Principal flows.
- UI contracts explicitly retain read-only boundaries and named-action write boundaries in relevant areas.

**Status:** `deterministic/internal` for existing Family Core and service surfaces; `mock` where fixture/test journey shells are used; `live` only for already admitted local/internal API/provider paths; `pilot = NO`; `production = NO` for V5 additions.

**Gaps:** No evidence of a V5-complete role-separated experience matrix, voice/digital-human runtime, or school/provider production experience. No V5 UI-36 is authorized. Experience must not bypass Family API, consent, purpose, context, or human gates.

**Risks/conflicts:** V4.1 consumer UI is an execution baseline, while V5 describes broader audiences and modalities. Treating planned surfaces as implemented would overstate readiness.

**Conclusion:** Existing experience is a reusable V4/M3 foundation, not V5 experience-plane completion.

### Plane 2 — Business & Truth Plane

**V5 target:** Family Core, Growth, Program, Service, School Collaboration, Commerce, Community, Named Actions, PostgreSQL; GrowthEpisode as a unifying process object.

**Current assets and code facts:**

- NestJS/TypeScript API and PostgreSQL canonical tables are the existing business truth path.
- Family, Person, Relationship, Consent, Growth, Program/Intervention, ServiceCase, ServiceRecord, entitlement and audit/event contracts are present.
- Core mutations are routed through Named Actions/domain services; AI output is proposal/draft rather than canonical mutation.
- `packages/contracts/src/growth-episode.ts` contains a typed V5 `GrowthEpisode` contract with lifecycle, source refs, method/intervention refs, action/check-in/review/outcome refs, and boundary invariants.
- Existing service and orchestration code distinguishes `ServiceCase` execution truth from Growth Outcome.

**Status:** existing business runtime `deterministic/internal`; GrowthEpisode itself `design/contract` with partial projection/contract support; `mock` only in fixtures/tests; `pilot = NO`; `production = NO` for new V5 capabilities.

**Gaps:** No evidence in the inspected scope of a complete persisted GrowthEpisode migration and end-to-end canonical runtime. V5 School Collaboration and expanded Commerce semantics are not admitted as new runtime work. Membership M0/M1/M2 is direction only; current fixture-only behavior remains DEV/TEST and `TEST_NOOP_ADAPTER`/`external_effect=false` bounded.

**Risks/conflicts:** `PROJECT_STATUS.md` contains stale historical statements such as “AI Model Gateway” and other capabilities “Not Started,” while current packages and M3 reports show admitted internal gateway/runtime assets. Code and current governance evidence outrank those stale summary lines; status documents require later reconciliation, not silent expansion.

**Conclusion:** Business truth is the strongest existing plane, but V5 object convergence is incomplete.

### Plane 3 — Trusted Context & Identity Fabric

**V5 target:** Family Trusted Context Capsule (FTCC), consent, purpose, subject, recipient, visibility, provenance, expiry, risk flags, and trace; separate Family/School/Partner/Operations trust zones; no global child super-profile.

**Current assets and code facts:**

- `packages/principal-runtime` has deterministic canonical consent resolution requiring subject-scoped `AI_PERSONALIZATION` consent; it does not infer AI consent from `SERVICE`, `ASSESSMENT`, or `GROWTH_TRACKING`.
- It has typed minimal context construction (`PrincipalFamilyContextV1`) with subject/family references, life stage, confirmed priorities, active intervention, action state, and permitted observations.
- Processing policy checks consent, data category, minor status, external-processing enablement, provider approval, policy version, and authorized categories; failures are fail-closed.
- Existing contracts include `subject_person_id`, consent purposes, case access, service relationships, and tenant/family scope.
- V5 FTCC minimum fields are documented in the adoption plan, but a dedicated canonical FTCC artifact/runtime was not found in the inspected code.

**Status:** consent and minimal typed context `deterministic/internal`; FTCC `design/contract`; external live context use `internal/live` only under existing controlled gates; `pilot = NO`; `production = NO`.

**Gaps:** Dedicated FTCC schema/lifecycle, recipient-specific capsule issuance, purpose grants, expiry enforcement, provenance reference model, and complete trust-zone policy composition remain to be accepted in V5-01 through V5-04. No global super-profile was found as an authorized design; however, complete cross-role isolation is not yet proven by this task.

**Risks/conflicts:** The current Principal context is a narrow V1 typed slice, not equivalent to FTCC. Treating it as a full capsule would lose recipient, expiry, provenance, risk, and trace semantics.

**Conclusion:** Foundational controls exist, but the V5 fabric is not complete.

### Plane 4 — Agent Harness Plane

**V5 target:** Codex App Server Thread/Turn/Event/Tool/MCP/Approval/Resume/Multi-Agent behind a Family-owned `FamilyHarnessAdapter`.

**Current assets and code facts:**

- `packages/harness` exports `CodexHarnessAdapter`, deterministic test backend types, thread/turn/event contracts, tool policies, approval/proposal references, and invariant lists.
- Allowed tools are read-only or proposal-only: family context/now, GrowthEpisode, interventions, perspectives, recent actions, growth-action proposal, human review request, support-case draft, and service options.
- Forbidden tool names include `execute_sql`, `update_table`, `write_growth_profile`, `write_family_context`, `mutate_core_ontology`, and `generic_patch_core_object`.
- The adapter calls a JSON-RPC transport, but the inspected code is an adapter boundary/skeleton; no evidence was found that Codex App Server is a production Family endpoint.
- Harness integration YAML explicitly says it is a model factory/test bench, not domain truth or business runtime; live smoke and live eval are blocked without authorization/configuration.

**Status:** adapter policy `deterministic`; Codex transport `internal/design`; deterministic test backend `mock`; `live = technically contract-ready but not admitted as production`; `pilot = NO`; `production = NO`.

**Gaps:** Concrete Family-owned tool implementations, FTCC injection, end-to-end approval/resume/audit integration, policy-enforced proposal-to-Named-Action bridge, and runtime-faithful tests against an actual App Server remain future work.

**Risks/conflicts:** The existence of `CodexHarnessAdapter` and JSON-RPC methods can be mistaken for a live agent runtime. It is not permission for UI-to-Codex, Codex-to-SQL, autonomous agent fleets, auto-merge, or production exposure.

**Conclusion:** Boundary contract is present; agent runtime adoption is not.

### Plane 5 — Professional Intelligence Plane

**V5 target:** Family-Core, Family-Safety, Family-Ranker, Family-Small, router/gateway, embeddings/reranker, frontier reasoner, structured output, safety, expert review, and eval.

**Current assets and code facts:**

- `packages/family-model` implements the Family Education Assessment Model runtime with deterministic interpretation and optional gateway-generated structured draft.
- `packages/ai-gateway` is the unique provider boundary; it exposes fake, OpenAI-compatible, Anthropic-compatible/Zhipu-related paths and structured generation/error contracts.
- Default Family Model gateway mode is `mock`; `cc-switch` requires explicit live flag, current authorization, approved provider, endpoint, key, and model.
- `packages/principal-ai` contains deterministic safety prechecks, quality floor/judge fallback, evidence grounding, structured output, high-risk handoff, and proposal behavior.
- `packages/principal-runtime` provides deterministic consent, processing, provider policy, and minimal context controls.
- Existing M3 evidence records deterministic/gateway/internal model behavior and keeps pilot/production false.

**Status:** deterministic `PASS` foundation; mock `default`; internal runtime `ADMITTED`; live external text `INTERNAL_ONLY` under explicit profiles/gates; image external path `NOT_AUTHORIZED`; pilot `NO`; production `NO`.

**Gaps:** V5 named model stack is not a set of independently admitted production models. Family-Small/Safety/Ranker/Core/Embedding/Reranker lifecycle, model registry, independent eval independence, training governance, and production SLO/monitoring are incomplete.

**Risks/conflicts:** `AUTHORIZATION_REGISTRY.yaml` permits selected internal live text paths but explicitly denies pilot and production. `PROJECT_STATUS.md` historical “not started” claims conflict with package reality; neither conflict authorizes expansion.

**Conclusion:** This is the most mature V5 intelligence plane, but only as controlled internal/deterministic capability.

### Plane 6 — Knowledge & Skill Plane

**V5 target:** evidence, methods, interventions, curriculum, skills, expert review, rights, registries, provenance, and approved model assets.

**Current assets and code facts:**

- Repository model assets include domain/need/construct/source registries, UI-02 assessment assets, interpretation schemas, intervention knowledge, golden scenarios, review batches, safety subsets, and distilled datasets.
- `packages/principal-ai` loads grounded knowledge and records evidence metadata; evidence boundaries and rights usage tiers are represented.
- Harness commands and validators cover model asset validation, deterministic eval, memory eval, distillation, and report generation.
- The repository rules require E1 limits for self-produced material and prohibit inferred/unverified material from proving “成立.”

**Status:** asset validation/evaluation `deterministic/internal`; generated/distilled assets `mock/synthetic or staging`; live model-assisted production knowledge `NOT_AUTHORIZED`; pilot `NO`; production `NO`.

**Gaps:** A complete V5 skill registry lifecycle, intervention/curriculum governance, rights-cleared promotion workflow, expert-review operating model, and production knowledge serving boundary are not yet proven as one runtime.

**Risks/conflicts:** Large staged JSONL assets are not proof of model quality, rights clearance, or production readiness. `all_materials.txt` is explicitly disallowed as evidence extraction input because it mixes generated material.

**Conclusion:** Knowledge/eval assets are substantial, but remain governed engineering assets rather than a production learning plane.

### Plane 7 — Durable Workflow & Service OS

**V5 target:** 21-day/90-day/annual service, Case/SLA/booking/human handoff, durable Temporal workflows.

**Current assets and code facts:**

- Existing API/contracts include Program, Intervention, GrowthAction, ServiceCase, ServiceRecord, booking/availability, case access, service relationship, allocation, follow-up, and human handoff concepts.
- ServiceCase is explicitly treated as execution truth; it is not equivalent to Growth Outcome.
- V4.1 documents Temporal as the boundary for durable waits, retries, pause/resume, human-in-loop, 21-day/90-day programs, booking confirmation, and long reports.
- The inspected task/status material marks Temporal/durable V5 pilot work as future, and the V5 execution pack marks it not authorized.

**Status:** existing case/service workflows `deterministic/internal`; 21-day product surfaces partly present but not a V5 durable workflow proof; Temporal `design/planned`; mock fixture journeys `mock`; pilot `NO`; production `NO` for V5 durable workflows.

**Gaps:** No accepted Temporal runtime, workflow worker deployment, durable retry/compensation evidence, SLA state machine admission, or end-to-end 90-day/annual GrowthEpisode execution was established by this report.

**Risks/conflicts:** Existing CRUD/case behavior must not be mislabeled as durable workflow orchestration. Temporal must not be introduced for ordinary CRUD or through an unapproved schema/runtime expansion.

**Conclusion:** Service OS foundations exist; durable V5 workflow runtime is not admitted.

### Plane 8 — Data / Eval / Learning Plane

**V5 target:** events, AI runs, datasets, eval, experiments, analytics, training, provenance, and outcome learning.

**Current assets and code facts:**

- PostgreSQL event/audit and transactional outbox patterns exist in the V4.1 business runtime.
- Principal runtime records model runs, attempts, product events, safety routes, provider-policy decisions, grounding metadata, and handoffs.
- Deterministic unit, contract, golden, safety, human-review, and runtime-faithful evaluation assets exist across packages/reports.
- Distillation manifests, review batches, subsets, model asset validators, and evaluation entrypoints exist under `docs/model/`, `evals/`, `tools/`, and reports.
- `GrowthEpisode` includes action/check-in/reflection/review/outcome observation references, but the full learning loop is not proven live.

**Status:** event/audit/eval `deterministic/internal`; datasets `staging/mock/synthetic as applicable`; model-run live records `internal`; training/experimentation `design/staging`; pilot `NO`; production learning flywheel `NO`.

**Gaps:** Unified V5 data/eval contract, experiment registry, cohort/outcome monitoring, rights-aware training data promotion, cross-plane traceability, and production analytics/learning feedback are incomplete.

**Risks/conflicts:** An eval pass proves the tested invariant/path, not production outcome efficacy or model independence. Existing W2R-104 evidence explicitly retains `MODEL_INDEPENDENCE=PARTIAL` and `INDEPENDENT_MODEL_JUDGE=NOT_CLAIMED`.

**Conclusion:** Strong internal evidence infrastructure exists, but no production learning flywheel is established.

### Plane 9 — Ecosystem Interop Plane

**V5 target:** school/LMS/SIS/teacher tools/providers through OneRoster, LTI, CASE, QTI, Caliper, MCP, A2A and adapter boundaries.

**Current assets and code facts:**

- Tenant/Party/Organization/Teacher/Provider, ServiceRelationship, CaseAccessGrant, and service access contracts exist or are documented.
- Consent, purpose, family scope, account-scoped case projection, and provider visibility controls are represented in security and orchestration assets.
- V5 adoption plan requires explicit Family/School/Partner trust zones and no provider direct database access.
- No inspected evidence establishes admitted OneRoster/LTI/CASE/QTI/Caliper/A2A integrations or a production school/provider connector runtime.

**Status:** identity/access and adapter direction `deterministic/internal/design`; interop connectors `design/not implemented`; mock `fixture-only`; live `NO`; pilot `NO`; production `NO`.

**Gaps:** Trust-zone contracts, Purpose Grant, FTCC-specific recipient filtering, standards adapters, data minimization, deletion/rectification handling, and contract/e2e evidence remain future V5-01/V5-02/V5-10 work.

**Risks/conflicts:** Existing tenant/case access is not equivalent to school or partner interoperability. Premature connector work could expose minor or family-private data without a recipient-specific capsule.

**Conclusion:** Ecosystem interop is a planned boundary, not a current runtime plane.

## 5. Cross-plane runtime truth

| Capability | Current truth | Default path | Internal live | Pilot | Production |
| --- | --- | --- | --- | --- | --- |
| Family Core / canonical state | Implemented deterministic NestJS/PostgreSQL/domain services | Real internal API | Yes, controlled | No V5 expansion | Existing baseline only; no new V5 enablement |
| Consent / subject-scoped Principal policy | Implemented deterministic package logic | Fail-closed local logic | Yes | No | No new V5 enablement |
| Family Education Assessment Model | Implemented package/API-local runtime | Deterministic/mock | Conditionally, via gateway | No | No |
| Provider Model Gateway | Implemented unique gateway package | Mock by default | Conditionally | No | No |
| Principal AI | Implemented controlled runtime | Deterministic fallback | Model-first internal profile only when all gates pass | No | No |
| High-risk safety / human handoff | Implemented deterministic controls and evidence | Fail-closed / handoff | Yes | No | No new V5 enablement |
| FamilyHarnessAdapter | Adapter/policy skeleton | Deterministic test or contract transport | Contract-level only | No | No |
| FTCC | V5 documented minimum, no complete runtime found | N/A | No admitted implementation | No | No |
| FamilyNow | V5 target/read-model direction; existing projections are partial inputs | Existing projections | Partial/internal source projections | No | No V5 claim |
| GrowthEpisode | Typed contract exists | N/A | Partial contract only | No | No |
| Temporal durable workflow | V4.1 direction only in inspected scope | N/A | Not admitted | No | No |
| Membership M0/M1/M2 | Direction + bounded fixture semantics | DEV/TEST only | Fixture-only | No | No |
| School/provider interop | Access/tenant foundations and design | N/A | Not admitted | No | No |
| Production external model | Explicitly not authorized | Mock/deterministic | No | No | No |
| Autonomous Agent | Explicitly not authorized | No runtime | No | No | No |

## 6. Conflicts and stale claims requiring controlled reconciliation

1. **Current sprint vs V5 direction:** `CURRENT_SPRINT.md` remains V4.1 G1-A and says G1-B+ is not authorized. V5 adoption is an engineering direction and V5-00 report task; it is not a blanket authorization for V5-01 through V5-10.
2. **PROJECT_STATUS historical drift:** It says AI Model Gateway, Agent Runtime, Knowledge Foundry, Causal Platform, and World Model are “Not Started,” while current package code and M3 evidence show selected gateway, principal, harness, and knowledge/eval assets. The correct interpretation is “not complete as a V5 production platform,” not “no code exists.”
3. **Authorization granularity:** The registry authorizes selected internal capabilities, including controlled internal live text paths, but separately keeps `PILOT=NO` and `PRODUCTION=NO`. Code presence or a successful test cannot promote these levels.
4. **V4.2 architecture boundary:** V4.2 explicitly says it does not authorize new runtime expansion, DB schema changes, live external AI, or direct ontology changes. V5-00 must preserve that boundary.
5. **Harness naming risk:** `CodexHarnessAdapter` is an adapter contract and policy skeleton, not proof that Codex App Server is deployed, connected, or production-authorized.
6. **GrowthEpisode naming risk:** A typed contract is not equivalent to a persisted canonical object, migration, workflow, or complete user journey.
7. **Model quality claim risk:** Deterministic/golden/human-review passes establish bounded evidence only. They do not establish independent model judgment, generalization, pilot safety, or production efficacy.
8. **Membership claim risk:** M0/M1/M2 is a direction and fixture contract. It is not production billing, payment success, entitlement activation, or a UI-authorized tier mutation path.

## 7. V5-00 gaps and risk register

| ID | Gap/risk | Severity | Required disposition |
| --- | --- | --- | --- |
| V5-00-R01 | No complete FTCC runtime with recipient/purpose/provenance/expiry/risk/trace lifecycle | P0 | Resolve in V5-01–V5-04 before external role access |
| V5-00-R02 | Subject isolation is present in selected Principal paths but not proven across all V5 planes | P0 | Establish subject boundary and negative cross-subject tests before context expansion |
| V5-00-R03 | Harness adapter exists without an admitted concrete tool/runtime integration | P0 | Keep boundary-only; require separate Harness/MCP gate |
| V5-00-R04 | Internal live text authorization may be misread as pilot/production authorization | P0 | Preserve registry levels; default mock/fail-closed |
| V5-00-R05 | Stale status documents obscure actual package/runtime evidence | P1 | Later documentation reconciliation; do not change status in this report |
| V5-00-R06 | GrowthEpisode contract has no proven complete canonical persistence/workflow implementation | P1 | Contract/evidence gate before migration or runtime work |
| V5-00-R07 | Trust-zone and ecosystem adapters are not implemented/admitted | P0 | No school/provider integration before purpose/FTCC contracts |
| V5-00-R08 | Eval and dataset assets do not equal production outcome evidence | P1 | Require outcome, cohort, rights, and independent-review gates |
| V5-00-R09 | Membership semantics could drift into score/rank/level behavior | P1 | Keep tier, growth stage, points, and community role independent; fixture-only |
| V5-00-R10 | V5 scope could accidentally trigger DB, Temporal, model, or agent expansion | P0 | Enforce V5-00 non-goals and one-approved-task rule |

## 8. Explicit V5-00 non-expansion ruling

This task remains **report-only and contract/truth convergence only**:

- No new business runtime is added.
- No database migration or schema change is added.
- No production external model is enabled, configured, or called.
- No pilot exposure is enabled.
- No autonomous Agent runtime or agent fleet is added.
- No UI-36 or new product surface is added.
- No school/provider integration is implemented.
- No Temporal production/pilot workflow is introduced.
- No membership production activation, payment integration, points redemption, referral qualification, or community-role promotion is implemented.
- No authorization entry is added or modified in `governance/AUTHORIZATION_REGISTRY.yaml`.
- Existing deterministic/mock/internal/live distinctions remain governed by the existing registry and current code gates.

## 9. Final disposition

**V5-00 status: READY AS A TRUTH-CONVERGENCE REPORT; NOT READY AS A V5 RUNTIME ADMISSION.**

The repository has a credible V4.1/M3 internal foundation and meaningful V4.2/V5 contract assets. The safe next step is not broad implementation. It is controlled acceptance of the missing contracts in sequence: subject isolation, authorization planes, FamilyNow read semantics, FTCC, then Harness/MCP boundaries, each with explicit evidence, rollback posture, and separate authorization. Until those gates close, all V5 claims must remain `design/contract`, `deterministic`, `mock`, or controlled `internal`; `pilot` and `production` remain `NO` for the V5 expansion.
