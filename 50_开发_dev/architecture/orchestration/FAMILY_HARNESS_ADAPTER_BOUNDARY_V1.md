# FamilyHarnessAdapter 边界合同 V1

```text
DOC_KIND = ARCHITECTURE_CONTRACT
STATUS   = DRAFT_PROPOSED_FOR_REVIEW
SCOPE    = Family API → AI Use Case → Trusted Context → Adapter → Codex App Server
WRITE_MODE = PROPOSAL_ONLY
CANONICAL_STATE_OWNER = Family Domain Services + Named Actions
```

本文件是 V5-00 产出的边界草案，不构成 `AUTHORIZATION_REGISTRY.yaml` 中的新增授权，也不代表 Codex、Harness 或 Agent runtime 已开放。

## 1. 合同目的

本合同定义 Family 自有业务控制面与 Codex App Server 执行运行时之间的唯一边界。它只定义边界、输入输出、工具权限、审批恢复、审计追踪、失败和回滚语义；不实现代码，不修改外部 Codex，不新增数据库、运行时服务或生产 AI 自主能力。

FamilyHarnessAdapter 是 Family-owned adapter。Codex App Server 是可替换的内部执行后端，不是 Family 的业务系统记录源，也不是面向终端用户的公共 API。

## 2. 唯一允许的调用拓扑

```text
Family UI / Family Experience
        │
        ▼
Family API
        │  身份、租户、Family scope、请求幂等、correlation_id
        ▼
AI Use Case
        │  use-case registry、schema、模型策略、风险和 Human Gate 要求
        ▼
Trusted Context Broker
        │  purpose、subject、recipient、consent、policy、最小必要上下文
        ▼
FamilyHarnessAdapter
        │  工具白名单、能力约束、proposal-only、trace、approval/resume
        ▼
Codex App Server
        │  Thread / Turn / Event / Tool / MCP / Approval / Resume
        ▼
FamilyHarnessAdapter
        │  事件归一化、输出校验、拒绝越权结果
        ▼
AI Use Case → Family API
```

Codex App Server 只能通过 FamilyHarnessAdapter 被调用。任何客户端、UI、外部集成或业务模块不得直接调用 Codex App Server。

## 3. 边界所有权

### 3.1 Family 负责并始终拥有

- Family API、认证、租户和 Family subject scope。
- AI Use Case Registry、输入输出 schema、允许的模型类别和 provider policy。
- Trusted Context、Consent、Purpose、数据分类、最小必要原则和过期策略。
- Family domain tools、工具白名单、policy enforcement 和 Human Gate。
- Family Ontology、canonical state、Named Action、领域服务和业务事件。
- Proposal、Decision、Action、Outcome 的语义区分。
- AI run ledger、audit、trace、retention、eval 和 rollback policy。

### 3.2 Codex App Server 仅负责

- 受控 Thread、Turn、Event 流和执行生命周期。
- 在 FamilyHarnessAdapter 提供的能力范围内执行已授权工具。
- Approval、Resume、Interrupt 和内部多步骤编排的运行时机制。
- 不拥有 Family 业务语义、Family canonical state、Consent 决策或 policy 的最终解释权。

Codex 的事件、线程、工具调用和运行状态可以作为执行证据，但不能自动成为 Family 业务事实。

## 4. AI Use Case 到 Adapter 的输入合同

每次 adapter invocation 必须来自已注册并已授权的 AI Use Case，并携带以下最小元数据：

```text
request_id
correlation_id
trace_id
use_case_id
use_case_version
actor_id
requester
recipient
family_id
subject_person_id
purpose
consent_snapshot_ref
policy_version
trusted_context_id
trusted_context_version
allowed_tools
human_gate_requirement
idempotency_key
requested_at
expires_at
```

约束：

