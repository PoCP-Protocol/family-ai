# Family Trusted Context Capsule v1

```text
DOC_KIND = ARCHITECTURE_CONTRACT
CONTRACT = FamilyTrustedContextCapsule
VERSION = v1
STATUS = DRAFT_PROPOSED_FOR_REVIEW
RUNTIME_STATUS = DOCUMENT_ONLY
SCHEMA_STATUS = NO_NEW_SCHEMA
```

`STATUS` 表示本合同草案已由 V5-00 任务生成，**不表示授权登记已新增 V5-00 或 FTCC runtime 能力**。任何 runtime、pilot 或 production 授权仍只能来自 `governance/AUTHORIZATION_REGISTRY.yaml`。

## 1. 目的与定位

`FamilyTrustedContextCapsule`（以下简称 **FTCC**）是 Family 在向 AI、Agent、Provider、学校或其他受控组件提供上下文时使用的**最小、目的限定、收件人限定、可追溯的上下文契约**。

FTCC 解决的是“本次请求允许谁、基于什么目的、在什么时间范围内、以什么证据边界读取哪些上下文”的问题。它不是全局儿童档案，也不是跨角色共享的 super-profile。

FTCC **不是 canonical truth**，不取代 Family Core、Growth、Evidence、Consent、Service Case 或其他领域对象的权威记录。FTCC 只是对既有权威记录进行授权后的只读投影/引用集合；其中的快照过期、撤回或失效，不会反向改写 canonical truth。

本文件只定义 v1 架构与工程契约：

- 不新增数据库表、字段、枚举、迁移或持久化 schema；
- 不新增 runtime、API、Agent、Provider、学校连接或模型调用；
- 不授权任何新的业务能力、自动化决策或外部发送；
- 后续实现必须通过已批准的 Family API、Policy、Consent、Model Gateway、FamilyHarnessAdapter、Named Action 与 Audit 边界。

## 2. 不可违反的上位规则

1. `Perspective != Fact`，`Hypothesis != Fact`。
2. `Recommendation != Decision != Action`。
3. AI/Agent 只能读取获准上下文并产生解释、候选或 Proposal，不得直接写入 canonical state。
4. 核心状态变更只能通过批准的 Named Action。
5. 模型调用只能通过 Model Gateway；Provider 不得绕过 Family 控制面。
6. 高风险、未成年人安全、诊断倾向、危机、专业服务和外部效果承诺必须进入 Human Gate 或安全停止。
7. 任何未明确授权的字段、用途、主体、收件人、时间范围、来源或跨租户关系均按拒绝处理。
8. 不做 Family Total Score、家庭/儿童 Ranking 或固定儿童标签。

## 3. v1 最小结构

FTCC v1 的逻辑字段如下。字段名是契约术语，不表示本任务创建数据库 schema。

| 字段 | 必填 | 约束 |
| --- | ---: | --- |
| `context_id` | 是 | 单次 capsule 标识；不得作为 canonical 对象 ID 使用。 |
| `context_version` | 是 | 契约版本与内容版本；未知版本拒绝消费。 |
| `requester` | 是 | 发起主体、所属 trust zone、角色、认证/授权引用。 |
| `recipient` | 是 | 实际接收组件、组织/租户、角色和 trust zone；不得使用模糊的 `any_agent`/`any_provider`。 |
| `subject` | 是 | 本次上下文的家庭、人员/群体主体、关系范围和主体解析依据。 |
| `purpose` | 是 | 单一、可审计的业务目的；不得以“general assistance”替代具体目的。 |
| `use_case_refs` | 是 | 已注册的 component、use case、action 或 contract 引用；未知引用拒绝。 |
| `consent_snapshot` | 是 | consent 状态、purpose grant、policy 版本、主体/监护关系、取得/撤回时间和快照时间。 |
| `data_classification` | 是 | 每个上下文项的分类、敏感度、儿童/未成年人标记和最小化理由。 |
| `provenance` | 是 | 来源记录/事件引用、来源类型、时间、证据等级、推断/模拟/未验证标记和转换链。 |
| `allowed_fields` | 是 | 本收件人、本用途、本主体可读取的字段或字段组白名单。 |
| `forbidden_fields` | 是 | 明确禁止读取、推断、拼接、输出或转发的字段/字段组。 |
| `expiry` | 是 | `valid_from`、`expires_at`、撤回/失效条件和时钟依据；不得无限期有效。 |
| `risk_flags` | 是 | 安全、儿童、诊断倾向、危机、专业服务、外部发送、跨组织等风险标记。 |
| `human_gate` | 是 | `NOT_REQUIRED`、`REQUIRED`、`PENDING`、`APPROVED`、`REJECTED` 或 `EXPIRED`，含 gate 引用和适用范围。 |
| `trace_id` | 是 | 贯穿请求、策略判断、模型/Agent 运行、Proposal、人工审核和审计的关联标识。 |
| `lifecycle` | 是 | 当前状态、创建/签发者、更新时间、撤销原因和销毁/归档规则。 |

