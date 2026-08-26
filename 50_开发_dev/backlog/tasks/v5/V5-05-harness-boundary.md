# V5-05 Harness Boundary (CONTRACT_ONLY / NOT_RUNTIME_AUTHORIZED)

status: CONTRACT_ONLY_PROPOSED_FOR_REVIEW

## 目标
定义并验证 `FamilyHarnessAdapter` 是 Family Intelligence Use Case 与 Codex App Server 之间的唯一边界，确保 Codex 不拥有 Family business truth。

## 范围
固化 Family API → Intelligence Runtime → FamilyHarnessAdapter → Codex App Server JSON-RPC 的输入输出、approval/resume、错误拒绝和 proposal-only write 语义；列出允许的 domain read/proposal/review tools 与禁止的 raw infrastructure tools。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/harness/`、`50_开发_dev/architecture/orchestration/` 中明确命名的 boundary 文档/接口契约，以及 `50_开发_dev/evals/harness/` 下的 mock/contract tests。不得修改既有文件。

## 依赖
依赖 V5-01 至 V5-04、现有 Harness boundary V0.1、Named Action、Model Gateway 和 Human Gate 原则。

## 非目标
不实现 Codex App Server 生产启用、UI→Codex、Codex→SQL、agent canonical mutation、通用 autonomous agent fleet、外部 Codex 源码修改或 DB migration。

## 验收
adapter 输入输出、approval/resume、proposal-only、deny/fail-closed、trace 和 audit 约束可测试；测试拒绝 `execute_sql`、`update_table`、generic core patch 等工具；明确只有 Domain Core 记录 canonical truth。

测试通过、mock 可运行或合同完成均不构成 Codex App Server 访问授权，也不构成 runtime、pilot 或 production 授权。

## 回滚
删除或 revert boundary contract、mock harness path 和 eval；恢复现有 Family API boundary，不影响既有业务数据和 runtime。

## 授权门
需 V5-01 至 V5-04、Harness/Agent Foundation 独立 gate 及总架构师书面授权；未通过不得开放 Codex 访问。

## 风险
边界适配器可能被绕过；proposal 与 decision/action 混淆会造成未经确认写入；approval/resume 重放可能产生重复 action 或审计断裂。
