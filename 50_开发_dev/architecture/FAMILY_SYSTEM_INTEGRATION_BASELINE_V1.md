# FAMILY 系统架构整合基线 (V1)

`schema_version: FAMILY_SYSTEM_INTEGRATION_BASELINE_V1`
`layered_on: FAMILY_AI_PLATFORM_V4_1`
`as_of: 2026-08-23`
`baseline_sha: 7959929 (PR#2 head, V4.1)`

## 0. 这份文件是什么 / 不是什么

- **是**:把"3 份 PPT 产品口径 → 35UI → 六循环 / 七域 → 前端 / 后端 / 契约"收敛成**单一、可机检**的整合基线,叠加在架构师 V4.1 之上。
- **不是**:不覆盖、不修改 V4.1(`FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` 为上位架构)。不建新业务端点、不解除任何 Gate、不改判 `PROGRAM_MODE`。
- **权威序**(承 `governance/TRUTH_HIERARCHY.md`):Runtime/DB → GitHub → registry → Gate 证据 → 本文件。本文件低于运行时真相;所有状态以 `FAMILY_35UI_CONSISTENCY_MATRIX_V1.json`(实测)为准。
- 配套机器契约:`governance/FAMILY_35UI_CONSISTENCY_MATRIX_V1.json`(实测)+ `.md`(人读);校验器 `tools/validate-35ui-consistency.mjs`。

## 1. 产品口径基线(3 份 PPT,证据上限 E1)

来源:`30_素材_materials/_extracted/逐页文本_含页码/`(S1 战略白皮书 / S2 新商业模式 / S3 大模型平台合作方案)。
**红线**:PPT 定义"要建什么"(产品口径,E1);其**效果/商业断言**(完课率、续费率、百亿估值、黑灯工厂)一律 `HYPOTHESIS`,不得当事实,不入 Ontology Fact 层。

经营对象:从"一次成交的课程客户"升级为"持续成长的家庭 Family"。旅程六阶段 → 六业务循环 → 35UI:

| 旅程阶段(S2 p7) | 核心场景 | 业务循环 | 主要 UI |
|---|---|---|---|
| 触发 | 内容/沙龙/测评入口 | ASSESSMENT / SERVICE | UI-07, UI-22 |
| 觉醒 | 测评 + AI 诊断 | ASSESSMENT | UI-02, UI-03, UI-08 |
| 行动 | 21 天挑战 + 每日任务 | PLAN / GROWTH | UI-35, UI-09, UI-04 |
| 改变 | 90 天计划 + 顾问 + 社群 | PLAN / SERVICE / COMMUNITY | UI-05, UI-11, UI-19~24, UI-25~28 |
| 长期 | 年度会员 + AI 管家 | COMMERCE | UI-06, UI-18, UI-30, UI-32 |
| 传播 | 成长报告 + 邀请 + 身份 | COMMERCE / COMMUNITY | UI-12, UI-15, UI-16, UI-17 |

六层收入模型(S2 p17 / S1 p8,均为**口径**,占比目标为 `HYPOTHESIS`):测评(免费获客)→ 21 天(体验)→ 90 天(核心)→ 年度会员+AI 助手(订阅)→ 咨询/沙龙(服务)→ 专家/城市伙伴(生态)。
5 类 AI Agent(S1 p17):家长顾问 / 孩子陪练 / 助教助手 / 成长规划师 / 经营助手 —— 在 V4.1 里统一为 `ai_use_cases` + `skills`,经 `FAMILY_LLM_GATEWAY`(过渡)→ 目标 `FAMILY_AI_CONTROL_PLANE`,**只产 Hypothesis/Draft,不直写 canonical**。

## 2. 前端 canonical 裁决(owner 定)

- **canonical 产品前端 = `apps/mobile`(Expo)**,已承载完整 35UI(`apps/mobile/lib/family/ui-registry.ts`,实测 35/35)。
- **`apps/web` 定位 = 运营/控制台**(operator/console),**不承载 35UI 消费者页面**(实测 `web_35ui = 0/35`,仅 login/onboarding/today/growth/principal/family 等 legacy 路由)。据此 `web` 不构成"第二业务前端",守 `NO_SECOND_BUSINESS_BACKEND` 语义(两者共用同一 `apps/api` + PostgreSQL 真相)。
- web 若日后要承载 35UI,须在一致性矩阵新增 `web_route` 列并逐 UI 落地,属后续授权项(非本基线范围)。

## 3. 后端七域逻辑映射(现状=技术分层,物理重组延后 G2)

现有 `apps/api/src/modules/` 按**技术分层**组织(auth/family/orchestration/principal/waf),非按七域。本表建立**逻辑归属**(不移动代码):

