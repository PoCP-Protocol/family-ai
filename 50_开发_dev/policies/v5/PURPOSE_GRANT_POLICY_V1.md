# Purpose Grant Policy V1

- **Status:** `CONTRACT_ONLY_PROPOSED_FOR_REVIEW`
- **Scope:** V5-02 authorization contract only
- **Implementation state:** 本文件仅定义静态授权合同与纯决策语义；不实现 middleware、token、DB、migration 或 runtime enforcement。

## 1. 目的

Purpose Grant 是一次受控数据访问或受控动作的最小、可审计授权单元。它回答：谁以什么目的，将哪些主体范围内的哪类数据，在什么 scope 内，授予哪个 recipient，允许到何时，以及是否需要人工 Gate。

Purpose Grant 不等同于登录身份、tenant membership、tenant role、组织关系或一般服务权限。

## 2. 最小字段

以下字段全部必需；字段缺失、为空、格式未知或无法由受信来源验证时，决策必须 fail-closed。

| 字段 | 最小语义 |
|---|---|
| `grant_ref` | Purpose Grant 的全局唯一、不可变引用。 |
| `requester` | 发起访问请求的受信主体引用；不得使用未验证的客户端自由文本。 |
| `recipient` | 实际接收最小数据或执行受控动作的主体/受控 adapter 引用。 |
| `subject_refs` | 被访问或被处理的主体引用集合；必须显式列出，禁止隐式扩大。 |
| `purpose` | 已注册且精确匹配的业务目的 code；未知、宽泛或未注册目的不得通过。 |
| `data_classification` | 本次授权覆盖的数据分类；实际请求不得超过该分类。 |
| `scope` | 明确的授权范围，包括适用 trust zone、tenant/family/subject 等边界；不得跨 scope 推断授权。 |
| `consent_snapshot_ref` | 对应 Consent 快照的不可变引用；必须能验证当时的 purpose、subject、scope、版本和状态。 |
| `issued` | 签发时间戳，使用可验证的 UTC 时间。 |
| `expires` | 到期时间戳；必须晚于 `issued`，到期后不可继续使用。 |
| `revoked` | 撤回状态及可审计撤回时间/引用；未撤回应明确表示为未撤回，撤回立即失效。 |
| `human_gate_ref` | 需要人工 Gate 时的人工审阅/批准引用；不需要时也必须明确为 `null` 或 `NOT_REQUIRED`，不得省略。 |
| `policy_version` | 签发时适用的 Purpose Grant policy 版本。 |
| `trace_id` | 贯穿请求、决策、数据投影/动作和审计记录的关联引用。 |

### 2.1 字段约束

1. `requester`、`recipient`、`subject_refs` 和 `scope` 必须分别验证，不能从 tenant role 或请求参数互相推导替代。
2. `purpose` 必须来自受控 purpose registry，并与 `consent_snapshot_ref` 中的授权目的精确匹配。
3. `data_classification` 只能限制或等于请求所需分类；请求更敏感分类时不得自动升级。
4. `scope` 必须覆盖请求的全部 subject 与数据资源；任何跨 tenant、family、trust zone 或 subject 的访问均视为越界。
5. `expires`、`revoked`、`policy_version` 和 `consent_snapshot_ref` 必须在每次使用时重新验证，不得仅在签发时验证。
6. `human_gate_ref` 表示人工 Gate 的事实引用，不得用 requester 的角色或系统默认配置伪造人工批准。
7. `trace_id` 不得复用为授权凭证，也不得替代 `grant_ref`。

## 3. 纯决策语义

决策函数只读取请求、Purpose Grant、Consent snapshot、受控 purpose registry、subject/scope facts 和 Human Gate facts；不产生副作用、不写 DB、不签发 token、不调用 Agent 或 Provider。

```text
DECIDE(request, grant, consent_snapshot, registry, subject_facts, gate_facts)
  -> ALLOW | DENY | REVIEW_REQUIRED
```

### 3.1 `ALLOW`

仅当以下条件全部成立时返回 `ALLOW`：

