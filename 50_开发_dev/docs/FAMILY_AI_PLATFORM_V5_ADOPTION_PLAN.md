# Family AI Platform V5 Adoption Plan

status: ADOPTED_AS_ENGINEERING_DIRECTION
version: 0.1.0
date: 2026-08-24
source: Family AI Platform V5.0 research brief provided by Chief Architect
scope: 50_开发_dev engineering execution layer

## 1. Adoption Ruling

Family AI V5 is adopted as the next architecture direction for post-V4.1/V4.2 planning. It does not replace the current authorized sprint by itself, and it does not mutate `10_规格_spec` as conceptual SSOT. It becomes the engineering execution reference for the next controlled planning and implementation gates inside `50_开发_dev`.

The terminal platform definition is:

```text
Family Growth Intelligence & Ecosystem OS
家庭成长智能与生态操作系统
```

The platform serves long-running trust relationships among child, parent, teacher, school, professional provider, and platform operations. It must answer four continuous questions:

```text
What does the child need now?
What does the family need now?
What should happen next?
Who should participate in support?
```

The operating loop is:

```text
理解 → 建议 → 行动 → 服务 → 观察 → 回顾 → 新的理解
```

## 2. Non-Negotiable Continuity From V4

V5 keeps the existing Family hard rules:

- `Perspective != Fact`
- `Hypothesis != Fact`
- `Recommendation != Decision != Action`
- `ServiceCompletion != GrowthOutcome`
- No Family Total Score
- No family or child ranking
- AI does not directly write core ontology or canonical state
- Core state mutation goes through Named Action
- Model calls go through Model Gateway
- High-risk family scenarios require Human Gate
- No AI feature is complete without outcome and eval evidence

## 3. V5 Nine-Plane Architecture

V5 upgrades the planning model from a simple product/backend/AI/data split to nine planes:

```text
1. EXPERIENCE PLANE
   Child / Parent / Teacher / School / Advisor / Provider / Operations
   Mobile / Web / Voice / Digital Human

2. BUSINESS & TRUTH PLANE
   Family Core / Growth / Program / Service / School Collaboration / Commerce / Community
   Named Actions / PostgreSQL

3. TRUSTED CONTEXT & IDENTITY FABRIC
   Family Trusted Context Capsule / Consent / Purpose / Subject / Recipient
   Visibility / Provenance / Expiry

4. AGENT HARNESS PLANE
   Codex App Server / Thread / Turn / Event / Tool / MCP / Approval / Resume / Multi-Agent

5. PROFESSIONAL INTELLIGENCE PLANE
   Family-Core / Family-Safety / Family-Ranker / Family-Small / Model Router

6. KNOWLEDGE & SKILL PLANE
   Evidence / Method / Intervention / Curriculum / Skill / Expert Review / Rights

7. DURABLE WORKFLOW & SERVICE OS
   21-day / 90-day / annual service / Case / SLA / Booking / Human Handoff / Temporal

8. DATA / EVAL / LEARNING PLANE
   Event / AI Run / Dataset / Eval / Experiment / Analytics / Training

9. ECOSYSTEM INTEROP PLANE
   School / LMS / SIS / Teacher tools / Third-party providers
   OneRoster / LTI / CASE / QTI / Caliper / MCP / A2A
```

The three new infrastructure foundations are:

- Trusted Context Fabric
- Agent Harness
- Ecosystem Interop

## 4. Codex Harness Adoption Boundary

Codex Harness capability should be integrated behind a Family-owned adapter. It must not become the business system of record.

Allowed direction:

```text
Family UI
  ↓
Family API
  ↓
Family Intelligence Use Case
  ↓
FamilyHarnessAdapter
  ↓
Codex App Server
```

Forbidden direction:

```text
UI → Codex
Codex → SQL → PostgreSQL
```

All write paths remain proposal-first:

```text
Agent
  ↓
Proposal
  ↓
Policy / Human Confirm
  ↓
Named Action
  ↓
Domain Service
  ↓
PostgreSQL
```

Codex App Server may provide Thread, Turn, Event, Tool execution, MCP, Approval, Resume, Interrupt, Skill loading, and multi-agent orchestration. Family keeps ownership of domain tools, policy, context, consent, and canonical state.

## 5. Family-Owned IP Boundary

Do not spend engineering energy reimplementing mature infrastructure unless required by a gate. Integrate mature infrastructure where appropriate:

- Codex App Server for harness runtime
- MCP for agent-tool/context/resource access
- Temporal for durable multi-day service workflows
- PostgreSQL/pgvector, Redis, S3, OpenTelemetry, MLflow, and GraphRAG methods where they fit
- OneRoster, LTI, CASE, QTI, and Caliper for education ecosystem interop

