# Family Application Architecture V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

## 应用组成

| 应用面 | 职责 | 当前落点 |
| --- | --- | --- |
| Mobile / Web Consumer | 34 个家庭用户页面、五 Tab、场景化入口 | `apps/mobile` |
| Family API | REST/OpenAPI、Projection、Named Action | `apps/api` |
| Shared Contracts | UI、场景、领域与 AI 边界类型 | `packages/contracts` |
| Harness | Codex/Agent 只读和提案边界 | `packages/harness` |

## 页面基线

UI-01..UI-34 是唯一 consumer UI baseline。所有页面必须登记在 `apps/mobile/lib/family/ui-registry.ts`，并由 `tools/validate-35ui-alignment.mjs` 的 34UI gate 验证。

## 路由与场景

| 场景 | 路由要求 |
| --- | --- |
| 21-Day Program | 不存在 `/ui/UI-35`；入口落到 UI-14，行动落到 UI-09，进度落到 UI-31，记录落到 UI-34 |
| AI Companion | 只能嵌入具体场景屏，不作为无限制聊天首页 |
| Commerce | Dev 环境只能表达 intent、sandbox entitlement 和 asset projection |
| Community | 默认私有草稿，公开动作需要审核 Gate |

## 测试要求

移动端和 Web parity 测试必须覆盖：UI-35 不可达、34UI 注册完整、21-Day 入口不写 UI-35 flow event、核心写入走 Named Action。