1. `family_id`、`subject_person_id`、`requester` 和 `recipient` 必须由 Family 服务端解析，不能信任 UI 或模型自由填写的范围。
2. `trusted_context_id` 必须对应有效、未过期、purpose-limited 的 Trusted Context；不得向 Codex 传递全局家庭档案或未裁剪的数据库连接能力。
3. `allowed_tools` 必须是注册白名单的子集，并由 adapter 在每次调用前重新校验。
4. Use Case 的 `may_mutate_business_state` 必须为 `false`；任何写意图都只能产生 Proposal 或 Human Review 请求。
5. Consent、policy、subject、purpose、recipient 或过期校验失败时，adapter 必须 fail closed。

## 5. Adapter 到 Codex 的输出合同

Adapter 向 Codex 发送的是受约束的执行请求，而不是 Family 数据库访问凭据。请求至少包含：

```text
backend = codex_app_server
thread_context
turn_input
trusted_context_projection
allowed_tools
output_schema
approval_policy
resume_policy
trace_context
```

Adapter 必须剥离或拒绝：

- SQL、数据库连接串、数据库凭据、内部表结构和任意 ORM/查询执行能力。
- 未经 Trusted Context 授权的家庭成员、儿童、学校、提供方或运营数据。
- 可直接改变 canonical state 的命令、内部 domain service 注入或任意 HTTP callback。
- 可绕过 Model Gateway、Consent、Policy、Safety 或 Human Gate 的 provider/tool 配置。

Codex 返回的文本、结构化输出、tool event 或 agent message 都是候选产物，必须经过 adapter 和 Family Intelligence Runtime 的 schema、policy、安全、provenance 与 trace 校验后，才能返回 Family API。

## 6. 允许的只读工具

工具必须是 Family-owned domain tool，并绑定 Trusted Context、purpose、subject、policy 和 trace。只读工具不得返回超出最小必要范围的数据。

| 工具 | 权限 | 语义与约束 |
|---|---|---|
| `get_family_context` | READ_ONLY | 返回当前请求 purpose 所需的最小家庭上下文；不返回全量档案。 |
| `get_family_now` | READ_ONLY | 返回聚合当前态 read model；不是 canonical truth，不产生总分、排名或固定儿童标签。 |
| `get_growth_episode` | READ_ONLY | 读取指定 subject scope 内的 GrowthEpisode、阶段和可见记录。 |
| `search_interventions` | READ_ONLY | 在已授权的 Intervention Library 中检索候选；不执行、不采用推荐。 |
| `get_intervention` | READ_ONLY | 读取已授权干预的版本、证据、适用范围和风险信息。 |
| `get_family_perspectives` | READ_ONLY | 读取带角色、时间、来源和 provenance 的 perspectives；不得升级为 fact。 |
| `get_recent_actions` | READ_ONLY | 读取已确认的 Named Action 及其状态；不得由读取结果推断 outcome。 |
| `get_service_options` | READ_ONLY | 读取 purpose 和 trust zone 允许的服务选项；不创建预约、订单或服务承诺。 |

只读工具也必须经过 policy/context 检查；“只读”不等于可以绕过 Consent、Purpose、Subject Isolation 或 audit。

### 6.1 明确禁止的工具形状

```text
execute_sql
query_database
update_table
insert_row
delete_row
write_growth_profile
write_family_context
mutate_core_ontology
generic_patch_core_object
set_child_score
set_family_rank
publish_unreviewed_clinical_claim
call_provider_directly
bypass_model_gateway
bypass_consent
bypass_policy
```

不得通过 MCP、Skill、环境变量、文件系统、shell、插件或隐藏 callback 重新获得上述能力。

## 7. Proposal-only 写路径

Agent 产生的任何行动性结果都必须被归类为 Draft、Hypothesis、Recommendation、Proposal 或 Human Review Request。它们不是 Decision、Action、Outcome，也不是 canonical state。

```text
Agent / Codex
    ↓
Proposal
    ↓
Schema + provenance + safety + policy validation
    ↓
Policy decision and/or Human Gate
    ↓
Explicit confirmation
    ↓
Named Action
    ↓
Family Domain Service
    ↓
Canonical state / PostgreSQL
    ↓
Audit + domain event + outcome tracking
```

规则：

