# Family AI 系统架构与 Claude 执行蓝图 V1.0

> **文档性质：EXECUTION BLUEPRINT / 执行级架构蓝图**  
> **适用仓库：`PoCP-Protocol/family-ai`**  
> **分析基线：当前分支 `feat/receipt-assignment-batch-metrics` + 项目既有 V3.2/V3.3 治理与运行时代码**  
> **目标：不推翻已验证的 Family Core / Growth OS / Principal Runtime，而是把页面、领域、AI、服务、数据、事件与治理收束成一套可执行、可演进、可审计的 Family AI 平台架构。**
>
> **本文件不是新的最高级 Source of Truth。** 当本文件与仓库既有规范冲突时，必须服从：
> `CLAUDE.md` → `specs/ontology/**` → `specs/actions/**` → `specs/policies/**` → `specs/api/**` → `CURRENT_SPRINT.md` → Approved Task → Architecture Docs → 本文件 → Existing Code。
>
> **本文件提供“实施收敛路线”，不授权一次性大重构。Claude 每次只执行一个 ARCH Task，完成后停止。**

---

# 0. Claude 最高级执行协议

Claude 进入本架构任务后，固定执行：

```text
READ CURRENT FACT
↓
READ APPROVED SSOT
↓
BUILD ARCHITECTURE INVENTORY
↓
IDENTIFY DRIFT
↓
SELECT ONE APPROVED VERTICAL SLICE
↓
PLAN
↓
IMPLEMENT
↓
TEST
↓
SELF REVIEW
↓
REPORT
↓
STOP
```

禁止：

```text
NO BIG-BANG REWRITE
NO MICROSERVICES
NO KAFKA
NO KUBERNETES
NO WORLD MODEL RUNTIME
NO GENERIC PATCH FOR CORE STATE
NO DIRECT LLM → DATABASE
NO AI FREE TEXT → CANONICAL STATE
NO CROSS-DOMAIN DIRECT MUTATION
NO CLIENT-COMPOSED CANONICAL BUSINESS TRUTH
NO SILENT SPEC CHANGE
NO FAKE FAMILY/GROWTH DATA TO MATCH UI
NO TEST_FIXTURE CLAIMED AS REAL_PRODUCTION
```

---

# 1. 系统架构总判断

## 1.1 核心不重写，只做收敛

当前项目已经形成真实工程基础，以下全部 **KEEP**：

```text
Family Ontology
Growth OS
Named Actions
NestJS Modular Monolith
PostgreSQL
Redis（按需）
Outbox / Event Ledger
Audit / Trace
Principal Runtime
AI Gateway abstraction
现有 Mobile / Web 运行面
```

当前主要问题不是“没有架构”，而是经过 M1/M2/M3 多轮纵切后，功能已经长出来，但：

```text
模块所有权没有完全收束
页面读模型没有统一
客户端承担了部分业务编排
本地 Draft / Cache / Canonical Truth 边界偏弱
Orchestration 责任过宽
FamilyModule 混入大量 Growth 能力
Service/Commerce 部分仍是 test-loop runtime
WAF 有代码但 runtime wiring 不完整
文档状态与实际运行时代码出现漂移
```

因此本轮是：

```text
ARCHITECTURE CONVERGENCE
+ RUNTIME TRUTH ALIGNMENT
+ PROJECTION / COMMAND SEPARATION
+ DOMAIN OWNERSHIP CLEANUP
+ CLIENT THINNING
```

不是 Core Rewrite。

---

# 2. 当前系统事实（CURRENT FACT）

## 2.1 当前应用拓扑

当前真实 apps：

```text
apps/
  api/
  mobile/
  web/
  fes-api/
  fes-web/
```

V3.2 目标态中的 `consumer-web/`、`ops-web/`、`worker/` 尚未完整存在，因此禁止为了“对齐文档”立即 rename/move。采用 Strangler Migration。

## 2.2 当前 API Runtime

当前 `AppModule` 接入：

```text
AuditModule
FamilyModule
PrincipalModule
AuthModule
OrchestrationModule
```

当前 modules 目录：

```text
auth/
family/
orchestration/
principal/
waf/
```