Family must own and control:

- Family Ontology
- Child/Family Need Model
- Growth Evidence Graph
- Family Trusted Context Capsule
- Intervention Library
- Family Skill Registry
- Professional Dataset
- Family Eval
- FamilyNow
- GrowthEpisode
- Named Action
- Service Case/SLA
- Family/School/Partner authorization semantics

## 6. Family Trusted Context Capsule

FTCC is adopted as a required V5 architecture primitive.

Every AI or agent request must receive a purpose-limited, provenance-bearing context artifact instead of assembling a global child profile.

Minimum FTCC fields:

```text
context_id
context_version
family_id
subject_person_id
requester
recipient
purpose
use_case
allowed_claims
denied_categories
consent_snapshot
policy_version
provenance_refs
valid_from
expires_at
risk_flags
human_gate
trace_id
```

Different recipients receive different capsules. Parent, teacher, school, provider, and operations contexts must be separately governed. There is no shared super-profile.

## 7. Growth Evidence Graph Direction

V5 rejects a fixed child-score or child-label architecture.

The intended evidence model is:

```text
Fact --provenance/time--> Event

Perspective(parent)
Perspective(child)
Perspective(teacher)
        ↓
   Observation

Evidence
   ↓ supports/challenges
Hypothesis
   ↓ candidate
Intervention
   ↓ Recommendation
   ↓ human confirm
Named Action
   ↓
Growth Action / Service Case
   ↓
Reflection / Review
   ↓
New Evidence
   ↓ refine / supersede old hypothesis
```

The system records what is known, who claims it, why it is believed, what was done, and what later happened. It must not freeze a child into a permanent profile label.

## 8. Professional Model Stack Direction

V5 adopts a model stack strategy, not a single large-model strategy:

- Family-Small: classification, extraction, summary, tagging, PII/sensitive detection
- Family-Safety: self-harm, violence, abuse, dependency, boundaries, crisis routing
- Family-Ranker: intervention/content/service candidate ranking
- Family-Core: family context understanding, professional explanation, intervention selection, growth planning
- Family-Embedding/Reranker: professional semantic retrieval
- Frontier Reasoner: complex, low-frequency, high-value reasoning

Build order:

1. Frontier model + Intervention Library + RAG + Skill + structured output + Safety + Expert Review + Family Eval
2. Family-Small / Family-Safety / Family-Ranker
3. Family-Core PEFT/LoRA/SFT only after enough expert-reviewed data exists

Do not start from scratch pretraining.

## 9. Product Object Direction

V5 introduces `GrowthEpisode` as the unifying object behind 21-day, 90-day, and annual growth services:

```text
Need → Episode → Phase → Action → Check-in → Review → Decision → Next Episode
```

The seven product domains are:

- Need & Understanding
- Growth Journey
- Parent Growth
- Child Support
- School Collaboration
- Service OS
- Resource & Commerce

Commerce must not reverse-control growth recommendations.

## 9A. Family Membership OS V2 Direction

The two membership design reviews are adopted together. The conclusion is not to remove membership tiers, and not to return to traditional VIP tiers. Family will use three relationship-depth tiers, while keeping growth stage, loyalty points, and community role as independent dimensions.

### Membership Tier

Membership tier answers only:

```text
What depth of long-term service relationship has this family established with Family?
```

The initial tier set is deliberately limited to three levels:

```text
M0_FREE    家庭会员
M1_GROWTH  成长会员
M2_ANNUAL  年度会员
```

| Tier | Entry basis | Relationship promise | Typical value |
|---|---|---|---|
| M0 家庭会员 | Family account and basic relationship | Establish the family relationship | Basic assessment, selected AI/content, community browsing, private growth record |
| M1 成长会员 | Eligible 21-day/90-day growth product or approved effective relationship | Enter an active growth relationship | Growth plan, AI companion, growth records, selected activities/content, points acceleration |
| M2 年度会员 | Annual Family Growth Membership activation | Establish a 365-day relationship | Four growth cycles, Family Steward, expert/activity benefits, annual family report, member service |

These are relationship tiers, not child or family ability scores. They must never be used for family ranking, clinical inference, growth judgment, or safety prioritization.

### Independent Dimensions

```text
Membership Tier
   M0 家庭会员 → M1 成长会员 → M2 年度会员
   Answers: what long-term service relationship exists?

Growth Stage
   ONBOARDING → FIRST_VALUE → ACTIVE_GROWTH → REVIEW → RENEWAL_WINDOW
   Answers: where is the current growth journey?

Loyalty Points
   PointsAccount / PointsLedger / PointsRule / Redemption
   Answers: what eligible participation assets have accumulated?

Community Role
   GROWTH_PARTNER → SHARING_AMBASSADOR → CITY_INITIATOR
   Answers: what contribution role exists in the ecosystem?
```