1. `propose_growth_action` 只能创建带 `proposal_id`、来源、版本、适用 subject、过期时间和风险标记的 Proposal。
2. `create_support_case_draft` 只能创建服务案例草稿；不得创建已生效的 Case、Booking、SLA 或通知。
3. `request_human_review` 只能发起 review 请求；不能替代审批，也不能自动执行被审查事项。
4. Named Action 只能由 Family API/领域服务在 policy 和 consent 通过、且需要时完成人类确认后执行。
5. Agent、Codex、MCP、Skill 和模型输出均不得直接写入 canonical Ontology、GrowthProfile、Family Core、Consent、Membership、Service Case 或 Outcome。
6. 禁止 generic PATCH 核心对象；核心状态只能通过已批准的 Named Action 改变。

## 8. Model Gateway、Consent、Policy 与安全门

FamilyHarnessAdapter 不是 Model Gateway 的替代品，也不是 Consent 或 Policy 的旁路。

- 需要模型调用时，必须由 Family Intelligence Runtime 通过 Model Gateway 选择和调用模型；Codex 不能直接绑定或调用 provider。
- 每次上下文读取、Proposal 生成和 Human Review 请求都必须校验 Consent snapshot、Purpose Grant、subject scope、recipient visibility、数据分类、retention 和 policy version。
- 高风险家庭场景必须进入 Human Gate；adapter 不得把 Codex 的“完成”事件解释为批准。
- 安全拒绝、敏感数据超范围、未成年人高风险信号、clinical claim 或 policy 不确定性都必须 fail closed，并转入既定人工/安全路由。
- 任何 fallback、retry 或 resume 都不得扩大工具、上下文、provider、recipient 或 consent 范围。

## 9. Approval / Resume 语义

### 9.1 Approval

Approval 是一个显式、可审计的门，不是模型或 Codex 的自我授权。Approval request 至少包含：

```text
approval_id
proposal_id
request_id
subject_person_id
purpose
requested_operation
risk_level
impact_summary
provenance_refs
policy_version
consent_snapshot_ref
expires_at
required_approver_role
```

Approval 的结果只能是 `APPROVED`、`REJECTED`、`EXPIRED` 或 `CANCELLED`。批准必须绑定 proposal 内容摘要/hash、subject、purpose、policy version 和 idempotency key；proposal 被修改后原批准自动失效。

### 9.2 Resume

Resume 只能恢复同一 `request_id` / `thread_id` / `turn_id` 对应的、尚未过期且未撤销的执行。恢复前必须重新验证：

- Trusted Context 是否仍有效；
- Consent、Purpose、recipient 和 policy 是否仍有效；
- approval 是否仍匹配 proposal hash；
- allowed tools 是否未扩大；
- idempotency key 是否未被成功消费；
- 风险级别是否发生升级。

任何验证失败都不得 resume 原执行，应生成可审计的拒绝/过期结果并要求重新发起。

## 10. Audit、Trace 与 Provenance

每次 invocation、tool call、proposal、approval、resume、denial、failure、rollback 和最终 Named Action 都必须形成关联审计记录。最小字段包括：

```text
trace_id
correlation_id
request_id
thread_id
turn_id
event_id
actor_type
actor_id
use_case_id
trusted_context_id
family_id
subject_person_id
purpose
recipient
consent_snapshot_ref
policy_version
tool_name
tool_input_hash
tool_output_hash
proposal_id
approval_id
idempotency_key
status
reason_code
created_at
```

审计必须记录拒绝和失败，不得只记录成功路径。原始敏感文本是否保留由 Consent 和 Retention Policy 决定；hash、引用和元数据不得被当作事实内容本身。Codex event log 只能作为执行证据，必须与 Family trace 关联后才可用于诊断。

## 11. Failure semantics

Adapter 对以下情况采用 fail-closed：

- 未注册的 Use Case、工具、Skill、provider 或 output schema；
- Trusted Context 缺失、过期、版本不匹配或 scope 不足；
- Consent、Purpose、Policy、Human Gate 或 subject isolation 校验失败；
- Codex 返回未知事件、越权 tool call、未校验输出或不符合 schema 的 Proposal；
- 任何 direct SQL、canonical mutation、provider direct call 或边界绕过企图；
- trace、correlation、idempotency 或审计字段缺失；
- backend 超时、断连、重复事件、未知状态或无法判断是否执行成功。

