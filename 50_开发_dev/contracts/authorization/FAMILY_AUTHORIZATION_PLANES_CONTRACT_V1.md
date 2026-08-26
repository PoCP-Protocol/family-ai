# Family Authorization Planes Contract V1

- **Contract:** `FAMILY_AUTHORIZATION_PLANES_CONTRACT_V1`
- **Task:** `V5-02 Authorization Planes`
- **Status:** `CONTRACT_ONLY_PROPOSED_FOR_REVIEW`
- **Owner:** Family Architecture / Privacy & Minor Safety Review
- **Version:** V1
- **Effective:** Proposed only; not effective until written architecture, privacy and minor-safety approval

> 本文件是 V5-02 的 authorization planes 合同提案。它只定义可审阅的 trust zone、Purpose Grant、最小可见性、拒绝语义、审计和回滚边界。
>
> 本文件**不授权** IAM、API、DB、migration、runtime middleware、token 服务、学校接入、Provider 接入、Agent 接入、生产访问控制或任何新的业务能力。未经书面批准，不得把本文解释为已登记或可调用的授权策略。

## 1. 目的与不可变原则

本合同为 Family、School、Partner、Operations 之间建立显式、目的限定、主体限定、收件人限定且可撤回的授权平面。授权平面用于约束“谁在什么目的下，针对哪个 subject，在什么范围和有效期内，能够看到哪些最小上下文”。

以下原则不可被后续实现弱化：

1. `trust zone` 是信任与数据可见性边界，不是业务 ownership、租户 ownership、订单 ownership、case ownership 或 canonical domain ownership。
2. `Family` 是家庭领域的长期业务根对象和主要数据责任边界；其他 trust zone 不因组织身份而获得 Family 数据的默认可见权。
3. `actor/role`、`subject`、`recipient`、`purpose`、`scope` 和 `consent` 必须分别表达和校验，不得合并为一个 `user_id`、组织身份或角色字符串。
4. 客户端提供的 subject、family、tenant、scope 或 role 只能是候选输入；最终边界必须由受控的 Family-owned policy/context boundary 解析。
5. 缺少身份、关系、目的、同意、范围、有效期、撤回状态、人工门或审计证据时，默认 `DENY`（fail-closed）。
6. `Perspective != Fact`、`Hypothesis != Fact`、`Recommendation != Decision != Action`；授权读权限不等于写权限、决策权限或行动权限。
7. 不创建 Family Total Score、家庭/儿童 Ranking、跨家庭比较或 global child super-profile。
8. Provider 与 Agent 不得直连数据库，不得绕过 Family-owned API/Adapter、Policy、Consent、Model Gateway、Named Action 和 Audit 边界。

## 2. Trust zones

### 2.1 四类 trust zone

| Trust zone | 语义 | 默认可见性边界 | 不代表 |
| --- | --- | --- | --- |
| `FAMILY` | 家庭成员及 Family-owned 产品/控制面的家庭内信任区 | 单一明确 Family scope；按 subject、关系、purpose 和 consent 最小化 | 所有家庭成员、所有儿童、所有历史记录或无限写权 |
| `SCHOOL` | 经组织授权的学校、教师和教育支持工作信任区 | 明确学校、责任范围、assigned subject 和教育 purpose | 全校儿童默认可见、家庭私密资料或专业记录 |
| `PARTNER` | 经批准的 Provider/服务合作方及其受控服务关系信任区 | 明确 provider、service case/relationship、subject 和服务 purpose | 任意 Family 数据、其他 case、其他 Provider 记录或训练/营销数据 |
| `OPERATIONS` | 受控的平台运营、安全、审计和支持工作信任区 | 明确 operation case/incident/purpose；最小运营元数据和必要投影 | 全局管理员、业务决策权、全量儿童档案或绕过 consent 的权力 |

### 2.2 Trust zone 的非 ownership 声明

