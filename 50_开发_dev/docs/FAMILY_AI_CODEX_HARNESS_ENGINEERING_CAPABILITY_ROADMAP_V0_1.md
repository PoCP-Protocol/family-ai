# Family-ai Codex Harness 工程能力研究与路线 V0.1

## 1. 定位

本文定义 Family-ai 如何吸收 Codex Harness 开源项目体现的工程方法,提升研发、评测、资产生产与安全回归能力。

当前结论:

> Codex Harness 不是 Family 的业务模型,也不是产品运行时。它适合作为工程控制面、评测工厂、模型资产生产线和受控自动化执行器。

Family 的核心边界保持不变:

- 家庭业务状态仍由 Family API、Named Action、Policy、Audit、Idempotency 控制。
- 模型调用仍必须经过 Model Gateway。
- Ontology 与核心状态不得由 AI 自由文本直接写入。
- 未成年人、高风险家庭场景、诊断倾向与外部效果承诺必须继续走 Human Gate 或 fail-closed。

## 2. 可增强的能力

### 2.1 Development Harness: UI 与业务链路开发工厂

目标是把 UI01-UI35 的开发从一次性手工修页面,升级为可重复的工程循环。

可做事项:

- 读取 UI 基线、路由、截图、交互约束和测试文件。
- 生成差异清单,标明视觉、文案、交互、数据投影和安全边界差距。
- 限定文件范围后执行代码修改。
- 自动运行 `check`、专属测试、浏览器 smoke、路由跳转验证。
- 输出结构化报告:改了什么、验证了什么、还不能证明什么。

首批适用对象:

- UI01 首页 6 宫格与 UI14 商品详情链路。
- UI02 免费家庭测评答题、结果页、安全边界。
- UI04 计划草案、UI05-UI09 今日任务与打卡链路。
- UI14 21天挑战营商品详情。

### 2.2 Model Asset Harness: Family 教育模型资产工厂

目标是把 Family 自有领域资产从散落文档变成可验证、可版本化、可回归的资产系统。

可做事项:

- 生成和维护 domain / need / construct / action / outcome registry。
- 校验 YAML / JSON Schema / OpenAPI / TypeScript contract。
- 将 5 个免费测评主题沉淀为 item bank、解释 schema、家长语言模板。
- 将专家场景卡转成 golden cases 和 review batch。
- 生成 distillation dataset,但必须带 provenance、evidence boundary、PII minimization gate。

已有入口:

- `pnpm run harness:family-model`
- `pnpm run harness:family-model:distill-full`
- `pnpm run validate:model-assets`
- `pnpm run eval:family-model`
- `pnpm run eval:family-memory`

### 2.3 Evaluation Harness: 安全与质量回归

目标是把 Family 的硬规则变成自动测试门。

必须覆盖的 gate:

- no_total_score_gate: 不生成家庭总分。
- no_ranking_gate: 不做家庭或孩子排名。
- no_diagnosis_gate: 不输出诊断、治疗判断或疗效承诺。
- perspective_fact_gate: Perspective、Hypothesis、Recommendation、Decision、Action 必须分层。
- evidence_boundary_gate: E1 自家材料不能证明自己;推算和 unverified 不能支持“成立”。
- human_gate_gate: 高风险场景必须提示人工介入或阻断。
- named_action_gate: 业务状态变更必须走 Named Action。

首批评测对象:

- UI02 免费测评输出。
- UI02-result 免费结果解释。
- UI03 AI 诊断入口边界,但不由当前 UI02 任务直接开发。
- 21天挑战营商品文案中的效果边界。
- Family Principal / 家庭顾问回复的安全边界。

### 2.4 Runtime Faithful Harness: 真实链路验证

目标是避免“测试通过但绕过真实运行时”。

可做事项:

- 创建 synthetic family / member / session。
- 通过真实 API 签发 dev token。
- 调用真实 Named Action。
- 读取真实 projection。
- 在浏览器打开 UI 页面,验证页面读取的是业务投影,不是 mock 文案。
- 输出 correlation_id、idempotency_key、HTTP 结果、浏览器状态与截图证据。

适用链路:

- UI01 首页投影。
- UI02 免费测评提交。
- UI04 计划草案生成。
- UI09 今日任务打卡。
- UI14 商品详情与 intent draft,但不触发真实支付。

### 2.5 Governance Harness: 受控代理执行与审计

目标是让 AI 工程协作可批准、可追踪、可回滚。

每个 harness task 必须声明:

- task_id、目标、输入资产、允许文件、禁止文件。
- 可运行命令白名单。
- 是否允许联网,默认不允许。
- 是否允许写 DB schema,默认不允许。
- 是否允许调用 live external AI,默认不允许。
- 验收命令和失败退出条件。
- 产出报告路径。