`waf/` 已有 service/spec/seed，但当前不是完整 Module，且未由 AppModule 接入。因此：

```text
WAF CODE EXISTS != WAF RUNTIME WIRED
```

任何后续接线必须先确定 WAF 的正式产品/领域边界。

## 2.3 当前 FamilyModule 负载

当前 `FamilyModule` 实际同时包含：

```text
Family Core
Family Context
Growth Subject Resolution
Evidence Synthesis
Growth Priority
Intervention
Journey Plan
Growth Action
Growth Review
Today Projection
Onboarding
DEV Core Growth
DEV Platform Surfaces
DEV Flow Receipts
Tenant-scoped UI Projection
```

目标架构上应是：

```text
Family Core owns family truth
Growth OS owns growth state
```

但当前代码是：

```text
FamilyModule = Family Core + large part of Growth OS + DEV projections
```

正确迁移不是立刻搬文件，而是：

```text
先定义 ownership / ports
→ 再固定 contracts
→ 再逐步迁移 application service
→ 每一步保持行为与测试不变
```

## 2.4 当前 Orchestration

现有 Orchestration 承担：

```text
eligibility
decision integrity
commerce intent
commerce objects
membership/entitlement
service supply
service booking
test-loop projection
跨域编排
```

长期定位应收束为：

> **跨领域应用编排 + Intent/Decision Bridge + 外部效果边界**

而不是 Canonical Domain Owner。

## 2.5 当前 Principal / AI Runtime

当前已经存在：

```text
packages/ai-gateway/
packages/principal-ai/
packages/principal-runtime/
apps/api/src/modules/principal/
```

`ai-gateway` 已有 provider/routing/attempt 实现与测试；`principal-runtime` 已有 provider policy、registry、skill runtime；Principal 已有 bridge、consumer contract、IAM 与运行检查。

因此：

```text
AI_GATEWAY = EXISTING RUNTIME ASSET
PRINCIPAL_RUNTIME = EXISTING RUNTIME ASSET
```

禁止根据旧状态文档重新创建第二套 Gateway/Runtime。

## 2.6 当前 Mobile

Mobile 已经是一个统一产品壳，一级导航为：

```text
今天 / 成长 / 发现 / 服务 / 我的
```

已具备：

```text
API session
Bearer auth
Family context
projection adapters
shared reducer
AsyncStorage
pull-to-refresh
UI registry
UI action policies
35 UI routes
```

但本地 reducer 已保存大量：

```text
camp progress
assessment answers
child choices
private story
commerce intent draft
consultation draft
community draft
bookmark/follow
local action state
```

必须最终分成：

```text
SERVER_CANONICAL
SERVER_PROJECTION_CACHE
LOCAL_DRAFT
UI_EPHEMERAL
```

AsyncStorage 永远不是 canonical business truth。

---

# 3. Family AI 目标逻辑架构

```text
┌────────────────────────────────────────────────────────────┐
│                 FAMILY CONSUMER EXPERIENCE                 │
│ Mobile / Web                                               │
│ Home / Assessment / Growth / Principal / Program           │
│ Content / Community / Service / Commerce / Mine            │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│          CONSUMER APPLICATION / PROJECTION LAYER           │
│ Page Projections / BFF / View Models                       │
│ FamilyHomeProjection                                       │
│ AssessmentProjection                                       │
│ GrowthPlanProjection                                       │
│ TodayProjection                                            │
│ ServiceSupplyProjection                                    │
│ ResourceDiscoveryProjection                                │
│ CustomerAssetProjection                                    │
│ READ COMPOSITION ONLY                                      │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                 APPLICATION COMMAND LAYER                  │
│ Named Actions                                              │
│ Decision / Intent / Confirmation                           │
│ Cross-domain Orchestration                                 │
│ Idempotency / Version Check / Audit                        │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                     DOMAIN PLATFORM                        │
│ Identity/Auth                                              │
│ Family Core                                                │
│ Consent                                                    │
│ Safety / Human Gate                                        │
│ Growth Intelligence                                        │
│ Growth Journey & Action                                    │
│ Principal AI                                               │
│ Program / Challenge / We are Famili                        │
│ Content / Community                                        │
│ Service OS                                                 │
│ Commerce / Membership                                      │
│ Operations                                                 │
│ Analytics                                                  │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                         DATA                               │
│ PostgreSQL / Redis / Object Storage                        │
│ ProductEvent / GrowthEvent / AuditEvent / Outbox           │
│ PrincipalModelRun Ledger                                   │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                  INTEGRATION / ADAPTER                     │
│ Payment / Calendar / Notification / Live / CRM / LMS       │
│ External Model Provider                                    │
│ FELS Snapshot / FLM Import                                 │
└────────────────────────────────────────────────────────────┘
```