- `FAMILY` trust zone 不把学校、Provider 或 Operations 变成家庭业务对象的 owner。
- `SCHOOL` trust zone 不拥有 Family、Child、Consent 或家庭原始内容；学校仅在明确责任范围内获得最小协作视图。
- `PARTNER` trust zone 不拥有 Family canonical truth、服务对象的全部历史或其他 Provider 的资料。
- `OPERATIONS` trust zone 负责受控的平台运行、审计和安全工作，不因运营身份获得 Family 业务数据的任意使用权。
- Trust zone 不能替代既有 tenant、membership、relationship、service case、data stewardship 或 domain ownership 语义；如两者冲突，必须拒绝并另行评审，不得自动放宽权限。

## 3. Authorization request / Purpose Grant 最小结构

以下是逻辑合同字段，不是本任务新增的 API、数据库 schema、token schema 或 runtime 类型。

```text
purpose_grant = {
  grant_id:          immutable proposal/reference,
  actor:             verified initiating identity,
  role:              effective role within the declared trust zone,
  trust_zone:        FAMILY | SCHOOL | PARTNER | OPERATIONS,
  subject:           explicitly enumerated Family/person/case/operation subject,
  recipient:         actual consuming person, organization, component or adapter,
  purpose:           one declared, registered and time-bounded business purpose,
  scope:             one tenant/family boundary plus subject and field allowlist,
  consent_snapshot:  consent state, policy version, relationship and capture time,
  expiry:            valid_from, expires_at and clock/reference semantics,
  revocation:        current status, source, effective time and reason category,
  human_gate:        applicability, status, approver/reference and expiry,
  audit:             correlation/trace, decision inputs, issuer, timestamps,
  decision:          ALLOW | DENY | PENDING_HUMAN_GATE | EXPIRED | REVOKED
}
```

### 3.1 字段约束

| 字段 | 必须满足 |
| --- | --- |
| `actor/role` | `actor` 必须是已验证身份；`role` 必须是该 actor 在指定 trust zone 内、具有有效期和来源的有效角色。角色本身不授予全局权限。 |
| `subject` | 必须显式列出 Family、person、child、service case 或 operation case；不得使用 `all_children`、`all_families`、通配符或隐式当前用户。 |
| `recipient` | 必须明确实际接收者、组织/组件、角色和 trust zone；不得使用 `any_agent`、`any_provider` 或平台泛身份。actor 与 recipient 不得混淆。 |
| `purpose` | 一个 grant 只服务一个具体、最小化、可审计、已批准的目的；`AI`、`analytics`、`operations` 或 `general assistance` 不能单独构成目的。目的改变必须重新申请。 |
| `scope` | 必须包含单一 tenant（如适用）、单一 Family 边界、显式 subject、允许字段/数据分类、必要 relationship 或 case 范围；scope 不能由客户端最终决定。 |
| `consent_snapshot` | 必须记录 consent/permission 引用、主体、recipient、purpose、范围、policy 版本、状态、取得/撤回时间、监护或组织授权依据（适用时）和快照时间。它是签发时快照，不替代 Consent 真相源。 |
| `expiry` | 必须有 `valid_from`、`expires_at`、时钟依据和失效条件；不得无限期有效。每次消费都必须重新检查有效期。 |
| `revocation` | 必须支持 Consent 撤回、purpose/recipient/subject 变更、风险升级、违规、人工撤销和依赖不可用等失效原因；撤回后立即停止消费。 |
| `human_gate` | 必须说明是否需要人工门、当前状态、批准范围、批准人/引用和有效期。`PENDING`、`REJECTED`、`EXPIRED` 或缺 evidence 时不得提供受限上下文或执行外部效果。 |
| `audit` | 必须记录 decision 的输入摘要、actor、recipient、subject、purpose、scope、consent snapshot、policy 版本、时间、correlation/trace、issuer 和拒绝/撤回原因类别；不得记录或泄漏不必要的敏感原文。 |
| `decision` | 只能是合同定义的明确结果；未知、冲突、超时、解析歧义或授权服务不可用不得降级为允许。 |

### 3.2 Decision precedence

按以下顺序处理，任何高优先级拒绝条件都覆盖低优先级允许条件：

