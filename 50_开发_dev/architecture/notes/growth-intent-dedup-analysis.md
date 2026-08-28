# GrowthIntent 概念"疑似重复实现"核验分析

DOC_KIND = ANALYSIS_NOTE(核验既有调研结论,不含代码改动)
TASK_REF = 承接 batch2-domain-research-v1.md 第3.1/9节发现的问题
SOURCE_ROOT = 50_开发_dev/apps/api/src/modules/family/, 50_开发_dev/apps/api/src/modules/orchestration/,
              50_开发_dev/database/migrations/
DATE = 2026-08-28
STATUS = FACT_FINDING + 建议,**不含任何删除/迁移代码改动**

---

## 0. 结论先行

Batch 2 调研文档(`batch2-domain-research-v1.md` 第3.1节)提出的问题——"GrowthIntent 概念
在 NestJS 代码里有两套互不关联的持久化实现"——**表面属实，但核验后发现这不是简单的"同一概念
两套重复实现该去重"，而是两个不同业务子域各自独立演化出的概念，只是共用了相近的命名**。
两套实现：

- 都是**当前生效代码**（不是遗留废弃），都被真实的 controller/service 调用链引用；
- 表结构、写入语义、状态机、调用方完全不同，之间**没有任何外键、JOIN 或函数调用互相引用**；
- 本质上分属两个不同的业务域：一个是"资源编排/推荐"域的内部状态记录（`growth_intents`），
  一个是"家长确认成长优先方向"域的核心业务对象（`growth_priorities`）。

**核验结论：这不是需要"合并成统一方案"的重复实现，而是命名撞车导致的语义混淆。** 建议不做
表结构合并，而是在 Python 迁移时**重命名其中一个概念**以消除命名歧义，同时忠实保留两套各自
独立的业务语义（迁移原则：忠实复刻语义陷阱，不能因为名字像就臆造出一个不存在的"统一
GrowthIntent"）。

---

## 1. 两套实现对比表

| 维度 | (A) `growth_intents` 表 | (B) `growth_priorities` 表 |
|---|---|---|
| 建表迁移 | `0020_growth_orchestration_v1.sql`（首次建表）+ `0041_ui03_growth_hypothesis_confirmation.sql`（追加字段） | `0003_growth_foundation.sql`（首次建表）+ `0008_m2_wave2_priority_intervention_action.sql`（大改） |
| 主要写入方 | `orchestration.service.ts`（`modules/orchestration/`）：直接手写 SQL `insert into growth_intents(...)` / `update ... set status='CLOSED'` | `growth-priority.service.ts`（`modules/family/`）的 `confirmGrowthPriority` 方法 |
| 次要写入方 | `growth-hypothesis.service.ts` 的 `decide` 方法（Assessment 域 CONFIRM 决策时写入，走的是与 orchestration.service.ts 不同的另一条插入路径，字段结构相同但代码路径独立） | 无其它写入方 |
| 业务语义 | "资源编排/推荐"运行时的内部状态记录：家庭在收到一个"需求信号(need signal)"后，系统据此生成一条 intent，用于驱动后续的资源匹配/Offer 推荐/执行派单（`orchestration.service.ts` 文件头注释自称"编排 runtime 服务"、"RANKING≠ORCHESTRATION"），intent 的 CLOSE 由 `NO_ACTION_SELECTED` / `SERVICE_DELIVERED` 两种原因触发 | "家长确认成长优先方向"：Onboarding 完成后，家长在多个候选成长维度（P03/R03/R04/R05 等）中确认一个作为当前优先方向，是 Wave2 GOLDEN_GROWTH_LOOP 主链路里驱动后续 Intervention 和 90 天 JourneyPlan 的**根对象** |
| 状态机完整度 | 有 CLOSE 逻辑（`orchestration.service.ts` 里能把状态改为 `CLOSED`），但迁移文档记录的 `growth-hypothesis.service.ts` 写入路径本身**没有**后续生命周期管理代码，状态字段插入后长期停留在 `OPEN`（两个写入方对状态机完整度贡献不对等，需按写入方分别评估，不能一概而论） | 有完整版本链：`supersedeActivePriority`（旧记录标记 `SUPERSEDED`）+ `insertPriority`（新记录 `version = 前一条 + 1`，`previous_priority_id` 链接被取代记录），是本次调研中状态机最完整的一套 |
| 幂等机制 | 唯一索引：`family_id + source_type + source_ref`（仅当 `source_type = 'ASSESSMENT_HYPOTHESIS'` 且 `source_ref` 非空时生效） | 版本链天然幂等（每次确认都是新增一条并递增 version，不依赖唯一索引） |
| 调用方（谁引用它） | `orchestration.service.ts`（资源编排 runtime，`modules/orchestration/`）；`growth-hypothesis.service.ts` 通过 `family.controller.ts` 的 `POST :familyId/growth-hypotheses/decisions` 路由暴露给外部 | `growth-priority.service.ts` 通过 `family.controller.ts` 的 `GET :familyId/growth/onboardings/:onboardingId/priority` 与 `POST .../priority/confirm` 路由暴露；被 `growth-subject.resolver.ts`、`intervention.service.ts`、`journey-plan.service.ts`、`growth-review.service.ts` 联表查询消费（是 Growth 主链路里事实上的"当前成长意图"来源） |
| 是否有跨表引用 | 无（`orchestration.service.ts` 内部还 JOIN 了自己的 `service_calls` 之类表，但不 JOIN `growth_priorities`） | 无（`growth-priority.service.ts` 及其消费方均不引用 `growth_intents`） |
| 测试覆盖 | `orchestration-vertical-slice.e2e-spec.ts`、`l0-l1-test-loop.integration.spec.ts`、`assessment.e2e-spec.ts` | `family-wave2.e2e-spec.ts`、`family.e2e-spec.ts`、`growth-priority.service.spec.ts`、`family.service.integration.spec.ts` |
| 是否废弃遗留 | 否，是当前生效的编排 runtime 核心表 | 否，是当前生效的 Growth 主链路核心表 |