---

# 4. 领域边界

## 4.1 Identity / Auth

拥有：

```text
Account
Session
Authentication
Authorization
Account↔Person binding
Trusted Principal
```

不拥有 Family Relationship / Consent Truth / Growth State。

不变量：

```text
Account != Person
Person != FamilyMembership
FamilyRelationship != AuthenticationRole
```

服务端必须从可信 Session 派生 actor/account/person/role/family/tenant scope。客户端 body/header 自报不能成为事实。

## 4.2 Family Core

拥有：

```text
Family
Person
Parent
Child
FamilyRelationship
FamilyMembership
LifeStage assignment relation
Family aggregate
```

回答：谁属于这个家庭、谁能看谁、关系是什么、subject 是否在 family 内。

不拥有 GrowthProfile/Priority/Journey/Intervention/Action/Outcome/AI Response/Booking/Order。

## 4.3 Consent

中央平台能力：

```text
Grant
Withdraw
Check
Purpose authorization
Retention
Visibility
Expiration
Audit
```

Family 1.0 Purpose：

```text
SERVICE
ASSESSMENT
AI_PERSONALIZATION
GROWTH_TRACKING
EXPERT_SERVICE
CONTENT_PUBLICATION
MODEL_IMPROVEMENT
```

每次跨域读取都必须能解释：WHO reads WHAT for WHICH PURPOSE under WHICH CONSENT at WHICH TIME。

## 4.4 Safety / Human Gate

拥有：

```text
Safety route
High-risk flags
Policy decision
Human review requirement
Handoff case
Kill switch
Provider gate
```

Safety 只允许 block / allow / require-human，不可直接创建 Growth truth。

## 4.5 Growth Intelligence

负责：

```text
Evidence
Perspective
Hypothesis
GrowthProfile
GrowthPriority
Assessment interpretation
Evidence synthesis
Uncertainty
```

不变量：

```text
Perspective != Fact
Hypothesis != Fact
Assessment != Diagnosis
Recommendation != Decision
```

AI 只可生成 Explanation/Hypothesis/Question/RecommendationCandidate，不可直接确认 GrowthProfile/Priority/Action/Outcome。

## 4.6 Growth Journey & Action

拥有：

```text
Journey
JourneyPhase
Plan
Intervention
GrowthAction
Check-in
Review
OutcomeObservation
Timeline
```

主闭环：

```text
Evidence
↓
Profile
↓
Priority
↓
Recommendation
↓
Family Decision
↓
Journey / Intervention
↓
GrowthAction
↓
Check-in
↓
Observation
↓
Review
↓
Next Decision
```

始终保持：

```text
Recommendation != Decision != Action != Outcome
```

## 4.7 Principal AI

定位：理解家庭问题、取得最小必要上下文、生成结构化解释与行动候选；不拥有 Family/Growth canonical truth。

运行链：

```text
User Input
↓
Safety Pre-check
↓
Intent / Scenario
↓
Family Context Broker
↓
Knowledge / Method Retrieval
↓
Principal Soul
↓
Model Gateway
↓
Structured Output
↓
Schema Validation
↓
Safety Post-check
↓
PrincipalResponse
↓
PrincipalActionProposal
```

进入 Growth OS 的唯一正常路径：

```text
PrincipalActionProposal
↓
User/Human Confirm
↓
ConfirmPrincipalAction
↓
Approved Named Action
↓
GrowthAction
```

永远禁止 LLM 直接写 Growth 表。

## 4.8 Program / Challenge / We are Famili

