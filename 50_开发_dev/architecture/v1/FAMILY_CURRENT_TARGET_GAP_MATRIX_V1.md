# Family Current Target Gap Matrix V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

| 领域 | Current | Target | Gap | 首批动作 |
| --- | --- | --- | --- | --- |
| UI baseline | 代码已接近 UI-01..UI-34，但部分文档仍有 UI-35 历史口径 | UI-35 从页面、路由、截图、验收中删除 | 历史命名和文档残留 | 修正 active docs、contracts export、validator gate |
| Scenario method | 局部按页面和功能推进 | 所有工作先归入 8 个场景 | 场景到 4A 的代码契约不足 | 在 contracts 增加 `FAMILY_34UI_SCENARIO_4A_MAPPING` |
| BA | 用户流程已有碎片 | 业务对象和场景链统一 | 21-Day 曾被当 UI 页面 | 改成 ProductOffering/Entitlement/ProgramEnrollment 链路 |
| DA | Projection 与 draft 混用仍需收敛 | Fact/Perspective/Hypothesis/Recommendation/Decision/Action/Outcome 分层 | AI 输出可能被误读为事实 | 强化 contract 和文档边界 |
| AA | Mobile/Web 已共享 34UI registry | 页面只承载场景，不拥有业务真相 | 历史 35UI 文件名残留 | 新增 34UI contract，后续清理历史文件名 |
| TA/AI | Harness 与 Gateway 边界已启动 | Gateway/Context/Eval/Ledger/Human Gate 全链路 | 仍缺完整 runtime implementation | 先冻结架构契约，再按 task 开发 runtime |

## 当前不做

- 不改数据库 schema。
- 不引入微服务拆分。
- 不接真实支付、真实外发或真实专家履约。
- 不推送蒸馏数据或大模型运行输出。