# TENANCY-T3-FULL-RUNTIME-ROADMAP-001

## 目标
将 Tenant—Party—Organization—Teacher—Provider—Family—ServiceCase 从“基础模型 + Family 侧授权管理”推进为可验证的多主体运行时。

## 真实状态基线

- Patch 2：Party / Organization / Teacher / Provider schema 与基础 Provider 查询已落地。
- Patch 3：legacy ServiceProvider → canonical ProviderProfile bridge 已落地，仍为 fixture-safe。
- Patch 4：ServiceRelationship / CaseAccessGrant schema、Family 侧签发/撤销和 fail-closed 校验已落地。
- 未完成：Teacher/Provider 侧登录上下文、授权 Case 读取、scope 执行、TeacherAssignment、RecordDelivery、组织工作台、真实外部效果、结算。

## 分阶段计划

### Phase A — Granted Case Read Runtime（当前）

实现：

1. Account → AccountPartyBinding → Party 可信解析。
2. Provider/Teacher 侧使用自己的会话读取 Case。
3. 读取必须同时满足：Party 绑定有效、CaseAccessGrant 有效、ServiceRelationship ACTIVE、SERVICE consent 有效、未过期、未撤销。
4. 返回最小 projection，按 `scope` 裁剪；拒绝 Family 全量档案、原始 consent、内部审计和未授权字段。
5. 跨 Family、错误 Party、撤销、过期、consent 撤回全部 fail closed。

验收：真实 PostgreSQL HTTP 集成测试。

### Phase B — Organization Context Runtime

实现：

1. Organization membership / tenant binding 可信上下文。
2. 组织操作员只能看到本组织供给与被授权 Case。
3. 组织角色不投影为 Family guardian。
4. 组织端 Case projection 复用 CaseAccessGrant，不建立旁路权限。

非目标：支付、合同结算、组织自动拥有 Family 数据。

### Phase C — TeacherAssignment / Delivery

实现：

1. `AssignTeacherToServiceCase` 只能绑定有效 ServiceCase、有效 TeacherProfile/ProviderProfile、有效关系和授权。
2. Assignment 状态变更有 Named Action、审计、幂等。
3. `RecordDelivery` 仅记录服务过程，不生成 Outcome，不代表效果事实。
4. 教师只能读取自己被授权且被分配的 Case。

非目标：真人通知、直播、自动外呼。

### Phase D — Provider Admission / Organization Supply

实现：

1. 组织 Provider、Teacher affiliation、qualification、admission 的真实工作流。
2. Offer 发布前验证资格、准入、未成年人政策和有效期。
3. legacy UI-19 只作为兼容投影，不能作为 canonical professional identity。

### Phase E — Commercial Gate（独立审批）

实现前必须单独授权：

- Contract
- Payment
- Refund
- Dispute
- Settlement / Tax
- External notification

默认保持关闭，不能因 ProviderProfile 或 ServiceRelationship 自动开放收费能力。

## 全局验收规则

- 每个写 Action 有 actor、correlation_id、幂等键和审计。
- Family 是家庭数据 owner；Tenant 只是隔离和运营上下文。
- ServiceRelationship 不等于 CaseAccessGrant。
- AccessGrant 不等于 TeacherAssignment。
- ServiceRecord 不等于 Outcome。
- fixture_only 与 external_effect=false 不得被删除或弱化。
- 没有真实 Party/Grant/Scope 执行链，不得声称完成教师端能力。