负责 Program definition、7/21-day challenge、ProgramDay、Participation、Content Sequence、Program Check-in UX。

区分：

```text
ChallengeParticipation != GrowthJourney
ProgramDayCompleted != GrowthOutcome
CommunityEvent != GrowthEvent
```

Challenge 转 Growth Journey 必须经用户确认 + Named Action。

## 4.9 Content / Community

Content 拥有：Editorial Content、ResourceAsset、Topic、CaseAsset、Knowledge material、Review status、Evidence refs。

Community 拥有：Private/Community Post、Discussion、Bookmark、Follow、Response、Participation。

社区行为不能定义孩子成长事实。

## 4.10 Service OS

拥有：

```text
Provider
ProviderQualification
ServiceOffering
AvailabilitySlot
BookingIntent
Booking
ServiceRecord
Cancellation
ServiceTimeline
```

区分：

```text
Recommended Service != Booked Service != Delivered Service != Growth Outcome
```

占座/电话/视频/日历/通知/真人联系 = 外部 effect，必须 Adapter + Gate。

## 4.11 Commerce / Membership

拥有 ProductOffering、CommerceIntent、OrderIntent、Entitlement、MembershipPlan、CustomerAsset/Projection。

现有 test-loop 可以保留，但必须显示：

```text
runtime_status = TEST_LOOP_FIXTURE
external_effect = false
```

支付/履约/发票等必须 Adapter 化。

## 4.12 Operations

允许 review/route/annotate/handoff/escalate/safety review/provider review/content review/audit inspection。

禁止 Ops 变成 generic core editor。影响 canonical state 的人工动作也必须走 Named Action。

## 4.13 Analytics

拥有 ProductEvent/Funnel/Experiment/Retention/AI Evaluation/Ops Metrics；不拥有 Growth truth。

```text
ProductEvent != GrowthEvent
```

---

# 5. 页面架构：35 UI 是 35 个受控窗口，不是 35 个业务系统

统一公式：

```text
UI SCREEN
=
Projection(s)
+
Allowed Named Action(s)
+
Navigation
+
Presentation State
```

页面不能成为 Domain Orchestrator。

能力族：

```text
UI-01             Family Home / Cross-domain Projection
UI-02 ~ UI-10     Assessment / Growth Intelligence / Plan / Task / Review
UI-11 ~ UI-18     Content / Commerce / Membership / Resource
UI-19 ~ UI-24     Service Supply / Provider / Booking / Service Record
UI-25 ~ UI-28     Community / Private content / interaction draft
UI-29 ~ UI-34     Results / Assets / Membership / Service / Family Profile
UI-35             Program / 21-day Camp
```

精确标题、route、功能点以 `apps/mobile/lib/family/ui-registry.ts`、`governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json`、原图 baseline 为准。

---

# 6. Projection / BFF 架构

当前需要重点纠正：页面直接调多个 Domain API 再自行拼业务含义。

错误：

```text
UI-01
├ GET today
├ GET journey
├ GET intervention
├ GET service
└ GET commerce
       ↓
React decides business meaning
```

正确：

```text
UI-01
↓
GET /families/:familyId/home
↓
FamilyHomeProjectionService
↓
approved read ports
↓
domain projections
```

Projection 只做：READ / COMPOSE / FILTER / SCOPE / VERSION / SOURCE / PRESENTATION-READY SHAPE，不做 canonical mutation。

所有 Projection 目标统一 Meta：

```ts
type ProjectionMeta = {
  projection_version: string;
  as_of: string;
  visibility: "PRIVATE_FAMILY" | "PRIVATE_PERSON" | "INTERNAL" | "PUBLIC";
  runtime_status:
    | "REAL_PERSISTED"
    | "REAL_INTERNAL_RUNTIME"
    | "TEST_LOOP_FIXTURE"
    | "LOCAL_DRAFT"
    | "READ_ONLY_PROJECTION"
    | "GATE_BOUNDARY"
    | "NOT_IMPLEMENTED";
  source_refs: string[];
  trace_id: string;
  stale?: boolean;
};
```

---

# 7. Command / Named Action 架构

所有核心写操作：