### 3.1 `requester` 与 `recipient`

`requester` 表示谁请求上下文；`recipient` 表示谁实际接收或可消费上下文。两者不可合并。代理请求不得隐藏真实委托方，Provider 也不得以平台泛身份代替具体组织、角色和授权范围。

允许的 recipient 类型在 v1 中固定为：

```text
PARENT
TEACHER
SCHOOL
PROVIDER
OPERATIONS
FAMILY_INTERNAL_COMPONENT
```

没有明确 recipient 的请求一律 fail-closed。

### 3.2 `subject`

`subject` 必须明确：

- `family_ref`；
- `subject_person_ref` 或明确的 family-level subject；
- requester 与 subject 的合法关系/授权依据；
- 可见关系范围（例如 parent-child、teacher-student、provider-case）；
- 是否包含儿童或其他未成年人；
- subject resolution 的 provenance。

不得通过 FTCC 暗中构建跨家庭、跨主体或全局儿童 super-profile。多主体请求必须逐一声明主体、必要性和各自字段边界；无法拆分时拒绝。

### 3.3 `purpose` 与 `use_case_refs`

一个 capsule 只服务一个已登记目的。目的必须能够映射到已批准的 component/use case contract，例如只读 FamilyNow 摘要、已授权的成长回顾、服务案例协作或操作审计。目的变更、收件人变更、主体变更或风险等级上升，必须重新签发 capsule，不得复用原 capsule。

`use_case_refs` 至少包含：

- `component_ref`：调用方所属 Family 组件或 adapter；
- `use_case_ref`：已批准的业务用例；
- `contract_ref`：输入/输出及权限契约；
- 如涉及动作，仅可引用 Proposal 或已批准 Named Action，不得把读取授权解释为写授权。

### 3.4 `consent_snapshot`

consent snapshot 是签发时的授权快照，不是新的 Consent 真相源。它必须记录：

- consent/permission 引用与 `policy_version`；
- grant 的主体、recipient、purpose、范围与状态；
- `captured_at`、`valid_from`、`revoked_at`（如有）；
- 监护人/组织授权依据（适用时）；
- 是否需要独立 Human Gate。

只要 Consent 被撤回、过期、冲突、无法解析，或 purpose/recipient/subject 不匹配，旧 capsule 立即不可消费。

### 3.5 `data_classification` 与 `provenance`

每个数据项必须带分类和来源，不得只在 capsule 顶层标注一个笼统敏感度。v1 至少区分：

```text
PUBLIC_OR_PRODUCT
FAMILY_INTERNAL
PERSONAL
MINOR_SENSITIVE
SAFETY_OR_HIGH_RISK
PROFESSIONAL_OR_CASE_RESTRICTED
OPERATIONS_RESTRICTED
```

`provenance` 必须区分事实、观点、假设、建议、行动、服务记录、人工审阅和系统推断。`simulated`、`inferred`、`unverified`、`unknown` 来源不得被表述为已验证事实，也不得单独支撑高风险结论、专业结论或 canonical 状态变更。

## 4. 允许字段与禁止字段

### 4.1 通用允许原则

`allowed_fields` 只能是白名单，且同时满足：

```text
purpose_allowed
AND recipient_allowed
AND subject_allowed
AND consent_granted
AND policy_allowed
AND provenance_sufficient
AND not_expired
AND human_gate_satisfied
```

允许字段应优先使用最小化的引用、摘要、时间范围和状态，而不是原始全文。收件人只获得完成该目的所必需的最小上下文。

### 4.2 通用禁止原则

除非存在另行批准的、独立的 contract 与 Human Gate，`forbidden_fields` 至少包括：

- 其他家庭、其他主体、其他租户或未授权关系的数据；
- 全局儿童档案、固定人格/能力标签、家庭总分、排名和跨家庭比较；
- 原始秘密、token、凭据、内部策略细节、数据库连接信息和 SQL；
- 未经 purpose 授权的原始聊天、音视频、附件或全文材料；
- 未成年人高敏感数据、危机细节、诊断/医疗结论和专业服务记录；
- 未经验证的推断被包装成事实的内容；
- Consent、Policy、Human Gate、Audit 或安全控制的绕过信息；
- 任何可直接执行写入、发送、预约、转介、收费或改变 canonical state 的凭据/工具参数。