1. `DENY`：身份、trust zone、actor/role、subject、recipient、purpose、scope、consent、expiry、revocation、human gate 或 audit 任一缺失、冲突、越界或无法证明。
2. `REVOKED` / `EXPIRED`：关联 consent、case、role、purpose、scope 或 grant 已撤回或过期。
3. `PENDING_HUMAN_GATE`：需要人工门但尚未获得有效批准；不得以“只读”“内部”“AI”绕过。
4. `ALLOW`：仅在全部边界一致、字段白名单最小化、purpose 适用、consent 有效、未过期且人工门满足时成立。

## 4. Family owner 与最小可见性

### 4.1 Family owner 原则

`Family` 是家庭业务关系、成员关系、家庭 consent 语义和 Family canonical context 的长期业务根对象。Family owner 的具体 IAM/API/DB 实现不在本合同范围内；本合同只声明以下授权原则：

- Family-owned policy/context boundary 负责解析和限制跨 trust zone 的受控上下文。
- School、Partner、Operations 只能获得由 Family scope、purpose、relationship/case、consent、policy、expiry 和 human gate 共同限定的最小投影。
- Family owner 不能通过一个宽泛 grant 代替每个 recipient、subject、purpose 和有效期的独立约束。
- Family owner 的授权也不产生 Provider/Agent 的数据库凭据、任意 API 权限或 canonical state 写权限。

### 4.2 School 最小可见性

**允许：** 明确学校组织、已分配的 student/subject、教育协作 purpose 所必需的最小学习/参与/支持摘要，及必要的来源、时间、不确定性和责任人引用。

**禁止：** 家庭私密叙述、无关家庭成员、Provider/clinical/case 记录、诊断标签、儿童排名、跨班级/跨学校拼接、招生/营销/纪律画像、未授权原始聊天、音视频、附件或全文。

学校组织身份不能覆盖所有教师；教师必须另有有效角色、assignment、subject 和 purpose。

### 4.3 Partner 最小可见性

**允许：** 与明确 Provider/service case/relationship 直接相关的最小 context、服务目标、必要风险/安全路由、有限交付状态、provenance 和 human gate 状态。

**禁止：** 任意 Family 数据库或任意 API、全局儿童档案、无关家庭数据、其他 case/Provider 记录、未授权专业资料、自行诊断、改变 canonical state、自动转介/预约/外发，以及将数据用于自身训练或营销。

Partner 必须通过 Family-owned API/Adapter 和有效 Purpose Grant；本合同不授权任何实际 Partner 接入。

### 4.4 Operations 最小可见性

**允许：** 为运行、审计、安全、准入、队列、错误、计费/服务运营所必需的最小元数据、状态、trace 和受控运营投影；访问必须绑定工单、incident 或明确 operation purpose。

**禁止：** 出于好奇或分析便利读取家庭/儿童原始内容、将运营权限转换为业务决策权限、绕过 consent/subject/purpose/human gate、导出全租户儿童画像，或直接修改 Family canonical truth。

Operations 访问必须有角色限制、时间限制、完整 trace 和可审计原因；敏感原文默认不可见。

## 5. Agent、Provider 与数据库边界

以下边界是本合同的硬约束，不是实现授权：

```text
Family-owned boundary
  → resolve actor / role / subject / recipient / purpose
  → verify consent / policy / expiry / revocation / human gate
  → issue minimum read context or decision
  → approved API / Adapter / Model Gateway / Harness boundary
  → read-only interpretation or Proposal
  → Human Gate / approved Named Action when applicable
  → Domain Service / canonical state
```

明确禁止：

```text
Agent    → PostgreSQL / SQL / database credentials
Provider → PostgreSQL / SQL / arbitrary database credentials
Agent    → arbitrary Family API write
Provider → arbitrary Family API read or write
Agent    → bypass Policy / Consent / Subject resolution
Provider → bypass Family-owned API / Adapter / Service Case
```

Agent 或 Provider 的输出最多是受约束的解释、候选、Proposal 或 Human Gate 请求。只有既有、单独批准的 Named Action 才能改变核心状态；本合同不授权任何 Named Action、API、DB、migration、runtime 或外部接入。

## 6. 允许 / 拒绝矩阵

以下矩阵是合同验收示例，不是现有 runtime、IAM、API 或生产行为声明。

