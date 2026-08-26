# Family Subject Isolation Contract V1

- **Status:** `CONTRACT_ONLY_PROPOSED_FOR_REVIEW`
- **Scope:** canonical subject boundary and isolation semantics only
- **Owner:** Family Architecture / Privacy & Safety Review
- **Version:** V1
- **Effective date:** proposed; not effective until written approval

> 本文件是 V5-01 的合同提案。它只定义可审阅的边界、约束、拒绝语义和验收标准。
> **不授权 runtime、API、DB、migration、UI、模型、Agent、MCP 或任何生产访问控制实现。**
> 在总架构师书面批准前，本文不得被解释为已生效的授权策略或可用能力声明。

## 1. 目的与不可变原则

本合同为 Family 平台建立统一的 canonical subject boundary，避免不同产品、角色、读取模型或 AI 上下文各自解释“当前主体”，并防止把多个儿童或多个家庭拼接成未经授权的全局画像。

以下原则是本合同的不可变约束：

1. 每个访问请求都必须同时具备并校验 `requester`、`viewer`、`beneficiary`、`subject`、`relationship`、`purpose`、`tenant_scope` 和 `family_scope`。
2. `subject_ref` 只能作为待校验的候选引用；**subject refs 不得由客户端最终决定**。最终 subject 必须由服务端依据已验证身份、成员关系、租户归属、家庭范围、purpose、Consent/Policy 和数据可见性重新解析。
3. 任何未确定、冲突、过期、超范围或无法证明的边界条件均 `DENY`（fail-closed），不得降级成“当前用户可见全部”。
4. 一个请求可以涉及多个明确列出的儿童，但不得隐式扩展到家庭中的其他儿童。
5. `Family` 是长期家庭根对象；`Child`、`Parent`、`Teacher`、`School`、`Provider`、`Operations` 是独立的 canonical subject 类型，不得以角色名称替代主体身份。
6. 不创建、读取、推断或返回跨儿童合并的 **global child super-profile**。家庭级聚合只能是 purpose 限定、最小必要、可追溯的投影，不是儿童事实的合并替身。

## 2. Canonical subject boundary

### 2.1 Subject 类型

| Subject type | 语义 | 典型边界 | 默认不是 |
| --- | --- | --- | --- |
| `Family` | 一个家庭的 canonical 根主体 | 单一 `family_ref` | 全平台家庭集合 |
| `Child` | 家庭中的一个明确儿童主体 | 单一 `child_ref` + 所属 `family_ref` | 家庭全部儿童、儿童排行榜或统一画像 |
| `Parent` | 家庭成员中的父母/监护主体 | 已验证的 membership 与 relationship | 任意家庭成员或代替儿童本人 |
| `Teacher` | 经验证、与特定学校/服务关系绑定的教育主体 | `school_ref`、分配关系、指定 family/child scope | 全校或全平台儿童访问者 |
| `School` | 组织级教育主体 | 单一 `school_ref` + tenant/授权关系 | 学校所属全部家庭的默认可见范围 |
| `Provider` | 经验证的专业/服务提供方主体 | `provider_ref`、服务关系、assigned case/purpose | 任意专业人员或全家庭访问者 |
| `Operations` | 平台运营、安全、审计等受控工作主体 | 明确的 operation case/purpose、最小范围、审计 | 全局管理员或全量儿童 super-profile |

`Subject type` 描述“谁/什么是被边界保护的主体”，不自动授予访问权。角色、组织归属、认证状态和业务关系必须分开验证。

### 2.2 关系不是主体

`relationship` 是 requester/viewer 与 beneficiary/subject 之间的经验证关系，例如 `parent_of`、`guardian_of`、`teacher_of`、`school_supports`、`provider_assigned_to` 或 `operations_handles_case`。关系必须包含范围、状态、来源和有效期（如适用）。

任何客户端提交的关系字符串、显示名称或“我是孩子家长”的声明均只能作为候选输入，不能作为授权依据。

## 3. 请求边界模型

每个未来请求、工具调用、read-model 查询或评估输入，均应能表达以下逻辑请求上下文。字段名是合同术语，不是本任务对 API 或 DB 的授权：