```text
Request
↓
Authenticate
↓
Resolve Actor
↓
Resolve Family/Subject Scope
↓
Permission
↓
Consent
↓
Safety / Human Gate
↓
Schema Validation
↓
Expected Version
↓
Idempotency
↓
Named Action
↓
Transaction
↓
Domain Event
↓
Audit Event
↓
Outbox
↓
Receipt
```

推荐 Command Envelope：

```ts
type CommandEnvelope<T> = {
  action_name: string;
  command_id: string;
  family_id: string;
  subject_person_id?: string;
  actor: { account_id: string; person_id: string };
  purpose: string;
  consent_ref?: string;
  idempotency_key: string;
  correlation_id: string;
  expected_version?: number;
  payload: T;
};
```

Envelope 中 actor/family 等必须由服务端重新校验，不能信任客户端自报。

---

# 8. Idempotency 统一规范

所有重要写动作：

```text
same family + same action + same idempotency_key = same business result
```

重复请求不得 duplicate GrowthAction/Booking/CommerceIntent/Outcome/external effect。

建议 command receipt：

```text
family_id
action_name
idempotency_key
request_hash
result_ref
status
created_at
```

语义：

```text
same key + same request hash → replay result
same key + different request hash → 409 IDEMPOTENCY_CONFLICT
```

---

# 9. Event Architecture

永久分离：

## ProductEvent
用户行为、漏斗、留存、实验；如 PAGE_VIEW、ASSESSMENT_STARTED、PRINCIPAL_QUESTION_SUBMITTED、ACTION_CARD_ACCEPTED、CHALLENGE_JOINED。

## GrowthEvent
只有受控 Growth Named Action 才产生：GrowthProfileConfirmed、JourneyStarted、GrowthActionCompleted、OutcomeObserved 等。

## AuditEvent
actor / permission / consent / safety / mutation / human review / policy version / source / correlation。

## OutboxEvent
纯技术可靠交付记录，不是 Domain Truth。

---

# 10. AI 平台架构

## 10.1 现有 Runtime KEEP

保留：

```text
packages/ai-gateway
packages/principal-ai
packages/principal-runtime
apps/api/src/modules/principal
```

未经 ADR 不创建第二套 Gateway/Runtime。

## 10.2 Family Context Broker

AI 获取 Family context 的唯一正式路径。

强制：permission / consent / purpose / minimum necessary / retention / redaction / source lineage / audit。

最小 Context Package 示例：

```ts
type FamilyAiContext = {
  family_id: string;
  subject_person_id: string;
  life_stage?: string;
  current_growth_topic?: string;
  latest_accepted_action?: { action_ref: string; summary: string };
  latest_checkin_summary?: string;
  consent_context: { purpose: string; valid: boolean };
  source_refs: string[];
  as_of: string;
};
```

禁止默认把 full household history / all child records / all assessment answers / all private notes 给模型。

## 10.3 PrincipalModelRun Ledger

必须记录：model_run_id、provider/name/version、prompt/soul version、knowledge/method refs、input/output hash、safety route、latency、token usage、feedback/human rating、correlation_id。

---

# 11. Local State 架构

## SERVER_CANONICAL
Family/Membership/Consent/GrowthProfile/Priority/Journey/GrowthAction/Outcome/Booking/Order/Entitlement。禁止 AsyncStorage 为权威。

## SERVER_PROJECTION_CACHE
允许缓存，但包含 projection_version/as_of/source/stale/family_id。

## LOCAL_DRAFT
允许未提交 assessment answer/private note/community post/consultation/commerce intent/form input。

建议：

```ts
type LocalDraftMeta = {
  draft_id: string;
  family_id: string;
  draft_type: string;
  revision: number;
  created_at: string;
  updated_at: string;
  sync_state: "LOCAL_ONLY" | "PENDING" | "SYNCED" | "CONFLICT";
};
```

## UI_EPHEMERAL
modal/loading/expanded/scroll/temporary selection，不持久化。

---

# 12. 外部 Adapter 架构

真实外部 effect：Payment/Notification/SMS/Email/Calendar/Live/CRM/LMS/Invoice/External Model Provider。

统一链：