No dimension may be rendered as another dimension. For example:

```text
M2 年度会员
≠
成长阶段：稳定行动期
≠
成长积分：1,280
≠
社区身份：成长伙伴
```

### Product-to-Tier Rules

Not every purchase changes the membership tier:

```text
Family account                  → M0
One event / one salon           → M0 + Event Entitlement
21-day or 90-day growth product → M0 → M1, subject to activation policy
Annual membership               → M1 → M2, subject to commerce activation
One expert consultation         → current tier + Consultation Entitlement
```

Tier change is a deterministic domain decision. It cannot be directly changed by an AI agent, points display, referral draft, or UI local state.

### Commercial And Honorary Progression

Commercial progression is:

```text
M0 家庭会员 → M1 成长会员 → M2 年度会员 → renewal
```

Honorary/community progression is separate:

```text
成长伙伴 → 分享官 → 城市发起人
```

Community roles require evidence of sustained participation, contribution quality, qualified referrals, service feedback, and compliance. Payment amount alone cannot grant a community role.

### UI Semantic Rule

The UI may show the four facts together, but each label must remain explicit:

```text
张女士
年度会员 M2
成长阶段：第二周期 · 稳定行动期
成长积分：1,280
社区身份：成长伙伴
```

The following patterns are forbidden:

- Annual subscription automatically displayed as `Lv.3`.
- Non-member automatically displayed as `Lv.1`.
- Fixed `LV3 成长达人` copy.
- Fixed points such as `1280` or a fixed progress bar.
- A community role displayed as a membership tier.
- A local invitation draft displayed as a qualified referral.

### First-Phase Commercial Constraint

M0/M1/M2 is a product and contract direction, not authorization for production billing. Current fixture-only `DEV/TEST`, `external_effect=false`, and `TEST_NOOP_ADAPTER` boundaries remain unchanged until Commerce Order → PaymentSucceeded → MembershipActivation is separately approved.

The first membership domain task must establish `MembershipPeriod`, `ActivationSource`, and tier transition policy before UI redesign or production activation.

## 10. Trust Zones And Ecosystem

Schools and providers are not just tenants. V5 adopts explicit trust zones:

```text
Family Trust Zone
        ↕ explicit grant
School Trust Zone
        ↕ contract/purpose
Partner Trust Zone
```

School integration should be standards-first through adapters. Provider access goes through Purpose Grant, FTCC, Service Case, and least-required context. Third-party providers do not receive direct database access.

## 11. Minor Safety As Architecture

V5 treats minors as an architectural boundary across Identity, Consent, Context, Safety, Memory, Agent, Training Data, Digital Human, and analytics. This is not a later `is_minor` patch.

Required capabilities include guardian consent, minor mode, AI identity disclosure, dependency and long-session warning, high-risk intervention, deletion/copy rights, and strict training-use controls for sensitive interactions.

## 12. 24-Month Gate Plan

V5 is executed through six gates:

1. 0-6 weeks: Runtime Truth Convergence
2. 6-12 weeks: Agent Foundation
3. 3-6 months: Knowledge / Skill / Eval
4. 6-9 months: Professional Model V1
5. 9-18 months: School + Partner Ecosystem
6. 18-24+ months: Learning Flywheel

## 13. 90-Day Patch Line

The first controlled V5 line is:

```text
V5-00 Runtime Truth
↓
V5-01 Subject Isolation
↓
V5-02 Authorization Planes
↓
V5-03 FamilyNow
↓
V5-04 Trusted Context Capsule
↓
V5-05 Harness Boundary
↓
V5-06 MCP Read Tools
↓
V5-07 Temporal Pilot
↓
V5-08 Knowledge Supply
↓
V5-09 Eval Platform
↓
V5-10 Golden Product E2E
```

First implementation entry: `FAMILY-AI-V5-RUNTIME-FOUNDATION-001`.

## 14. Explicit 90-Day Non-Goals

- Do not add UI-36 as a new feature front
- Do not fork `codex-rs`
- Do not pretrain a family education large model from scratch
- Do not make Kafka, Neo4j, or Kubernetes a phase goal
- Do not let Agent directly SQL
- Do not build a unified child super-profile
- Do not open high-autonomy AI before Family Eval is complete

## 15. Adoption Output

This document is the engineering adoption anchor. The executable task pack is `backlog/tasks/FAMILY-AI-V5-RUNTIME-FOUNDATION-001.md`.