- 所有最小字段存在且可验证；
- `grant_ref`、`policy_version`、`trace_id` 和相关引用格式有效；
- requester 与 recipient 身份均受信且符合授权关系；
- 所有 `subject_refs` 均在声明的 `scope` 内；
- purpose 已注册、未被禁用，并与请求及 Consent snapshot 精确匹配；
- data classification 不超过授权分类；
- Consent snapshot 存在、版本有效、未撤回且覆盖相同 purpose/subject/scope；
- 当前时间满足 `issued <= now < expires`；
- `revoked` 明确为未撤回；
- 若策略要求 Human Gate，则 `human_gate_ref` 对应有效批准；
- 无任何跨 scope、冲突事实、未知状态或更高优先级阻断条件。

### 3.2 `DENY`

返回 `DENY` 的条件包括但不限于：

- Purpose Grant 不存在、字段缺失、格式无效或引用不可验证；
- 已过期、已撤回、Consent snapshot 缺失/过期/撤回或版本不匹配；
- requester、recipient、subject 或 scope 不匹配；
- 请求跨越 tenant、family、trust zone 或其他授权边界；
- purpose 未知、未注册、被禁用或与 Consent 不匹配；
- 请求的数据分类超过授权范围；
- 试图以 tenant role、组织角色或登录身份单独替代 Purpose Grant；
- Agent 或 Provider 试图绕过受控边界直接访问数据库；
- 已知违反 policy、Human Gate 或安全规则。

### 3.3 `REVIEW_REQUIRED`

仅用于授权事实尚未完成、但不是已知永久拒绝的人工审阅路径，例如：

- 高风险或未成年人敏感数据使用需要人工 Gate，且 `human_gate_ref` 尚未形成有效批准；
- 授权事实存在可审阅冲突，无法安全自动判断；
- policy 规定必须由责任人确认的 purpose、recipient 或 scope 尚未确认。

在 `REVIEW_REQUIRED` 状态下不得读取、投影、外发数据或执行受控动作；等待有效人工决策期间行为等同于 fail-closed。人工决策必须产生新的可审计引用，不得将 `REVIEW_REQUIRED` 自动转换为 `ALLOW`。

## 4. Fail-closed 规则

任何缺失、过期、撤回、跨 scope、未知 purpose、未知 recipient、未知 data classification、未知 policy version、未知 Consent 状态或未知 Human Gate 状态，均不得默认允许；应返回 `DENY` 或 `REVIEW_REQUIRED`，具体由已批准策略决定，但绝不能继续执行。

不允许使用“默认当前 tenant”“默认当前 family”“默认 requester 是 recipient”或“默认 role 具备所有 purpose”的隐式补全。

## 5. Tenant role 与 Purpose Grant 的边界

- Tenant role 只能表示组织内的身份/职责，不表示特定数据目的的授权。
- Tenant role **不得替代** Purpose Grant、Consent snapshot、subject scope、expiry、revocation 或 Human Gate。
- 即使 requester 拥有 tenant admin、school admin、provider 或 operations role，也必须提供并通过适用的 Purpose Grant 决策。
- Purpose Grant 也不能凭自身授予超出 requester 既有身份、Consent 或 policy 的能力；所有前置条件必须同时满足。

## 6. Agent / Provider 访问边界

- Agent 和 Provider 不允许直接连接或查询 Family、School、Partner、Operations 的数据库。
- Agent/Provider 只能通过受控 adapter、最小化 read tool 或经授权的服务边界接收已通过 Purpose Grant 决策的最小上下文。
- 数据投影、外发和动作执行必须携带 `grant_ref`、`purpose`、`subject_refs`、`policy_version` 与 `trace_id`，并可回溯到 `consent_snapshot_ref`。
- 本合同不实现上述 adapter、middleware、token 或数据库结构；这些属于后续经批准的实现任务。

## 7. 非目标

本版本不定义或实现：

- IAM、登录、tenant membership 或角色管理；
- token 格式、签名、密钥轮换或 middleware；
- Purpose Grant 持久化表、migration、数据库查询或撤回服务；
- Agent/Provider runtime、adapter 实现或真实跨 trust-zone 接入；
- 任何生产授权登记或真实外部数据访问。