```text
Domain/Application Intent
↓
Policy
↓
Human Gate if required
↓
Outbox Job
↓
Adapter
↓
External System
↓
External Receipt
↓
Audit / Domain follow-up
```

业务 Domain Service 不直接 import 第三方 SDK。

---

# 13. 物理部署架构

100-family / early MOS 保持简单：

```text
Mobile / Web
    │ HTTPS
    ▼
NestJS API (Modular Monolith)
    ├── PostgreSQL
    ├── Redis
    └── Outbox / Jobs
             │
             ▼
      Background Worker
             │
             ▼
 Model / Notification / Storage / External Adapters
```

当前无独立 worker 时不强制先抽离，只有真实 async workload 证明需要后再建立。

---

# 14. Target Repo Shape（目标，不是即时搬迁）

```text
50_开发_dev/
  apps/
    api/
    mobile/           # current consumer app KEEP
    web/              # current web strangler
    consumer-web/     # later
    ops-web/          # later
    worker/           # later
    fes-api/
    fes-web/

  packages/
    contracts/
    ai-gateway/
    principal-ai/
    principal-runtime/
    program-runtime/
    ui/
    sdk/
    config/

  specs/
    ontology/
    actions/
    policies/
    api/

  governance/
  docs/
  reports/
```

API 最终逻辑边界可演进为：

```text
auth/identity
family
growth
consent
safety
principal
program
community
content
service
commerce
operations
analytics
orchestration
```

**模块命名不是优先目标，边界正确才是目标。禁止为了目录漂亮先搬大量文件。**

---

# 15. 当前主要差距

## P0

### P0-01 Page Projection 不统一
页面仍会自行并发读取多个领域 API。第一样板：UI-01 → FamilyHomeProjection。

### P0-02 FamilyModule 过载
Family Core 与 Growth OS 责任混合。先 ports/ownership，后渐进拆分。

### P0-03 Consent/Safety 目标边界尚未完全成为独立 runtime 边界
已有 guard/policy 要复用，禁止复制 consent truth。

### P0-04 WAF 有代码但 wiring/ownership 不清晰
先 ADR：WAF 是否等于 We are Famili / Program / seeded domain；再决定接线。

### P0-05 Service/Commerce 部分仍是 test-loop
不得声称真实 payment/booking/fulfillment 完成。

### P0-06 Mobile Local State 边界模糊
Local Draft 合理；canonical authority 必须服务端化。

### P0-07 文档 Drift
建立 Runtime Inventory，防止“文档说未开始，但代码已经存在”等冲突误导实施。

## P1

```text
Projection contract versioning 不统一
source_refs/as_of/visibility/runtime_status 不统一
Shared Contracts 与页面 DTO 有手写漂移
ProductEvent / ModelRun / Audit 观测不统一
35 UI 语义验收未全完成
Cross-domain ports 不完全显式
```

## P2

```text
consumer-web / ops-web packaging
worker extraction
external effect adapters
visual regression automation
performance/cache
large-scale analytics
```

---

# 16. Architecture Fitness Tests

逐步建立自动架构守卫：

```text
FIT-001 No direct LLM provider SDK outside ai-gateway.
FIT-002 No generic PATCH mutates core ontology.
FIT-003 No endpoint trusts family_id/actor/role from body without server verification.
FIT-004 Cross-family read/write fails closed.
FIT-005 Consent-required operation fails after withdrawal/expiry.
FIT-006 TEST_LOOP_FIXTURE cannot be reported as REAL_PERSISTED.
FIT-007 ProductEvent is never written as GrowthEvent.
FIT-008 PrincipalResponse cannot directly create canonical GrowthAction.
FIT-009 Important Named Action requires idempotency.
FIT-010 Same idempotency key + different request conflicts.
FIT-011 AsyncStorage does not become canonical authority.
FIT-012 Family API never directly reads FELS legacy tables.
FIT-013 UI-01 connected mode uses FamilyHomeProjection.
FIT-014 Projection exposes version/as_of/source/visibility/runtime status.
FIT-015 External effect remains blocked when adapter/gate is unauthorized.
```

---

# 17. 测试体系

每个 vertical slice：