| V4.1 业务域 | 现承载模块(逻辑) | 说明 |
|---|---|---|
| FAMILY_CORE | `family` (family/onboarding/consent) + `auth` | 身份/成员/同意/可见性;`GrantConsent` 已实现 |
| GROWTH_INTELLIGENCE | `family` (growth-priority/evidence-synthesis) + `orchestration` (intents) | 测评/诊断多为 GATE_BOUNDARY |
| GROWTH_JOURNEY | `family` (journey-plan/growth-action/today) + `principal`/`program-runtime` | 计划/行动/任务/21 天营 |
| RESOURCE_NETWORK | `orchestration` (family-page-objects) | 资源目录/资格,READ_ONLY |
| SERVICE_OS | `orchestration` (family-service-booking) | 预约/服务案例 |
| COMMERCE_ENTITLEMENT | `orchestration` (commerce-intent/membership-entitlement/product-event) | 会员/订单/权益 |
| CONTENT_COMMUNITY | `orchestration` (page-objects) + `waf` | 小记/社区/审核;UI-27 NOT_IMPLEMENTED |
| 跨域平台 | `FAMILY_CONTEXT_PLATFORM` | 只读/组合/检索,不拥有 canonical 写 |

**物理按域重组 = G2 项**,须架构师授权;本基线只固化逻辑映射,防止"UI 声称域 owner 但代码无归属"。

## 4. 一致性实测结论(以 CONSISTENCY_MATRIX 实测为准)

| 维度 | 实测 |
|---|---|
| canonical 前端(mobile)覆盖 | **35/35** |
| web 35UI 覆盖 | **0/35(ABSENT_BY_DESIGN)** |
| 契约(`family-35ui.ts`)覆盖 | **35/35** |
| named_actions declared(矩阵) | **56** |
| named_actions defined_in_specs(`specs/actions/`) | **3** |
| named_actions implemented(后端 guard 精确) | **3**(`REQUEST_GROWTH_HELP`→UI-01 / `CONFIRM_GROWTH_INTENT`→UI-03 / `GRANT_CONSENT`→UI-33) |
| **词汇分歧 naming_divergence** | **44**(见矩阵 MD) |
| 判定分布 | BACKEND_WIRED 2 / PARTIAL_BACKEND 1 / READONLY_BY_DESIGN 7 / DECLARED_ONLY_GATED 25 |

**头号缺口 = 动作词汇三分裂**:同一批 Named Action 在三处用三套词汇,归一化后基本不互认——
1. 35UI 矩阵:`SCREAMING_SNAKE`(如 `COMPLETE_GROWTH_ACTION`),56 个;
2. `specs/actions/*.action.yaml`(权威注册表):`PascalCase`(如 `CompleteGrowthAction`),13 个;
3. 后端 guard `@Require*Action`:`PascalCase` 简写(如 `CompleteAction`),21 个。

56 个声称动作里,只有 **3** 个在 specs 注册表、**3** 个有后端 guard。这是"前后端不一致 / 文档与代码不一致"的**根因**。
**裁决请求(架构师)**:确立**唯一权威动作词汇表**(建议以 `specs/actions/` 为 canonical,矩阵与后端 guard 都对齐它,并登记 SCREAMING_SNAKE↔PascalCase 显式别名),否则 UI→Named Action→端点 的映射永远靠人脑推断。逐条候选见 `FAMILY_35UI_CONSISTENCY_MATRIX_V1.md`。

## 5. 两治理叙事桥接(承 `00_复盘/2026-08-23`)

仓库并存两套词汇:继承线 `PROJECT_STATUS.md` 的 `M3_MOS_CLOSEOUT`,与 G0/V4.1 门禁线。对照:

| M3 MOS 线 | G0/V4.1 门禁线 | 关系 |
|---|---|---|
| M1 Family Core CLOSED | G0 ALIGNMENT_FOUNDATION | M1 真实 PG 后端 = 35UI 后端的少数 REAL 部分 |
| M2/M3 MOS 收口 | G1-A(V4.1 收敛)| 两者描述同一代码库不同切面 |
| `PROGRAM_MODE=M3_MOS_CLOSEOUT` | G1-B/G1-C HOLD | **口径从属未裁决** |

**裁决请求(架构师)**:`PROGRAM_MODE` 以哪条线为唯一权威?本基线不改判,仅登记映射。

## 6. 明确不做(留待授权)

- 不补 35UI 后端 named_action/projection(G1-B/G1-C/G2,须 authorized-base-sha)。
- 不让 web 承载 35UI。
- 不实现 pgvector/Redis/Temporal/Python 侧车/Outbox(架构承诺属 G1-C,当前代码无)。
- 不统一 named_action 词汇(须架构师裁决后另行执行)。