---

## 2. 核验过程与关键证据

### 2.1 文件与表名核验（确认调研文档第0/3.1节所述文件真实存在）

```
50_开发_dev/apps/api/src/modules/family/growth-hypothesis.service.ts
50_开发_dev/apps/api/src/modules/family/growth-priority.service.ts
50_开发_dev/apps/api/src/modules/family/growth-priority.policy.ts
50_开发_dev/database/migrations/0003_growth_foundation.sql
50_开发_dev/database/migrations/0008_m2_wave2_priority_intervention_action.sql
50_开发_dev/database/migrations/0020_growth_orchestration_v1.sql
50_开发_dev/database/migrations/0041_ui03_growth_hypothesis_confirmation.sql
```
以上文件均存在，与原调研文档描述一致。

### 2.2 表名全库检索（`grep -rl` 结果）

- `growth_intents` 出现于：`growth-hypothesis.service.ts`、`orchestration.service.ts`、
  `assessment.e2e-spec.ts`、`l0-l1-test-loop.integration.spec.ts`、
  `orchestration-vertical-slice.e2e-spec.ts`、`test-database.ts`，
  以及迁移文件 `0020`、`0023`、`0041`。
- `growth_priorities` 出现于：`growth-priority.service.ts`、`growth-review.service.ts`、
  `growth-subject.resolver.ts`、`intervention.service.ts`、`journey-plan.service.ts`、
  `principal.repository.ts`、多个 e2e/integration spec 与 fixture，
  以及迁移文件 `0003`、`0008`、`0009`、`0020`、`0035`。

**新发现（补充原调研文档未提及的一点）**：`orchestration.service.ts` 本身直接写 `growth_intents`
（多处 `insert into growth_intents(...)` / `update growth_intents set status='CLOSED'`），
且与 `growth-hypothesis.service.ts` 的写入路径是**两条独立代码路径**共享同一张表 —— 也就是说，
`growth_intents` 表本身在 Assessment 域之外，还有一个"资源编排 runtime"的写入方，原调研文档
第3.1节只提到了 `growth-hypothesis.service.ts`，遗漏了 `orchestration.service.ts` 这个更大的
使用方。这不影响"两套实现互不关联"的结论，但说明 (A) 侧的实际调用面比原文档描述的更广，
并非"只有 Assessment 域一个孤立产物"。

### 2.3 交叉引用核验（确认两者之间无代码路径互相调用）

```
grep -n "growth_priorit|GrowthPriority" growth-priority.service.ts  → 无匹配（自身文件除外不含对方概念）
grep -n "growth_intent|GrowthHypothesis" growth-hypothesis.service.ts → 无匹配
```
确认：`growth-priority.service.ts` 不引用 `growth_intents`/`GrowthHypothesis`，
`growth-hypothesis.service.ts` 不引用 `growth_priorities`/`GrowthPriority`。两套实现在
service 层完全解耦，数据库层也没有外键关联。

### 2.4 调用方核验（确认两者都是当前生效代码，非遗留废弃）

`family.controller.ts` 同时注入并暴露两者：

- `GrowthHypothesisService` → `POST :familyId/growth-hypotheses/decisions`
- `GrowthPriorityService` → `GET :familyId/growth/onboardings/:onboardingId/priority`
  与 `POST :familyId/growth/onboardings/:onboardingId/priority/confirm`

两者均在 `family.module.ts` 中注册为 provider，均有对应的 controller 路由和 e2e 测试覆盖，
**都是活跃代码，没有一方是遗留废弃**。

