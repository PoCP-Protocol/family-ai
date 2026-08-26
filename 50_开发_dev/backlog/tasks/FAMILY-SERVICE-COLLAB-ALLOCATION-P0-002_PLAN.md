# FAMILY-SERVICE-COLLAB-ALLOCATION-P0-002 后续计划

## 状态

- 计划状态：`PLANNED`
- 依赖基线：`FAMILY-SERVICE-COLLAB-ALLOCATION-P0-001`
- 当前代码基线：`feat/service-collab-allocation-p0-002` / `6eef592`
- 范围：只完善 Family 内部、案件级、可审计的受治理协作与影子分配；不进入商业结算、不做跨家庭推荐。

## 已完成事实

1. 版本化 `service_collaboration_blueprints` 与 V1 蓝图种子。
2. `service_cases` 保存冻结蓝图引用、版本和快照。
3. `service_tasks` 保存角色、能力要求和权重。
4. 一个任务只允许一个当前 `ACCEPTED` 分配。
5. 分派角色由服务端蓝图派生，客户端不能声明角色。
6. Provider ACTIVE、ADMITTED、能力、ServiceRelationship 和 CaseAccessGrant 校验已接入。
7. `VERIFIED` 任务才产生 `ServiceContribution`。
8. 案件级影子分配入口与一次性标记已接入。
9. 交付池按 `task_weight` 拆分，质量储备按回访状态释放或保持挂起。
10. 0055 迁移已在测试 PostgreSQL 重置环境成功执行。

## 尚未完成 / 当前缺口

### P0-002-A：蓝图与分配策略运行时化

- [ ] 分配实现不能只依赖固定 TypeScript 分支；应从冻结快照中的 `allocation_policy` 和 `release_rules` 读取策略。
- [ ] 明确缺少可选角色时的单位处理：保留、转入 `QUALITY_RESERVE`，或显式拒绝；不得静默让总量不足而仍标记 finalized。
- [ ] `CONTENT_RESOURCE`、`CASE_STEWARD`、`DELIVERY_RESOURCE` 的最小履约条件写入可验证规则。
- [ ] 校验 `basis_ref`、`policy_ref`、`policy_version` 始终指向冻结配置。

验收：同一案件使用 V1 快照时，即使 ACTIVE 蓝图发布 V2，分配结果仍严格按 V1。

### P0-002-B：任务生命周期闭环

- [ ] `CLOSURE_QUALITY_REVIEW` 必须由 `QUALITY_REVIEWER` 角色执行。
- [ ] 审核人资格、案件授权和交付责任人隔离必须在服务端统一校验。
- [ ] `REWORK_REQUIRED` 必须创建或恢复蓝图声明的 rework 任务，而不是只把原任务改回 `IN_PROGRESS`。
- [ ] `REJECTED`、`CANCELLED`、`UNANSWERED` 的案件状态转移和可重试边界需要明确。
- [ ] `submitFollowUp()` 应与案件级 finalize 幂等关联，避免回访先释放、后重复 finalize。

验收：NOT_HELPFUL_YET 会保留原贡献、质量池保持 HELD，并产生可追踪 rework task。

### P0-002-C：分配数据模型与不变量

- [ ] 增加案件级 allocation run / policy snapshot 记录，避免用第一条 contribution 充当 PLATFORM 和 QUALITY_RESERVE 的伪 basis。
- [ ] 建立案件级总量约束查询或数据库约束，确保任何 finalized case 的 allocation units 不超过 100。
- [ ] 统一 `CASE_STEWARD` 与历史 `STEWARD` 命名，禁止新代码继续写旧桶。
- [ ] 明确 allocations 的 `beneficiary_kind`、`basis_type` 枚举/校验。
- [ ] 评估 `contribution_ref` 对案件级平台/质量池记录的语义问题，优先采用独立 case-level allocation basis，不扩大为支付模型。

验收：重复 finalize、并发 finalize、部分角色缺失、多个 delivery contribution 均不会产生重复或超额分配。

### P0-002-D：关系、准入与组织运行时

- [ ] Provider/Teacher 的实际身份必须来自可信 professional work context，不接受普通家庭 actor 伪造。
- [ ] 分派链补充 organization / tenant 绑定校验。
- [ ] assignment、delivery、verify、follow-up 的写 Action 统一补充 actor、correlation_id、idempotency 和 audit。
- [ ] CaseAccessGrant 与 Assignment 分离但必须可追溯关联。
- [ ] 撤销 relationship、grant、admission 后，后续 delivery/verify/follow-up 必须 fail closed。

验收：跨租户、撤销授权、错误 Party、过期 Grant、非 admitted provider 全部拒绝。

### P0-002-E：API 合同、读取投影与运营可见性

- [ ] 为 task、assignment、contribution、allocation 增加稳定的读取 DTO 和分页/过滤边界。
- [ ] 返回 blueprint version、policy version、basis type/ref，但不暴露家庭敏感原文或内部风险字段。
- [ ] 增加案件协作状态投影：当前任务、责任角色、审核状态、Held/Released 原因、等待/暂停状态。
- [ ] 运营端只读查看规则命中与拒绝原因，不提供抢单、排行、竞价或商业金额视图。
- [ ] 文本路径能表达“为何可见/不可见、可选择暂不行动、当前等待状态”。

验收：同一 Case 的 Family、运营、专业方投影按权限和 scope 最小化返回。

### P0-002-F：自动化测试与真实数据库验收

- [ ] 三个 VERIFIED task 不生成 300，只生成案件级最多 100。
- [ ] 并发 assignment 只有一个 ACCEPTED。
- [ ] 任意 assignee_ref、非 admitted provider、能力不匹配、关系失效、Grant 失效均拒绝。
- [ ] 未 VERIFIED task 不生成 contribution。
- [ ] Delivery 权重 `1:2:1` 精确得到 `10:20:10`。
- [ ] 重复 finalize 不重复生成 allocation。
- [ ] V1 冻结快照不受 V2 ACTIVE 蓝图影响。
- [ ] NOT_HELPFUL_YET 保留 contribution、质量池 HELD、生成 rework task。
- [ ] HELPFUL/SOMEWHAT_HELPFUL 只释放 QUALITY_RESERVE。
- [ ] reviewer 不得等于 delivery assignee。
- [ ] 全部关键写入不调用 payment、wallet、commission、settlement 或外部通知。
- [ ] 运行真实 PostgreSQL HTTP integration test；不可只依赖 mock repository。

## 执行顺序

1. 先完成 P0-002-C，修正案件级 allocation basis 和数据库不变量。
2. 再完成 P0-002-B，闭合 verify / rework / follow-up 状态机。
3. 接着完成 P0-002-D，统一专业身份、租户、授权和审计上下文。
4. 然后完成 P0-002-A，改为从冻结策略快照驱动分配。
5. 最后完成 P0-002-E 与 P0-002-F，做权限投影、真实数据库和并发验收。

## 明确不做

- 不做支付、钱包、佣金、税务、结算、退款、争议。
- 不做服务者评分、排名、抢单、竞价、跨家庭匹配。
- 不把成长结果、孩子变化或家庭反馈直接当作收入依据。
- 不自动进入 P1；本计划完成后停止，等待新的批准任务。

## 完成门槛

只有同时满足以下条件才可标记 P0-002 完成：

- 所有 P0-002-A 至 F 的验收项通过。
- 真实 PostgreSQL 迁移、API typecheck、聚焦测试、集成测试通过。
- `git diff --check` 通过。
- 分支提交只包含本任务范围。
- GitHub PR 已创建，base 为 `feat/service-collab-allocation-p0-001`。