```text
request_context = {
  requester:       verified actor identity,
  viewer:          effective viewing subject / role context,
  beneficiary:     person or party receiving the service,
  subject:         one or more explicitly enumerated canonical subjects,
  relationship:    verified relationship between the parties,
  purpose:         declared, allowed, and time-bounded business purpose,
  tenant_scope:    one tenant boundary,
  family_scope:    zero or one family boundary, or an explicitly approved non-family operational case,
  subject_refs:    client-proposed candidates only; server-resolved before use,
  consent_policy:  applicable consent, safety, policy, and human-gate evidence,
  trace:           correlation, provenance, and audit references
}
```

### 3.1 字段语义

- **`requester`**：实际发起请求的已验证身份。不能由请求体中的 `user_id`、`role` 或 `subject_ref` 替代。
- **`viewer`**：本次查看语境中的有效主体/角色。`viewer` 不等于 `requester`；例如 Operations 可代表受控工作语境查看，但仍须有 case 和 purpose。
- **`beneficiary`**：本次服务或结果的受益主体。受益不等于可查看全部数据，也不自动等于 `subject`。
- **`subject`**：被读取、解释、评估或引用的明确 canonical subject 集合。集合必须显式枚举，不能使用隐含 wildcard。
- **`relationship`**：连接参与方的已验证关系及其范围；没有有效关系不得访问关系保护的数据。
- **`purpose`**：具体、最小化、可审计的用途。泛化的“运营”“AI”“分析”不足以自动授权儿童数据。
- **`tenant_scope`**：请求所属的单一租户边界。租户之间默认完全隔离。
- **`family_scope`**：请求所属的家庭边界。家庭数据默认只在一个明确家庭内解析。
- **`subject_refs`**：客户端或上游系统提供的候选引用；服务端必须校验并可替换、缩减或拒绝。

## 4. Tenant 与 Family scope

1. 一个请求只能有一个有效 `tenant_scope`；缺失、多个、冲突或无法从可信身份解析时拒绝。
2. `family_scope` 必须与每个 resolved subject 的 canonical 所属关系一致；任何一个 subject 跨出家庭范围，整个请求拒绝，不得部分成功并泄漏跨界结果。
3. Family 是家庭级最小长期边界。学校、Provider 和 Operations 不得因为组织级身份而获得跨家庭默认范围。
4. 跨 tenant 访问不是普通的“多选查询”，只能作为未来单独批准的受控 operation contract；本 V1 默认 `DENY`。
5. tenant 或 family 的显示名称、URL 参数、客户端 header、缓存 key 和导出文件名都不是可信边界；可信边界必须由服务端身份与关系数据解析。
6. 缓存、日志、异步任务、导出、评估样本和模型上下文必须保留并校验 tenant/family/subject scope，不能使用仅有 `user_id` 的全局键。

## 5. Multi-child isolation

### 5.1 默认规则

- 未指定儿童时，不得返回任何儿童级数据；“当前家庭”不等于“家庭所有儿童”。
- 指定一个儿童时，只能返回该 `child_ref` 在当前 purpose 下的最小必要数据。
- 指定多个儿童时，必须逐一列出 canonical refs、逐一验证关系和 purpose，并保留每个儿童的隔离 provenance。
- 多儿童结果不得自动合并为一个 `Child`、一个 GrowthProfile、一个风险分数、一个排名或一个“家庭儿童画像”。
- 某一儿童校验失败时，默认整个批次 `DENY`；不得通过静默移除失败儿童来伪装成功。若未来需要 partial result，必须另行批准并明确拒绝项不会泄漏信息。
- 家庭级视图只能返回为该 purpose 明确定义的家庭投影；不得从家庭投影反向推断未授权儿童事实。

### 5.2 明确禁止：global child super-profile

以下形状一律禁止：

```text
all_children -> one_child_profile
child_A + child_B -> shared_child_memory
all_family_children -> global_child_embedding
school_children + provider_children -> cross_family_child_profile
```

允许存在的是按 subject 分隔、带 scope/provenance 的独立记录或明确的家庭级最小聚合；任何跨儿童推断都不得被命名、存储或返回为某个单一儿童的 canonical state。

## 6. Fail-closed 规则