| # | 请求场景 | 必要边界 | 结果 |
| --- | --- | --- | --- |
| A1 | Family 中已验证 Parent 查看 Child-A 的已授权成长摘要 | `FAMILY`；明确 actor/role、单 Family、单 subject、purpose、有效 consent、最小字段、未过期 | `ALLOW`（最小范围） |
| A2 | Parent 同时查看 Child-A、Child-B 的同一 purpose | 两个 subject 必须逐一显式列出并逐一验证；结果保持儿童隔离 | `ALLOW`（分隔返回，不得合并 profile） |
| A3 | Parent 请求“我的家庭所有儿童”，但未列出 subject | Family scope 不能替代显式 subject 枚举 | `DENY` |
| A4 | Parent 访问 Child-A，但 purpose 缺失、过宽或已过期 | purpose 不可审计或不适用 | `DENY` |
| A5 | Parent 提交 Child-B ref，但可信关系只证明 Parent→Child-A | 客户端 subject 不能越过服务端 relationship/scope 解析 | `DENY` |
| A6 | School/Teacher 查看被分配 Child-A 的课堂支持摘要 | `SCHOOL`；有效组织/role、assignment、subject、教育 purpose、最小字段和 consent/policy | `ALLOW`（字段最小化） |
| A7 | School 使用 school ref 查询学校全部儿童原始资料 | 组织身份不产生全校默认可见权；无逐项 subject/purpose | `DENY` |
| A8 | Partner/Provider 查看已分配 service case 的 Child-A 最小资料 | `PARTNER`；provider、case、subject、purpose、必要 consent、expiry 和 human gate 满足 | `ALLOW`（case 最小范围） |
| A9 | Provider 使用 Child-A 的 ref 请求 Child-B、另一家庭或另一 Provider case | subject/family/case 越界 | `DENY` |
| A10 | Operations 处理安全 incident，仅查看 Child-A 必要字段 | `OPERATIONS`；明确 incident/case、purpose、最小字段、human/safety gate、完整 audit | `ALLOW`（审计且最小化） |
| A11 | Operations 无工单导出全租户儿童画像 | 无 operation purpose，且违反最小可见性和 super-profile 禁止 | `DENY` |
| A12 | 请求同时带 tenant/family T1/F1 与 T2/F2 | 跨 tenant、跨 Family；V1 无跨界授权 | `DENY` |
| A13 | Agent 请求 SQL 或数据库凭据以生成回答 | Agent 不得直连 DB；必须通过受控边界和最小 context | `DENY` |
| A14 | Provider 请求任意 Family API endpoint 或原始聊天全文 | 非 assigned case/字段白名单，且绕过最小化 | `DENY` |
| A15 | Consent 已撤回但旧 grant 尚未过期 | revocation 优先于 expiry；旧快照不可继续消费 | `REVOKED` |
| A16 | 需要 human gate 但状态为 `PENDING` | 只能安全停止、澄清或进入人工审核；不提供受限字段、不执行外部效果 | `PENDING_HUMAN_GATE` |
| A17 | 多 subject 请求中 Child-A 有效、Child-B 关系已撤回 | V1 默认全批次 fail-closed，不静默移除失败 subject | `DENY` |
| A18 | 授权服务、时钟、policy 或 audit 不可用，无法证明安全边界 | 系统错误、超时或证据不完整 | `DENY` |

## 7. 失败安全、审计与生命周期

### 7.1 Fail-closed

以下任一情况必须拒绝，且不得通过错误消息、数量、耗时、缓存命中或字段差异泄露受保护 subject 是否存在：

- actor、role、trust zone、recipient、subject、purpose 或 scope 无法验证；
- relationship、service case、tenant/family boundary 或组织责任范围缺失；
- consent snapshot 缺失、撤回、过期、冲突或与请求不匹配；
- expiry 到期、revocation 状态不明、版本未知或时钟不可信；
- human gate 要求未满足；
- 出现 wildcard、隐式全部儿童、跨 Family、跨 tenant 或跨 recipient；
- allowed fields 不是白名单，或同时命中 forbidden fields；
- 请求要求 direct DB、raw SQL、任意 provider endpoint、通用导出或 canonical mutation；
- policy、audit、adapter、model gateway 或授权解析依赖不可用。