`forbidden_fields` 优先级高于 `allowed_fields`。字段同时命中允许与禁止时，以禁止为准。

## 5. Recipient-specific boundaries

以下边界是独立的。一个 recipient 的授权不得继承给另一个 recipient；不得生成“所有角色通用 capsule”。

### 5.1 Parent

**可允许**：与该 parent 已授权关系范围内的家庭/子女受限摘要、已批准的成长回顾、事实/观点/假设的明确区分、已授权的建议与待确认 Proposal、相关 Consent 状态和必要的安全提示。

**禁止**：读取无关家庭成员或其他租户数据；查看 teacher/school/provider 的受限原始记录；把建议当作决定或行动；查看未通过 Human Gate 的高风险/专业结论；代替其他监护人或组织授权。

Parent recipient 仍不能直接修改 canonical truth；确认必须走既有 Named Action 和审计链。

### 5.2 Teacher

**可允许**：该 teacher 所属学校/班级与明确 student subject 范围内、为教育协作所必需的最小学习/参与/支持摘要；来源、时间和不确定性标记；已批准的课堂支持候选。

**禁止**：家庭内部隐私、parent 私密叙述、provider/clinical/case 记录、与教学目的无关的成长画像、儿童排名、诊断标签、跨班级/跨学校拼接以及直接联系家庭或修改 Family 状态。

Teacher 不能把 capsule 内容用于招生、纪律画像、评价排名或非教育目的。

### 5.3 School

**可允许**：学校 trust zone 内、经组织授权的聚合或最小化协作信息；明确学校责任范围内的 student/support workflow 状态；必要的时间、来源和责任人引用。

**禁止**：未经逐项授权读取家庭全量资料、provider 专业记录、其他学校数据、跨学校排名、广告/商业画像、未授权原始儿童内容或把聚合摘要反推为个体事实。

School recipient 必须绑定具体组织、purpose、数据处理责任和有效期；学校不能通过一个组织授权覆盖所有 teacher 或 provider。

### 5.4 Provider

**可允许**：与已授权 service case/relationship 直接相关的最小 context、明确的服务目标、必要的风险/安全路由、预约或交付所需的有限状态，以及 provenance 和 Human Gate 状态。

**禁止**：直接读取 Family 数据库或任意 API；获取全局儿童档案、无关家庭数据、原始隐私材料、其他 Provider 记录或未授权专业资料；自行诊断、改变 canonical state、自动转介、自动预约、自动外发或将数据用于自身训练/营销。

Provider 必须通过 Family-owned API/Adapter 和 purpose grant；任何专业判断、服务启动、外部发送或高风险处置都必须遵循独立 Human Gate 与服务责任契约。

### 5.5 Operations

**可允许**：为租户/系统运行、审计、安全、计费/服务运营所必需的元数据、状态、trace、错误、准入和队列信息；按最小必要原则访问已授权的运营投影。

**禁止**：出于好奇或分析便利读取家庭/儿童内容；将 operations 权限转换为业务决策权限；绕过 consent、subject、purpose、Human Gate 或 trust-zone 边界；使用运营访问直接修改 Family canonical truth。

Operations 的审计/支持访问必须有工单或 incident purpose、角色限制、时间限制和完整 trace；敏感原文默认不可见。

### 5.6 Family internal component

Family 内部组件只能消费其 component/use case contract 明确列出的字段。内部身份不等于无限权限；组件之间仍必须验证 recipient、purpose、subject、consent、policy、expiry 和 risk flags。FamilyHarnessAdapter、Model Gateway、Policy、Audit 等控制面不得被当作业务数据旁路。

## 6. Human Gate 与风险路由

以下任一情况出现时，capsule 必须标记 `human_gate = REQUIRED` 或进入安全停止：儿童/未成年人高敏感内容、危机或安全信号、诊断/医疗/专业结论、外部 Provider/学校交付、真人服务、自动发送/预约/转介、跨组织共享、Consent 不确定或风险标记无法解释。

`PENDING`、`REJECTED`、`EXPIRED` 或缺少 gate evidence 时：

- 不提供受限字段；
- 不执行动作、不调用外部服务、不发送通知；
- 只返回最小安全停止、澄清或人工审核入口；
- 保留 `trace_id` 和拒绝原因类别以便审计，但不泄露敏感内部规则。

