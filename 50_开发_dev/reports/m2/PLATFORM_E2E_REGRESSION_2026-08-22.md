# Family AI 平台端到端自动化回归报告

> **执行日期：** 2026-08-22
> **环境：** 本地隔离 Test PostgreSQL（`family_test`）；Dev/Test 受控外部效果策略
> **结论：** 通过（`PASS_WITH_LOCAL_TESTDB_RUNNER`）

## 本轮变更范围

本轮没有创建平行系统或新的领域模型。UI-21 的服务预约领域命令、UI-23 的活动兴趣操作以及此前 UI-13 至 UI-24 的商业和服务动作，均通过现有家庭范围受控操作回执投影进入同一运营队列。所有回执均保留页面来源、状态、来源类型与 `external_effect=false`。

运营控制台在既有“运营工作台”中增加了家庭回执列表。该列表只在已有 Bearer 家庭会话时从现有 Family API 读取；支持按 UI 页面和回执状态筛选，且不在浏览器中创建授权、租户或写入路径。

| 验证项 | 结果 | 证据 |
|---|---:|---|
| UI-21 预约领域命令进入运营队列 | 通过 | `DOMAIN_COMMAND_ADAPTER`、`UI-21`、`CONFIRMED`、`external_effect=false` |
| UI-23 活动兴趣进入运营队列 | 通过 | `TEST_FIXTURE`、`UI-23`、`EVENT_REGISTRATION`、`external_effect=false` |
| 控制台回执页面筛选 | 通过 | UI-21 页面筛选、`CANCELLED` 状态筛选及空结果交互断言 |
| 租户与家庭范围 | 通过 | 读取继续由既有 Bearer、成员资格、tenant policy 与 Family Scope Guard 校验 |

## 自动化结果

| 测试层级 | 命令或配置 | 结果 |
|---|---|---:|
| 工作区构建与类型检查 | `build`、`typecheck` | 22/22 工作区任务通过 |
| Web 全量自动化 | `@family/web test` | 23 文件、147 测试通过 |
| API 单元与契约 | `vitest.unit.config.ts` | 35 文件、193 测试通过 |
| Test PostgreSQL 集成 | `vitest.integration.config.ts` | 21 文件、100 测试通过 |
| API 端到端 | `vitest.e2e.config.ts` | 17 文件、133 测试通过 |
| UI-21/UI-23 聚焦持久化 | 服务预约 + 测试体验集成 | 2 文件、8 测试通过 |
| 控制台回执筛选交互 | 平台控制台聚焦测试 | 2 文件、7 测试通过 |

## Test PostgreSQL 说明

工作区默认的 `test:required` 脚本在调用 `tools/testdb.mjs reset` 时依赖 Docker；本环境没有 Docker 可执行文件，因此该编排步骤返回 `spawn docker ENOENT`。为保证真实数据库验证不被跳过，已在本地 PostgreSQL 中重建隔离 `family_test` 数据库、应用全部 39 个迁移，并通过同一 `TEST_DATABASE_URL` 依次执行完整集成与端到端配置。

这不是产品逻辑失败。后续 CI 环境应提供 Docker，或将 `tools/testdb.mjs` 扩展为可显式选择现有 PostgreSQL 连接串的执行器，以保留一条统一的 `test:required` 命令。

## 运营边界回归

所有本轮动作均保持为 Dev/Test 受控记录。系统没有执行支付、退款、真人预约、活动资格确认、外部通知、外部分享或权益扣减；回执仅用于当前家庭和当前租户范围内的操作回看与运营跟进。

## 后续建议

下一轮应在 CI 中恢复完整 Docker TestDB 编排，并为 UI-22 沙龙、UI-24 服务取消及 UI-13 至 UI-18 的更多领域命令增加同源运营队列覆盖。运营控制台可继续增加日期范围、来源类型和家庭授权状态筛选，但仍应复用当前回执投影和服务端范围校验。
