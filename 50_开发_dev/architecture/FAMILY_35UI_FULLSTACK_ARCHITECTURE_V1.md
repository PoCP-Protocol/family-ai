# FAMILY 35 UI Full-Stack Architecture V1

```text
DOC_KIND       = FULLSTACK_ARCHITECTURE
PRODUCT_BASE   = UI-01..UI-35
BASE_REPO      = PoCP-Protocol/family-ai
BASE_BRANCH    = main
BASE_SHA       = 708cf542ab130642f2248bbebecc997930d10a49
ARCH_RULE      = UI -> Journey -> Capability -> Domain -> Runtime
AI_DIAGNOSIS   = KEEP
```

## 1. 最高原则

35 个 UI 是消费端展示与能力范围基线。后端必须完整实现这些页面所承诺的能力和六大业务循环；禁止用本地假数据、页面 if/else、第二数据库或 Mobile 直连模型来“补齐”后端缺口。

**但 UI 不拥有业务真相。**

- UI 可以拥有 Projection / View State。
- Canonical Write 只能由 Domain Named Action 完成。
- AI 只能生成理解、假设、解释、候选建议；不能直接写 Growth canonical truth。
- `Perspective != Fact`
- `Hypothesis != Fact`
- `Recommendation != Decision != Action`
- `ServiceCompletion != GrowthOutcome`

机器可读的 35 页契约唯一来源：`governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json`。

## 2. 七个后端领域

### FAMILY_CORE
Account / Person / Family / Relationship / Role / Consent / Visibility。

### GROWTH_INTELLIGENCE
Assessment / Situation Understanding / **AI诊断** / GrowthDiagnosticHypothesis / GrowthNeedSignal / Report Interpretation。

### GROWTH_JOURNEY
Program / Stage / GrowthPlan / GrowthAction / DailyTask / CheckIn / Reflection / Review / Milestone。

21 天、90 天和未来的各种成长计划必须共享 Program Runtime，不得每个页面建一套模型。

### RESOURCE_COMMERCE
ResourceOffer / ProductOffering / Membership / Subscription / Entitlement / Benefit / OrderIntent / Asset / Points / Invitation。

商业链服从成长链；平台收入不得进入 Growth Fiduciary 排序信号。

### SERVICE_OS
Provider / Expert / ServiceOffering / Availability / BookingRequest / ServiceCase / Assignment / Delivery / FollowUp / Feedback / Recovery / SLA。

### CONTENT_COMMUNITY
ContentItem / FamilyNote / CommunityPost / Bookmark / Follow / CommentPerspective / Moderation / Visibility。

家庭内容默认 Private First。

### FAMILY_CONTEXT
跨域只读上下文与时间线：发生了什么、家庭如何表达、系统如何理解、做了什么、服务是否发生、家庭如何反馈。它不是一张“大一统画像表”。

## 3. 读取与写入分离

### Query / Projection
前端可以有 35 个页面投影，但不允许 35 套业务 Domain。

```text
UI -> Projection API -> Domain read models
```

典型：
- UI-01 -> FamilyHomeProjection
- UI-03 -> GrowthDiagnosisProjection
- UI-09 -> TodayTaskProjection
- UI-31 -> MyServicesProjection
- UI-33 -> FamilyProfileProjection

### Command / Named Action

```text
UI interaction
  -> authenticated command
  -> consent / authorization / idempotency
  -> Domain Named Action
  -> canonical DB write
  -> audit/event
  -> projection refresh
```

禁止“页面按钮直接 update table”。

## 4. AI Control Plane

所有模型能力，包括 AI诊断、测评解释、成长报告、计划草稿、私有小记标签、专家路由、内容推荐，统一：

```text
Mobile/Web
  -> Family API
  -> use-case authorization
  -> consent
  -> ContextAssembler
  -> FamilyLlmGateway
  -> Model Router
  -> structured output
  -> Output Validator
  -> Audit/Replay
  -> Draft / Hypothesis / Recommendation
  -> Family/Human confirmation when required
```

`apps/mobile -> model provider` 永久禁止。

AI诊断保留为产品能力；内部语义必须是 `GrowthDiagnosticHypothesis` / interpretive artifact，不是医疗或精神科诊断，也不是 Child Fact。

## 5. 六大循环

### 评估循环
UI-07 -> UI-02 -> Assessment Evidence -> UI-03 AI诊断 -> UI-08 Report -> confirmed GrowthIntent。

### 成长/计划循环
UI-03 -> UI-04 / UI-35 -> UI-09 -> UI-11 -> UI-08 / UI-29 -> next action。

### 服务循环
UI-03 / UI-01 -> UI-19 -> UI-20 -> UI-21 -> ServiceCase -> UI-24 / UI-31 -> UI-34 -> FollowUp。

### 商业循环
UI-13 -> UI-14 -> OrderIntent -> Entitlement -> UI-18 / UI-30 -> UI-32 -> eligible Service/Program。

### 社区循环
UI-25 -> UI-26 -> Private Draft -> Moderation -> UI-27 / UI-28 -> context readback。

### 家庭连续性循环
所有循环 -> Family Growth Context -> 下一次 AI诊断 / 推荐 / 服务更准确。

## 6. 前后端一致性的验收标准

每个 UI 必须同时具备：
1. Mobile route。
2. 明确 Projection。
3. Domain Owner。
4. Named Action 边界。
5. 认证/Consent/Visibility。
6. AI use case 若存在只能走 FamilyLlmGateway。
7. Canonical write 的数据库 owner。
8. Unit/Integration/E2E。
9. 文档状态不得高于代码状态。

**页面能点不等于后台完成。DEV no-op / fixture / local draft 必须明确标记。**

## 7. 开发顺序

- G0 Alignment Foundation：35UI matrix、contracts、validator、治理。
- G1 Family Core + Context：UI-01/UI-33 + 全局 auth/consent/context。
- G2 Assessment + AI诊断：UI-02/03/07/08。
- G3 Growth Journey：UI-04/05/09/10/11/12/29/35。
- G4 Resource + Commerce：UI-06/13-18/30/32。
- G5 Service OS：UI-19-24/31/34。
- G6 Content + Community：UI-25-28。
- G7 Cross-loop E2E：六循环真实 PostgreSQL、真实 API、Mobile runtime，清零 synthetic capability gaps。

最终 Gate：
`FAMILY_35UI_FULLSTACK_V1_READY`
