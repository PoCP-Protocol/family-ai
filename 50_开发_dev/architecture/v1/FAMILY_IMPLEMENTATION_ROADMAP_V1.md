# Family Implementation Roadmap V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

## Phase 1: Rebaseline

1. 删除 active UI-35 页面/路由/contract/export 口径。
2. 冻结 UI-01..UI-34 产品基线和场景映射。
3. 让 validator、registry、docs、contracts 同步表达 consumer UI baseline。
4. 运行 `validate:consumer-ui` 和 contracts typecheck。

## Phase 2: Scenario Contracts

1. 将八个场景映射为共享 contracts。
2. 为 SCENE-03 建立 21-Day Program 的 ProductOffering、Entitlement、ProgramEnrollment、DailyAction、ServiceRecord contract。
3. 为 SCENE-05 建立 AI proposal envelope，确保 `may_mutate_business_state=false`。

## Phase 3: Runtime Slices

1. 先做 SCENE-01/02/03 的端到端最小链路。
2. 再补 SCENE-04 90-Day Journey 与 SCENE-06 Human Service。
3. 最后收敛 SCENE-07/08 的社区、商业与资产状态。

## Phase 4: Validation

1. 每个场景至少一个 API/contract test 和一个 Mobile/Web parity test。
2. AI 能力必须有 eval、ledger、policy、high-risk gate 验证。
3. 视觉回归只针对 UI-01..UI-34。

## GitHub Sync Rule

每个可验证补丁通过聚焦验证后提交并推送；蒸馏数据、模型运行 JSON、大截图批量产物不随代码提交。