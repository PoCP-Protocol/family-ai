# LEGACY FAMILY-LEGACY-UI-FULLSTACK-REBASELINE-001

> Historical evidence only. Current execution SSOT is `governance/FAMILY_CONSUMER_UI_BASELINE_V1.json` plus `architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md`.

## Objective
以现有 UI-01..UI-35 为不可随意改变的展示基线，反向完成 Family AI 全栈架构与后端能力，实现：
- 前端展示能力 = 后端真实能力；
- 文档声明 = 代码 + DB + 测试证据；
- 35 页共享少量稳定 Domain，不产生 35 套后台；
- AI诊断保留，并进入统一 Family AI Control Plane。

## Current base
`main@708cf542ab130642f2248bbebecc997930d10a49`

## Do not
- 不直接 push main。
- 不 auto merge。
- 不把 DEV no-op / fixture / local draft 写成“已实现业务能力”。
- 不新增 Mobile 直连模型。
- 不新增 Mobile canonical DB。
- 不把 AI诊断写成 Child Fact。
- 不为了后端方便改掉 legacy UI 基线。

## First increment
本补丁建立 G0 Alignment Foundation：
1. legacy UI machine matrix。
2. Shared implementation contracts。
3. Alignment validator。
4. Full-stack architecture。
5. Program gates。

G0 完成后，必须按 G1→G7 clean-forward 实现真实业务；只有 G7 strict validator + E2E 通过，才允许声称“legacy UI 后端完全实现”。

## STOP Gate
```text
TASK = FAMILY-LEGACY-UI-FULLSTACK-REBASELINE-001
BASE_SHA = 708cf542ab130642f2248bbebecc997930d10a49
AUTO_MERGE = NO
AGENT_SELF_AUTHORIZATION = NO
RESULT = PASS_CANDIDATE | HOLD
NEXT = ARCHITECT_REVIEW_REQUIRED
```
