# Family AI 独立家庭成长平台系统基线

## 系统定位

`family-ai` 是独立的 **Family Growth AI Platform**，不是原始 Family 仓库的临时分支，也不是若干静态页面的集合。系统以家庭 `Family` 为持续成长主体，围绕家庭成长旅程、父母行动、孩子参与、家庭关系和服务协同形成可追溯的数字化成长系统。

本仓库包含当前可访问的 Family 项目规格、知识、研究、素材、派生产出、业务代码、数据库迁移、契约、测试、前端资源和历史开发记录。后续功能开发、数据迁移、测试、架构调整和发布验证，均以本仓库为独立基线。

## 独立系统目录

| 层次 | 目录 | 作用 |
|---|---|---|
| 规格与治理 | `10_规格_spec/`、`governance/` | 产品、业务、技术、AI 和门禁约束 |
| 知识与研究 | `20_知识_knowledge/`、`25_研究_research/` | 证据、方法、假设与研究输入 |
| 原始素材 | `30_素材_materials/` | 只读素材及抽取文本，保留 provenance |
| 派生产出 | `40_产出_derived/` | 研究解读、结构化产出和视觉分析 |
| 开发系统 | `50_开发_dev/` | API、Web、packages、数据库、契约和测试 |

## 六个业务循环

独立系统以以下六个循环作为业务骨架：

1. **成长循环**：家庭进入、测评、成长关注点、行动和回读。
2. **计划循环**：90 天成长计划、阶段、每日行动、阶段复盘和家庭确认。
3. **评估循环**：观察、观点、证据边界、成长回顾和下一步建议。
4. **服务循环**：支持主题、专家目录、咨询需求、活动意向和服务记录。
5. **商业循环**：商品意向、会员方案、权益、积分、续费意向和资产回读；Dev 环境保持无支付、无扣款、无外部履约。
6. **社区循环**：家庭小记、私有分享草稿、内容回读和可见性控制；发布、互动和通知必须经过受控动作与人工边界。

## AI-native 系统原则

系统中的数据必须区分 **Fact、Perspective、Recommendation 和 Action**。AI 或规则引擎可以生成解释、候选建议和下一步提示，但不得自由文本直写核心本体。核心状态变化必须通过 Named Action、Consent、Human Gate、Ontology Adapter、Audit Event 和 Idempotency 机制完成。

当前 Dev 环境可以使用 synthetic fixture 和 no-op adapter，但必须明确标注其来源和边界。反思内容属于家庭 Perspective，不得直接当作 Fact、Outcome、因果结论、诊断、总分或家庭排名。

## 当前开发入口

```bash
cd 50_开发_dev
pnpm install
pnpm --filter @family/api test
pnpm --filter @family/web test
node tools/validate-contracts.mjs
```

真实 PostgreSQL 集成测试使用 `TEST_DATABASE_URL`。数据库迁移位于 `50_开发_dev/database/migrations/`，API 入口位于 `50_开发_dev/apps/api/`，Web 入口位于 `50_开发_dev/apps/web/`。

## 当前首个真实纵切

首个真实纵切是 **Family Today and Daily Task Check-in**，覆盖 UI-01 与 UI-09：

```text
FamilyTodayProjection
  -> TodayTaskProjection
  -> CompleteGrowthAction
  -> TaskCheckinResultProjection
  -> Next Hint / Family Readback
```

该纵切是后续 Family Digital Twin、Growth OS、Intervention Library 和 Agent/Model Gateway 接入的基础，不代表 34/35 个 UI 已全部完成。

## 后续开发要求

后续开发以纵切方式推进，每轮遵循 Plan–Do–Check–Act，完成后记录测试与数据血缘，并提交到 `family-ai`。新增功能必须优先复用已有对象、权限、审计、幂等和投影层，不得重新建立孤立页面或孤立数据模型。UI-35 21 天成长营作为独立课程与干预编排能力接入成长循环，不改变家庭核心本体的安全边界。