错误结果必须稳定、可分类且不泄漏敏感数据。建议错误类别：

```text
DENIED_POLICY
DENIED_CONSENT
DENIED_SCOPE
DENIED_TOOL
DENIED_RISK
INVALID_CONTEXT
INVALID_OUTPUT
APPROVAL_REQUIRED
APPROVAL_EXPIRED
RESUME_INVALID
BACKEND_TIMEOUT
BACKEND_UNAVAILABLE
DUPLICATE_REQUEST
UNKNOWN_EXECUTION_STATE
```

Backend 的“成功”只表示 Codex 执行层完成，不表示 Proposal 被批准、Named Action 已执行或 Growth Outcome 已发生。只有 Domain Service 的成功 Named Action 和后续事实/Outcome 记录，才能改变相应业务状态。

## 12. 重试、幂等与 rollback

- Adapter 请求必须携带 `idempotency_key`；相同 key、相同 proposal hash 和相同 scope 的重复请求必须返回已有结果或安全的 duplicate 状态。
- 对未知执行状态不得盲目重放可能产生副作用的操作；先查询 Family audit/approval 状态，必要时进入人工核对。
- 只读调用可以在相同授权范围内按 policy 重试；重试不得延长 Trusted Context 或 Consent 的有效期。
- Proposal 生成可以丢弃、过期或撤销，不需要回滚 canonical state，因为 Proposal 不拥有 canonical mutation 权限。
- Named Action 的回滚由 Family Domain Service 的既有补偿/撤销 Named Action 定义；Codex、adapter 或人工不得直接反写数据库。
- 禁用 adapter 或撤销 backend 时，应停止新 invocation，保留已完成 audit，允许已授权的人工收尾路径继续，不删除历史 Proposal、Approval、Action 或 Outcome。

## 13. 明确禁止的架构路径

以下路径在 V5-00 永久禁止：

```text
UI → Codex App Server
UI → raw tool / MCP
Codex App Server → SQL / PostgreSQL
Codex App Server → Family canonical state
Agent → generic PATCH
Agent → Named Action without policy/consent/approval gate
Agent → direct model provider
Agent → direct ontology platform
Codex event = Family fact
Proposal = Decision
Decision = Action
Service completion = Growth outcome
```

禁止通过“内部”“开发环境”“测试工具”“临时脚本”“MCP server”“Skill”或“admin bypass”弱化这些边界；测试替身也必须保持相同的拒绝语义。

## 14. 验收与回滚姿态

本合同的验收重点是静态边界和可验证语义：

- 调用拓扑中不存在 UI-to-Codex 直连；
- adapter 只接受有效 Trusted Context 和已注册 Use Case；
- 只读工具白名单完整，未知/危险工具 fail closed；
- 所有写意图只能产生 Proposal 或 Human Review Request；
- Codex 无 SQL、数据库凭据或 canonical mutation 能力；
- approval/resume 绑定 proposal hash、scope、policy 和幂等键；
- denial、timeout、unknown state 和 rollback 均可审计；
- Model Gateway、Consent、Policy、Safety 和 Human Gate 不可绕过。

若本边界合同被撤销或发现不安全实现，回滚动作是移除/禁用 adapter contract 与 mock harness path，恢复现有 Family API boundary；不得回滚或删除 Family canonical data，不得把 Codex 的历史执行日志当作业务事实恢复。

## 15. 本合同非目标

- 不实现 FamilyHarnessAdapter、Codex client、MCP server 或任何 runtime。
- 不新增 DB schema、migration、queue、service、deployment 或 production flag。
- 不修改外部 Codex App Server 或其源码、协议和运行时实现。
- 不创建通用自主 Agent、多 Agent 生产编排或高风险自动化。
- 不定义新的 Family 核心对象、状态、总分、排名或固定儿童标签。