```text
Unit
↓
Contract
↓
Integration
↓
Real PostgreSQL Integration
↓
HTTP E2E
↓
Negative Security
↓
Mobile/Web Test
↓
Browser / Native Smoke
↓
Golden Journey
```

涉及写操作必须额外测试：idempotency、concurrency、expected version conflict、cross-family、permission、consent withdraw、safety block、duplicate submit、retry after timeout、zero duplicate external effect。

---

# 18. 系统 Golden Journey

最终必须证明：

```text
Login
↓
Trusted Account/Person
↓
Resolve Family
↓
Home Projection
↓
Assessment / Real Family Issue
↓
Principal Explanation
↓
PrincipalActionProposal
↓
User Confirm
↓
Named Growth Action
↓
Today's Action
↓
Complete / Check-in
↓
GrowthEvent
↓
Timeline
↓
Review
↓
Optional Program / Service / Resource
↓
Return next session
```

并验证：restart/token expiry/401/offline-retry/duplicate submit/wrong family/wrong subject/withdraw consent/stale projection/provider unavailable/no unauthorized external effect。

---

# 19. Claude 实施路线（严格逐项）

## ARCH-00 — Architecture Inventory & Drift Lock

只做审计，不改业务。产出：

```text
reports/architecture/ARCH_RUNTIME_INVENTORY_V1.md
reports/architecture/ARCH_MODULE_OWNERSHIP_MATRIX_V1.md
reports/architecture/ARCH_DRIFT_REGISTER_V1.md
```

核验 apps、AppModule、modules、Family/Orchestration/Principal/WAF、packages、routes、contracts、repositories/migrations、35 UI、API client、AsyncStorage、runtime status、test-loop、Named Actions、events、provider policy、状态文档漂移。

完成后停止。

## ARCH-01 — Shared Runtime Truth Contract
统一 ProjectionMeta / RuntimeStatus / SourceRef / Visibility / Trace/Correlation；不移动 Domain。

## ARCH-02 — Family Context / Subject / Consent Scope Gate
所有 page projection 共用可信 actor/family/subject/purpose/consent/visibility。

## ARCH-03 — UI-01 FamilyHomeProjection
UI-01 connected mode → one backend projection；建立 projection architecture 样板。

## ARCH-04 — Growth Vertical Slice
范围 UI-02~UI-10 + UI-35 linkage；对齐 Assessment/Explanation/Priority/Plan/Action/Review。

## ARCH-05 — Principal Integration Bridge
不重写 AI；把 Home/Growth → Context Broker → existing Principal → Proposal → Confirm → Named Action 打通。

## ARCH-06 — Program / WAF Boundary Decision
先 ADR 后编码。回答 WAF 的正式语义、owner、与 program/principal/growth 的关系；未经确认不 wire AppModule。

## ARCH-07 — Service OS
范围 UI-19~UI-24；Provider/Qualification/Offering/Slot/Booking/ServiceRecord；外部 effect 仍受 Gate。

## ARCH-08 — Resource / Commerce / Membership
范围 UI-13~UI-18 + 相关 UI-30/UI-32；统一 fixture/catalog/intent/entitlement runtime truth。

## ARCH-09 — Content / Community / Private Draft
范围 UI-12、UI-25~UI-29；明确 content/case/evidence/community/private/publication。

## ARCH-10 — Family Profile / Assets / Mine
范围 UI-29~UI-34；server projection + local draft 边界。

## ARCH-11 — Events / Audit / Analytics
统一 ProductEvent/GrowthEvent/AuditEvent/OutboxEvent/PrincipalModelRun，建立最小指标链。

## ARCH-12 — Ops / Human Handoff
最小 family lookup/safety case/principal review/provider-content review/handoff/audit view；禁止 generic core mutation。

## ARCH-13 — Background Worker
只有 async workload 明确后执行；迁移 AI async/notification/content/analytics/outbox jobs，不拆微服务。

## ARCH-14 — Consumer Shell Strangler
不 big-bang rename mobile/web；通过 shared contracts/navigation/feature boundaries page-by-page 演进。