### 2.5 历史追溯（git log）

仓库当前分支上这两组迁移文件都只能追溯到一次性的仓库初始化提交
（`8eee065 chore: initialize family-ai from full family workspace`，`0041` 追溯到
`c53a040 feat: sync Family AI local program updates`），仓库历史被压缩导入，无法从 git log
还原两者演化的时间先后关系或是否存在"废弃再建新表"的过程。**无法用 git 历史证明其中一方是
另一方的历史遗留**，只能通过代码内容（状态机完整度、调用方活跃度）判断两者均为现行代码。

---

## 3. 与原调研文档的差异点

原调研文档（`batch2-domain-research-v1.md` 第3.1/9节）的核心判断——"两套实现互不关联，
`growth_priorities` 是 Growth 主链路真实落地对象，`growth_intents` 是 Assessment 域独立
产物"——**本次核验基本确认成立**，但有一处需要修正：

- 原文档称 `growth_intents` 表"本次未见任何后续生命周期管理service"，只在
  `growth-hypothesis.service.ts` 插入时写死为 OPEN。**核验发现这个判断不完整**：
  `orchestration.service.ts` 里确实有把 `growth_intents.status` 更新为 `CLOSED` 的代码
  （`close_reason` 取值 `NO_ACTION_SELECTED` 或 `SERVICE_DELIVERED`）。即，`growth_intents`
  表本身是有生命周期推进代码的，只是这段代码不在 Assessment 域（`growth-hypothesis.service.ts`）
  里，而在 Orchestration 域（`orchestration.service.ts`）里，原文档因为调研范围限定在
  Batch 2 的 family 模块目录，未覆盖 `modules/orchestration/`，所以漏掉了这条路径。

结论不变（两套实现仍然互不关联、都是现行代码），但 (A) `growth_intents` 的完整业务归属应
更正为"Orchestration 域（资源编排 runtime）的核心状态表，Assessment 域的
`growth-hypothesis.service.ts` 只是其中一个写入方"，而不是"纯 Assessment 域孤立产物"。

---

## 4. 推荐保留哪套 / 迁移建议

**不建议"合并成一套"**，因为两者是不同业务概念，合并会丢失语义或制造出一个从未在 NestJS
代码里真实存在过的"统一 GrowthIntent"抽象，违反"忠实复刻语义陷阱"的迁移原则。

建议按以下方式处理命名歧义：

1. **Python 侧重命名 (A)**，例如 `ResourceOrchestrationIntent` 或 `NeedSignalIntent`，
   与 Orchestration/资源编排域绑定命名，不再使用容易与 Growth 主链路混淆的"GrowthIntent"
   字样。这套语义的实际归属是资源匹配/Offer 推荐/执行派单的运行时状态机，命名应体现"这是
   编排层的内部对象，不是家长确认的成长意图"。
2. **Python 侧保留 (B) 作为唯一的"GrowthIntent/GrowthPriority"概念**，因为这是原迁移计划
   （`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` 第8节）里 GrowthIntent 概念真正对应的
   业务对象——家长确认优先方向、驱动 Intervention 和 90 天 JourneyPlan 的根对象，版本链
   状态机也已经完整实现，直接迁移即可。
3. **迁移 Plan 阶段需要显式写明**："GrowthIntent"这个名字在 Python 侧只对应 (B)
   `growth_priorities` 语义；(A) 的编排 runtime 概念如果也要迁移，必须用不同名字，避免
   Python 侧代码/文档里出现两个都叫 GrowthIntent 但指向不同表的情况（重复 NestJS 现有的
   命名混淆）。
4. **不要求先做数据迁移或表结构改动**——两张表在 NestJS 侧继续独立运行不受影响，本文档
   只影响 Python 迁移 Plan 阶段的命名决策，不涉及现网代码/数据改动。
5. 若后续要迁移 Orchestration 域（(A) 所在的 `modules/orchestration/`），需要单独立项
   调研，其复杂度（`RANKING≠ORCHESTRATION`、T1/T2 分离、按 Offer 类型分派执行等）不在
   本次 Batch 2（Family/Relationship/Consent/GrowthIntent/GrowthPlan/Intervention/
   Action/Outcome）范围内，本文档不展开。

---

## 5. 本文档不包含的内容（明确边界）

- 未执行任何代码改动、表结构改动、数据迁移。
- 未对 `modules/orchestration/` 的完整业务逻辑做详细调研（只核验了 `growth_intents` 相关
  的写入/更新片段），该域的完整调研应作为独立任务。
- 未评估 Python 侧具体的类/表/字段命名方案，只给出方向性建议（第4节第1、2点为建议方向，
  非最终命名决策，最终命名应在 Plan 阶段由负责人确认）。