Human Gate 只批准其声明的 subject、purpose、recipient、字段和有效期，不产生无限期或全局授权。

## 7. 生命周期

```text
REQUESTED
  → RESOLVING
  → ISSUED
  → CONSUMABLE
  → EXPIRED / REVOKED / SUPERSEDED / REJECTED
  → ARCHIVED_OR_DISPOSED
```

1. **REQUESTED**：收到带 requester、recipient、subject、purpose、use case 和 trace 的请求。
2. **RESOLVING**：校验身份、trust zone、关系、Consent snapshot、policy、provenance、risk 和字段白名单。
3. **ISSUED**：生成唯一 `context_id`、版本、expiry 和不可变签发记录；未通过校验不得签发。
4. **CONSUMABLE**：每次消费重新检查有效期、撤回、scope、recipient、purpose、policy 和 Human Gate；签发不等于永久通行。
5. **EXPIRED**：到达 `expires_at` 或关联授权失效后不可消费。
6. **REVOKED**：Consent 撤回、风险升级、主体/收件人变更、违规或人工撤销后立即停止。
7. **SUPERSEDED**：新版本替代旧版本；旧版本不得继续用于新请求。
8. **ARCHIVED_OR_DISPOSED**：按既有审计、隐私和保留规则处理；不得把 FTCC 作为新的事实存储。

任何生命周期状态冲突、时间不可信、版本未知或撤销状态无法读取，均按不可消费处理。

## 8. Fail-closed 规则

FTCC v1 的默认结果是拒绝，而不是尽可能返回。以下条件任一成立，必须 fail-closed：

- requester、recipient、subject、purpose、use case 或 trace 缺失/不明确；
- Consent snapshot 缺失、撤回、过期、冲突或与 purpose/recipient/subject 不匹配；
- `allowed_fields` 不是明确白名单，或字段同时命中禁止列表；
- provenance 缺失、来源未知、证据等级不足或内容无法区分 Fact/Perspective/Hypothesis；
- capsule 过期、被撤销、版本不支持、签名/完整性校验失败或重复使用超出约束；
- risk flags 无法解析，或 Human Gate 需要但未获得有效批准；
- 发生跨租户、跨家庭、跨 subject、跨 recipient 或跨 trust zone 的隐式拼接；
- 请求要求 direct DB、raw SQL、任意 provider endpoint、通用导出或 canonical mutation；
- 任何依赖的 Policy、Audit、Model Gateway、Adapter 或授权服务不可用且无法证明安全降级。

Fail-closed 不得通过空值伪装成功，不得猜测、不应自动扩大字段、不应切换到另一个 recipient，也不得把拒绝转换为模型自由文本结论。

## 9. 与 Agent、Provider、数据库和 canonical truth 的边界

```text
Family API / approved use case
  → Policy + Consent + Subject resolution
  → FTCC v1
  → FamilyHarnessAdapter / Model Gateway / approved recipient
  → read-only interpretation or Proposal
  → Human Gate / Named Action (when applicable)
  → Domain Service
  → canonical state
```

明确禁止：

```text
Agent → PostgreSQL
Provider → PostgreSQL
Agent → arbitrary Family API write
Provider → arbitrary Family API read
UI → Codex direct
Codex → SQL direct
FTCC → canonical truth replacement
```

FTCC 不能授予 DB 凭据、SQL 能力、任意工具权限或 canonical state 的写权。Agent/provider 的输出最多是受约束的解释、候选、Proposal 或 Human Gate 请求；只有既有批准的 Named Action 才能改变核心状态。

## 10. 一致性与验收清单

v1 合同在实现前必须能回答以下问题，否则不得进入下一 Gate：

- 是否明确了 requester 与 recipient 的区别？
- 是否明确了单一 purpose、subject、component/use case refs？
- 是否包含 consent snapshot、data classification、provenance、expiry、risk flags、human gate 和 trace id？
- 是否同时定义了 allowed 与 forbidden fields，并以禁止优先？
- 是否为 parent、teacher、school、provider、operations 分别定义边界？
- 是否明确 FTCC 不是 canonical truth，且不形成 global child super-profile？
- 是否明确 Agent/Provider 不得直连 DB、不得绕过 Family API/Adapter、不得直接写 canonical state？
- 是否规定生命周期、撤回、过期、版本替代和 fail-closed？
- 是否保持“本文件不新增 schema/runtime”的范围？

本文件通过上述文档自检只表示**契约内部一致**，不表示 runtime 已实现、生产已启用、外部 Provider 已接入或任何新的业务授权已经生效。