每次运行必须记录:

- 基线 commit 或工作树状态。
- 输入资产哈希。
- 修改文件清单。
- 命令、退出码、stdout/stderr 摘要。
- 浏览器验证结果。
- 人工批准、拒绝或退回原因。

## 3. 推荐优先级

### P0: 先固化 UI02 免费测评 Harness

原因: UI02 是当前产品主入口之一,且已经涉及题库、解释、安全边界、API 提交和结果页。

交付物:

- `tools/run-ui02-assessment-harness.mjs`
- `reports/ui-harness/ui02-assessment-harness-run.latest.json`
- UI02 题库覆盖报告。
- UI02-result 边界文案报告。
- 浏览器 smoke: 填答 5 主题中的至少 1 个主题并进入免费结果页。

验收:

- `pnpm --dir apps/mobile check`
- `pnpm --dir apps/mobile test -- tests/ui02-assessment-baseline.test.ts`
- no total score / no diagnosis / no ranking 文案 gate 通过。

### P1: 固化 UI01 到 UI14 的 21天挑战营链路 Harness

原因: 这条链路已经完成页面修正,适合作为轻量级成功样板。

交付物:

- `tools/run-camp21-ui-harness.mjs` 扩展或新增报告项。
- 验证 UI01 6 宫格存在 `21天挑战营`。
- 点击后到达 `UI-14?productRef=PRODUCT_PARENT_CHILD_CAMP`。
- 验证 UI14 展示 `21天亲子沟通挑战营`。

验收:

- UI14 baseline test 通过。
- 浏览器 smoke 通过。
- 商品文案不含疗效承诺或诊断暗示。

### P2: 建立 5 主题测评研究到题库的资产管线

原因: 用户已经明确要求免费测评 5 个主题必须深入研究后才能完善功能。

交付物:

- 5 个主题研究卡。
- source registry 与 evidence boundary。
- item bank registry。
- interpretation schema。
- UI02 题目与 UI02-result 解释绑定表。

验收:

- 每个主题至少有外部真实来源支撑。
- 自家材料只作为 E1 背景,不用于证明有效。
- 未验证、推算、模拟来源只能生成假设,不能生成“成立”结论。

### P3: Runtime Faithful Family Session Harness

原因: Family 的工程能力必须能证明页面连接真实业务链路。

交付物:

- synthetic family fixture。
- dev bearer/session bootstrap。
- API Named Action 执行报告。
- UI projection 浏览器验证报告。

验收:

- 不访问生产数据。
- 不触发支付、推送、真实外部服务。
- 能复现读投影、写 action、再读投影的闭环。

## 4. 不建议做的事

短期不建议:

- 直接把 Codex Harness 放进移动端 App。
- 让 Codex 或任何 agent 读取真实家庭数据。
- 让 agent 直接改生产数据库、支付、通知、分享、推荐分发。
- 让 agent 自动合并、自动发布、自动创建生产配置。
- 用 harness 输出替代专家裁决或家长确认。

这些做法会把工程放大器误用成业务决策器,与 Family 的安全边界冲突。

## 5. 目标架构

```text
Family-owned assets
  - 规格 / 题库 / registry / scenario / evidence / policy
        ↓
Harness control plane
  - task spec
  - allowed files
  - command whitelist
  - deterministic validators
  - browser smoke
  - review report
        ↓
Human review gate
  - accept / reject / revise
        ↓
Family runtime
  - API / Named Action / projection / Model Gateway
```

## 6. 下一步执行建议

建议从 P0 开始,不要先追求通用大平台。

第一张任务卡:

```text
TASK: UI02_ASSESSMENT_HARNESS_P0
Objective: 为免费家庭测评建立可重复运行的本地 harness。
Scope: UI02、UI02-result、题库布局、现有 baseline test、浏览器 smoke。
Forbidden: UI03 诊断开发、真实家庭数据、生产模型调用、DB schema 变更。
Outputs: harness 脚本、latest json 报告、失败样例清单。
```

完成 P0 后,再把 P1 的 21天挑战营链路纳入同一套 UI harness 规范。

## 7. 成功标准

Family-ai 工程能力增强不是“能让 AI 写更多代码”,而是能稳定做到:

- 每个能力都有 task spec。
- 每次改动都有可复现验证。
- 每个模型资产都有 schema、来源、评测和审计。
- 每个用户可见结论都有边界说明。
- 每条业务状态变化都能追到 Named Action。
- 每个高风险场景都能 fail-closed 或进入 Human Gate。

这才是 Codex Harness 类开源项目对 Family-ai 最有价值的吸收方式。