统一拒绝语义不得返回敏感内部规则；审计可以保留拒绝原因类别和 trace，但不应把拒绝变成新的业务事实。

### 7.2 Audit 最小要求

每个授权判断至少应能追溯到：

- `actor`、有效 `role` 和 `trust_zone`；
- `subject`、`recipient`、`purpose` 和 `scope`；
- `consent_snapshot` 引用、policy 版本、expiry/revocation 状态；
- human gate 状态和引用（适用时）；
- decision、决定时间、issuer、correlation/trace；
- allow/deny/revoke/expire/pending 的原因类别和版本。

本节不授权新增 audit schema、数据库表、runtime writer 或日志管道。

### 7.3 建议生命周期（合同语义）

```text
REQUESTED
  → RESOLVING
  → PROPOSED / PENDING_HUMAN_GATE
  → ALLOWED
  → EXPIRED / REVOKED / SUPERSEDED / DENIED
  → ARCHIVED_OR_DISPOSED
```

签发或允许不等于永久通行；每次消费都必须重新检查 scope、purpose、consent、expiry、revocation、recipient 和 human gate。状态冲突一律按不可消费处理。

## 8. 非授权清单

本合同明确不批准以下任何事项：

- IAM、RBAC/ABAC、账号、token、session 或 credential 实现；
- API endpoint、middleware、gateway、SDK 或 runtime enforcement；
- DB schema、表、字段、索引、migration、seed 或数据修复；
- Provider、School、Partner 或 Operations 的真实接入、同步、数据交换或生产登记；
- Agent、MCP、Model Gateway、Harness 或工具调用实现；
- 任何直接数据库访问、SQL、任意导出或任意写入；
- 新业务 ownership、tenant 语义、Consent 真相源或 canonical object；
- 自动化决策、诊断、转介、预约、通知、收费、外部发送或生产/试点能力。

## 9. 回滚与变更控制

### 9.1 回滚动作

本 V5-02 contract-only 变更的唯一回滚动作是删除或 revert：

```text
50_开发_dev/contracts/authorization/FAMILY_AUTHORIZATION_PLANES_CONTRACT_V1.md
```

回滚不得修改既有 API、runtime、DB、migration、UI、数据、Consent、IAM、授权登记、历史审计或其他合同。

### 9.2 变更控制

任何改变以下内容的修改，必须创建新的版本化合同并重新走架构、隐私和未成年人安全审阅：

- 四类 trust zone 的定义或默认边界；
- Family owner 与 School/Partner/Operations 最小可见性；
- Purpose Grant 最小字段或 decision precedence；
- consent snapshot、expiry、revocation、human gate 或 audit 语义；
- Agent/Provider/DB 禁止边界；
- 跨 Family、跨 tenant、跨 subject 或 global child super-profile 禁止；
- `CONTRACT_ONLY_PROPOSED_FOR_REVIEW` 状态或任何授权声明。

## 10. 合同状态与授权结论

```text
CONTRACT_ONLY_PROPOSED_FOR_REVIEW = YES

FAMILY_OWNER_SEMANTICS_DEFINED        = CONTRACT_ONLY
SCHOOL_MINIMUM_VISIBILITY_DEFINED     = CONTRACT_ONLY
PARTNER_MINIMUM_VISIBILITY_DEFINED    = CONTRACT_ONLY
OPERATIONS_MINIMUM_VISIBILITY_DEFINED = CONTRACT_ONLY

IAM_AUTHORIZED                       = NO
API_AUTHORIZED                       = NO
DB_AUTHORIZED                        = NO
MIGRATION_AUTHORIZED                 = NO
RUNTIME_AUTHORIZED                   = NO
SCHOOL_INTEGRATION_AUTHORIZED       = NO
PROVIDER_INTEGRATION_AUTHORIZED     = NO
AGENT_DIRECT_DB_ACCESS              = NO
PROVIDER_DIRECT_DB_ACCESS           = NO
PRODUCTION_OR_PILOT_AUTHORIZED      = NO
```

在总架构师、隐私和未成年人安全书面批准前，本文件只能作为待审阅合同提案，不得作为已生效权限或可用能力的依据。