以下任一条件成立，结果必须为 `DENY`，且不得返回受保护 subject 的存在性、数量、字段差异或可用于推断的信息：

- requester 身份、tenant 或 family 无法验证；
- viewer、beneficiary、subject、relationship 或 purpose 缺失；
- subject_ref 仅来自客户端且未完成服务端解析；
- subject 不属于 resolved tenant/family scope；
- requester/viewer 与 subject 没有有效且 purpose 适用的 relationship；
- purpose 不明确、过宽、已过期、被撤回或不支持该数据类型；
- Consent、minor safety、policy 或 human gate 证据缺失/冲突/过期；
- 请求包含 wildcard、隐式“全部儿童”、跨 family 或跨 tenant 引用；
- 多儿童请求存在任一未通过校验的儿童；
- 缓存、任务、导出或上下文无法证明与原始 scope 一致；
- 任何系统错误、超时、解析歧义或授权服务不可用。

拒绝响应只能使用统一、非枚举式的拒绝语义；不得通过错误码、耗时、消息或结果数量暴露另一个家庭/租户/儿童是否存在。

## 7. Subject reference resolution

未来实现必须遵循以下顺序（本节不授权实现）：

1. 从可信认证上下文解析 `requester` 与 `tenant_scope`。
2. 从服务端关系与授权资料解析有效 `viewer`、`beneficiary`、`relationship` 和 `family_scope`。
3. 将客户端 `subject_refs` 视为候选集合，逐项 canonical resolve；不可解析或越界即拒绝。
4. 根据 purpose、Consent、Policy、Minor Safety 与 Human Gate 计算最小可见范围。
5. 生成带 tenant/family/subject/purpose/trace 的受限上下文；后续读取、评估、工具调用和缓存均不得扩大该上下文。

客户端可以请求“查看 child-X”，但不能通过提交 `child-X` 获得访问权；客户端也不能把 `family-Y`、`tenant-Z` 或 `all_children` 注入为最终边界。

## 8. 允许 / 拒绝示例矩阵

下表是合同验收示例，不是现有 runtime/API 行为声明。

| # | 场景 | 关键边界 | 结果 | 理由 |
| --- | --- | --- | --- | --- |
| A1 | 已验证 Parent 查看自己家庭中 Child-A 的已授权成长记录 | 单 tenant、单 family、`parent_of`、明确 purpose、有效 consent | `ALLOW`（最小范围） | 所有边界一致，且只返回 Child-A |
| A2 | Parent 在同一家庭同时查看 Child-A、Child-B 的同一 purpose 数据 | 两个显式 subject refs；两项关系分别验证 | `ALLOW`（按儿童隔离返回） | 允许显式多儿童，但不得合并成单一 profile |
| A3 | Parent 请求“查看我的家庭所有儿童”但未列出 subject refs | family scope 有效，subject 不明确 | `DENY` | 家庭范围不替代儿童 subject 枚举 |
| A4 | Parent 查看同家庭 Child-A，但 purpose 缺失 | subject/relationship 可能有效，purpose 缺失 | `DENY` | 目的不明，无法做最小化授权 |
| A5 | Parent 提交 Child-B 的 ref，但服务端关系仅证明 Parent→Child-A | client ref 越界 | `DENY` | subject refs 不是授权；不得串读 |
| A6 | Teacher 查看被分配的 Child-A 的课堂支持数据 | school/teacher 关系、assigned child、purpose 均有效 | `ALLOW`（字段最小化） | 仅限分配关系与 purpose 范围 |
| A7 | Teacher 使用 school_ref 查询该学校全部儿童 | school 级身份，无逐项 assignment/purpose | `DENY` | 组织身份不产生全校儿童默认可见权 |
| A8 | Provider 查看已分配 service case 的 Child-A 数据 | provider、case、family/child scope、purpose、所需 consent 有效 | `ALLOW`（case 最小范围） | Provider 不能越过 assigned case |
| A9 | Provider 使用 Child-A 的 ref 请求 Child-B 或另一个家庭 | subject/family 越界 | `DENY` | cross-subject/cross-family fail-closed |
| A10 | Operations 处理安全 case，已批准 case/purpose 只需查看 Child-A 的必要字段 | operation scope、human/safety gate、trace 有效 | `ALLOW`（审计且最小化） | 受控运营例外不等于全局管理员 |
| A11 | Operations 无 case 地导出全租户儿童画像 | tenant 内但无 case/purpose，且全量导出 | `DENY` | Operations 不得获得 global child super-profile |
| A12 | 请求同时带 tenant-T1/family-F1 与 tenant-T2/family-F2 | 跨 tenant、跨 family | `DENY` | V1 默认禁止跨界请求 |
| A13 | 缓存命中 child-A，但缓存键只有 requester_id | scope 无法证明 | `DENY` / 不得使用命中结果 | 缓存不能绕过 subject isolation |
| A14 | 一次请求包含 Child-A（有效）和 Child-B（关系已撤回） | 多儿童批次部分失败 | `DENY` | 默认全批次 fail-closed，避免静默泄漏 |

