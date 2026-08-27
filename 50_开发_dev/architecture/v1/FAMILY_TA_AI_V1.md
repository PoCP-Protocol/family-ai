# Family Technical And AI Architecture V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

## 运行面

```text
Experience
→ API / Projection / Named Action
→ Domain Truth
→ Outbox / Workflow
→ AI Intelligence Plane
→ Data / Knowledge
```

横向控制面覆盖 Identity、Family Scope、Consent、Policy、Human Gate、Audit、Eval、Cost 和 Secrets。

## AI 原生能力

| 能力 | 责任 | 禁止 |
| --- | --- | --- |
| Model Gateway | 统一模型访问、结构化输出、provider 替换 | 应用直连模型 provider |
| Trusted Context Broker | 最小化上下文、权限裁剪、来源标签 | 把完整家庭档案无边界送入模型 |
| Knowledge/RAG | 证据检索与引用 | 用 E1 材料证明效果成立 |
| Method Registry | 可版本化的方法与干预策略 | 页面内硬编码专业方法 |
| Intervention Library | 低剂量行动模板 | 自动声称行动有效 |
| Skill Runtime | 专业能力编排 | 绕过 consent/policy 执行 |
| Agent Runtime | 多步任务协作 | 直接改 canonical truth |
| Safety Policy | 风险识别与升级 | 高风险继续普通对话 |
| Eval Runtime | 离线/在线评估 | 没有 Outcome 就宣称 AI 功能完成 |
| ModelRun Ledger | 记录、回放、审计 | 无 trace 的模型输出 |
| Codex Harness | 代码/工具边界 | 执行 SQL 或直接写核心对象 |

## 写入链路

```text
WRITE = Command
→ Auth
→ Family Scope
→ Consent
→ Policy
→ Idempotency
→ Named Action
→ Domain Service
→ PostgreSQL
→ Event
→ Audit
```

READ 只能返回 Projection。AI 可以准备 proposal，但 `may_mutate_business_state=false`。