## ARCH-15 — System Golden E2E / Production Readiness
Architecture Fitness + Real PG + HTTP + Security + Idempotency + Browser/Native + AI Safety + Human Handoff + external effect boundary + observability + rollback。

---

# 20. 每个 ARCH Task 标准输入/输出

开始前输出：

```text
TASK
UNDERSTANDING
CURRENT FACT
TARGET STATE
FILES TO READ
FILES TO CHANGE
DEPENDENCIES
CONFLICT CHECK
IMPLEMENTATION PLAN
RISKS
DO NOT DO
ACCEPTANCE GATE
```

完成后输出：

```text
TASK RESULT
FILES CHANGED
CONTRACTS CHANGED
DB MIGRATIONS
TESTS RUN
PASS / FAIL
SECURITY CHECK
IDEMPOTENCY CHECK
RUNTIME TRUTH CHECK
KNOWN LIMITATIONS
PROJECT_STATUS UPDATE PROPOSAL
NEXT RECOMMENDED TASK
STOP
```

`NEXT RECOMMENDED_TASK` 只是建议，不得自动执行。

---

# 21. Claude 第一条执行指令

将本文件放进仓库后，给 Claude：

```text
你现在是 Family AI Platform 的受控架构执行工程师。

先阅读：
1. 00_START_HERE.md
2. CLAUDE.md
3. PROJECT_STATUS.md
4. CURRENT_SPRINT.md
5. docs/FAMILY_TECH_ARCH_V3.2.md
6. docs/PRODUCT_BOUNDARY_MAP_V3.2.md
7. docs/DATA_OWNERSHIP_MATRIX_V3.2.md
8. docs/EVENT_TAXONOMY_V3.2.md
9. docs/AI_FAMILY_INTEGRATION_CONTRACT_V3.2.md
10. docs/FAMILY_1_0_MOS_ARCHITECTURE_GATE.md
11. specs/ontology/**
12. specs/actions/**
13. FAMILY_SYSTEM_ARCHITECTURE_EXECUTION_BLUEPRINT_V1.md

然后只执行：
ARCH-00 — Architecture Inventory & Drift Lock

本任务禁止业务重构。

必须输出：
reports/architecture/ARCH_RUNTIME_INVENTORY_V1.md
reports/architecture/ARCH_MODULE_OWNERSHIP_MATRIX_V1.md
reports/architecture/ARCH_DRIFT_REGISTER_V1.md

至少核验：
- apps 当前目录
- AppModule 实际 imports
- API modules
- FamilyModule providers
- Orchestration responsibilities
- Principal runtime
- ai-gateway
- principal-runtime
- program-runtime
- waf current wiring state
- shared contracts
- DB repositories/migrations
- mobile 35 UI registry
- Family API client methods
- mobile AsyncStorage state
- runtime status / test-loop surfaces
- Named Actions
- Product/Growth/Audit/Outbox event implementation state
- current authorization/provider policy
- stale/conflicting project status statements

对每项标记：
CURRENT_IMPLEMENTED
PARTIAL
TARGET_ONLY
TEST_LOOP_FIXTURE
LOCAL_DRAFT
STALE_DOC
BLOCKED
NOT_IMPLEMENTED

不要根据架构目标创建新模块。
不要移动代码。
不要 rename apps。
不要修改 ontology/action spec。
不要启用真实 provider。
不要执行下一 ARCH task。

完成后停止并报告。
```

---

# 22. 最终架构判定

Family 当前最需要的不是继续增加更多页面、Agent 或模型，而是收束为：

```text
UI → Projection
Projection → Domain Read Models
User Decision → Named Action
Named Action → Canonical Truth
Canonical Truth → Events
Events → Timeline / Analytics / Async Work
AI → Context Broker → Model Gateway → Structured Proposal → Human Confirm → Named Action
External Service → Adapter → Receipt
```

当这条链闭合后，35 个 UI 才真正成为同一个 Family Growth OS 的 35 个受控交互窗口。

最终目标：

> **一个业务真相中心，一个成长状态系统，一个受控 AI 层，一个统一消费者体验层，一套可审计 Named Action 与事件体系；页面薄、领域强、AI 可替换、数据有来源、决策可追溯、外部效果可管控。**