## 9. 禁止的设计退化

不得以以下方式绕过本合同：

- 将 `requester`、`viewer`、`beneficiary`、`subject` 合并为一个 `user_id`；
- 将 `role=parent/teacher/provider/operations` 当作全局数据权限；
- 使用 `family_id` 代替明确的 child subject；
- 允许客户端最终决定 `subject_ref`、tenant 或 family scope；
- 以搜索、推荐、embedding、memory、analytics、导出或日志通道旁路隔离；
- 以“只读”“内部”“调试”“管理员”“AI context”绕过 purpose/consent/policy；
- 把 `Perspective`、`Hypothesis`、`Recommendation` 或推断 profile 写成某个儿童的 canonical fact/state；
- 返回跨儿童平均值、总分、排名、统一标签或可反推出单个儿童敏感事实的聚合；
- 在错误、超时或上游不可用时放宽范围或返回旧的未验证上下文。

## 10. 验收标准

V5-01 仅在总架构师书面审阅后，按以下证据验收合同本身：

1. **术语一致性**：Family、Child、Parent、Teacher、School、Provider、Operations 及六类请求参与者定义无歧义，且主体与 relationship 未混淆。
2. **范围可证明**：tenant/family scope、单儿童和显式多儿童规则能被独立审阅；默认无 wildcard。
3. **客户端不拥有边界**：文档明确 subject refs 仅为候选，最终解析归服务端；未来实现不得反向解释。
4. **Fail-closed 完整**：跨 subject、cross-family、cross-tenant、缺 purpose/relationship/consent、解析错误和部分多儿童失败均有拒绝语义。
5. **无 super-profile**：合同、示例和未来验收 fixture 均不得产生 global child super-profile。
6. **矩阵可执行**：允许/拒绝矩阵至少覆盖 Parent、Teacher、School、Provider、Operations、单儿童、多儿童、跨家庭和跨租户场景。
7. **非授权声明清晰**：任何 runtime/API/DB/UI/模型/Agent/MCP 实现必须等待单独授权，不能从本合同推断已批准。
8. **回滚可逆**：删除本提案文件即可撤回 V5-01 合同提案，不需要迁移、数据修复或运行时回滚。

## 11. 回滚与变更控制

- 本任务的回滚动作：删除或 revert 本文件。
- 回滚不得修改既有 API、runtime、DB、migration、UI、数据、授权状态或其他合同。
- 本文件未经书面批准不应被其他任务当作已生效依赖；若审阅不通过，保留审阅记录由上层流程处理，不得自行扩展或补做实现。
- 任何改变 canonical subject 类型、scope 默认值、fail-closed 语义、跨租户规则或 super-profile 禁令的变更，必须形成新的版本化合同并重新走架构、隐私与安全审阅。

## 12. 授权边界声明

```text
CONTRACT_ONLY_PROPOSED_FOR_REVIEW = YES
RUNTIME_AUTHORIZED                 = NO
API_AUTHORIZED                     = NO
DB_SCHEMA_AUTHORIZED               = NO
MIGRATION_AUTHORIZED               = NO
UI_AUTHORIZED                      = NO
MODEL_OR_AGENT_AUTHORIZED          = NO
MCP_OR_TOOL_ACCESS_AUTHORIZED      = NO
PRODUCTION_OR_PILOT_AUTHORIZED     = NO
```
