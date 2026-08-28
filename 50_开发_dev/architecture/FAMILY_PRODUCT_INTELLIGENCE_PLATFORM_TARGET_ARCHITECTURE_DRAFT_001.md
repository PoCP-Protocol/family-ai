# FAMILY PRODUCT INTELLIGENCE PLATFORM — TARGET ARCHITECTURE (DRAFT)

```text
DOC_KIND        = TARGET_ARCHITECTURE_DRAFT (NOT FROZEN — pending project-owner review)
RELATION        = EXTENDS FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md §8 (三区方法论/独占区候选)
                  SLOTS INTO FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md Batch 7
                  (Design/Product Blueprint/Service Blueprint/Curriculum Design/Content Generation/Design Experiment)
DATE            = 2026-08-28 (originally); updated 2026-08-28 after chief-architect PR-001R review of PR #27
STATUS          = DRAFT — the "no Approved Task / no code yet" statement below is superseded by
                  CURRENT_SPRINT.md Override #6: PR-001 (the acceptance-chain slice) is real, authorized,
                  and is now the sole canonical `domains/product_intelligence` domain. The rest of this
                  doc's six-layer vision remains DRAFT/unauthorized.
AUTHORIZED_BY   = PR-001 scope only: project-owner (Override #6) + chief-architect PR-001R review (PR #27).
                  Everything beyond the acceptance chain still requires explicit sign-off per CLAUDE.md（一次一个 Approved Task）
SOURCE          = 项目负责人本次会话提出的"Family AI Product OS"提案（六层架构/四发动机/FPDL/Compiler/Simulation Lab）,
                  经与现有SSOT核对后改写为本文档
```

## 0. 这份文档解决什么问题

项目负责人提出了一套完整的产品智能平台愿景(市场洞察→主要矛盾→策略→组件化产品工厂→模拟→实验→学习的完整闭环,含 FPDL/Compiler/Simulation Lab/十个工作台)。这套愿景在**方向上**与仓库已确认的三区方法论(`FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md` §8)一致甚至更完整——独占区四候选(Family Context/Growth Graph/Intervention Engine/Blueprint Library)正是该提案 Market Insight Graph / Contradiction Engine / Strategy Engine / Pattern Library 的更早期表达。

但直接把提案原文当成执行计划有三个必须先解决的冲突,本文档的作用就是把这三个冲突摆清楚、给出处理方式,再把愿景收窄成一份可以真正走 Approved Task 流程的目标态文档。

## 1. 冲突一:规模——提案自己反对的"一次性建齐"

`FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md` §8.4 已经给出经过审计验证的优先级表,核心原则是"能在已有结构上做增量的地方优先选增量,不新建全新对象":

| 优先级 | 已批准范围 | 状态 |
|---|---|---|
| P0 | Family Context 最小可用检索层 | 已落地(分支 wt-context,测试56→61) |
| P0 | GrowthHypothesis 加 primary_contradiction 排序 | 已落地(同分支,测试56→69) |
| P1 | Principal Soul YAML 与代码脱节修复 | 已落地(分支 wt-soul) |
| P1 | Service Blueprint 接入 primary_contradiction 输入 | 未落地 |
| P2 | Growth Intervention Engine 雏形 | 未落地 |
| P3 | 多 Agent 协同 | 未授权 |

提案里的 Market Intelligence Engine / Product Strategy Engine / Composable Product Factory / Product Learning Engine 四发动机,规模远超上表——这正是提案第23节自己写的"不建议先做一个宏伟空平台"这条原则要拦住的东西。

**处理方式**:本文档保留提案的四发动机命名和长期目标态描述(第3节),但**明确标注每个组件当前的治理状态**,不把整份愿景当作待办列表。近期(未来一个季度)只有已经在上表里的 P1(Service Blueprint 接入 primary_contradiction)属于可申请 Approved Task 的范围。其余全部标记为 `PROPOSED — 需新 Task 授权`,不因为写进了这份文档就获得授权。

## 2. 冲突二:证据护栏——Simulation Lab 不能自证

仓库硬规则(`CLAUDE.md` 第四节):"推算不算证据。溯源为 simulated/inferred/unverified/unknown 的,按门禁不可用于支撑'成立',只能生成假设、设定验收门槛。"

提案第14节的 Synthetic Family Lab(模拟家庭跑产品蓝图→观察反应→驱动 Product Learning Engine)如果不设护栏,本质上和"素材/产出自证"是同一类风险:模拟出的家庭反应被系统当作"验证通过"反哺决策,等于自己给自己发证据。

**处理方式**(未来若进入 P2+ 才适用,现在只是先写清楚规则,不是立即建设):

- Simulation 产出的一切结果,证据等级固定标记为 `simulated`,与 `evidence.py` 现有 E0-E7 门禁共用同一套溯源字段,不新开一套模拟专用的证据体系。
- Simulation 结果只能做两件事:①生成/否定 hypothesis,②设定 Pilot 阶段的验收门槛(如"若真实家庭完成率低于模拟基线80%则暂停")。**不能**直接写入 `growth_actions`/`service_blueprint_version` 等 canonical 状态,不能作为"产品验证通过"的唯一依据。
- 任何 Simulation → Pilot 的晋级判断,必须同时有 `simulated` 之外的真实家庭数据支撑,对齐 `Perspective≠Fact`/`Hypothesis≠Fact` 的既有原则。

## 3. 冲突三:治理流程——现在没有对应的 Approved Task

`CURRENT_SPRINT.md` 当前唯一在跑的是 Python-only 迁移(Override #3)。提案里的 `product_intelligence/` 目录结构(market/strategy/factory/simulation/experiment/publishing/learning)与已冻结的 `FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` §3 目录布局(`domains/`, `intelligence/`, `workflows/`)不是同一套命名——已冻结布局里 `intelligence/` 已经预留了 `design_copilot/` 模块,且 Batch 7 已经预留了"Design/Product Blueprint/Service Blueprint/Curriculum Design/Content Generation/Design Experiment"的位置。

**处理方式**:本文档**不新建目录结构**,不引入 `product_intelligence/` 这个新的顶层命名空间。提案中的能力最终落地时,按下表映射进已冻结的 Batch 7 结构,而不是并行开辟第二套:

| 提案概念 | 落地位置(Batch 7 既有预留) |
|---|---|
| Product Strategy Engine(Segment/三区图/主要矛盾/策略) | `domains/service/`(policy 层)+ 已落地的 `primary_contradiction` 字段扩展 |
| Composable Product Factory(Component/Pattern/FPDL/Compiler) | `workflows/design_release_workflow/` + `intelligence/design_copilot/` |
| Simulation Lab | `intelligence/design_copilot/`(受第2节证据护栏约束的独立子模块,不单开顶层目录) |
| Market Intelligence Engine(Signal→Insight→Opportunity) | **未在现有 Batch 划分中预留位置** —— 这是本提案唯一真正新增的、需要单独提交变更评审的范围,建议作为 Batch 7 之后的独立 Batch 9 候选,而非塞进 Batch 7 |

Batch 7 本身尚未被授权(见 `CURRENT_SPRINT.md`)。本文档写成后**不构成对 Batch 7 的提前授权**,仍需项目负责人按"具体计划评审"模式逐 Batch 确认(与 Override #3/#4 的确认方式一致)。

## 4. 保留的长期目标态描述(未来 Batch 7/9 参照,非当前待办)

以下内容忠实保留提案的架构意图,供 Batch 7/9 正式启动时作为设计参照,当前不创建任何对应代码:

- **四发动机**:Market Intelligence Engine / Product Strategy Engine / Composable Product Factory / Product Learning Engine。
- **Signal→Insight 链路**:RawSignal → SignalCluster → Trend → CustomerInsight → UnmetNeed → GrowthProblem → GrowthHypothesis → Opportunity。落地时 GrowthProblem/GrowthHypothesis 复用现有对象,不新建。
- **FPDL(Family Product Definition Language)**:声明式产品定义,经 Product Compiler 校验(Schema/Component/Compatibility/Workflow/Resource/AI/Context/Safety/HumanGate/Cost/Evaluation/SLA)后生成不可变 `ServiceBlueprintVersion`——这条链路与现有 `ServiceBlueprintVersion` 发布机制是延伸关系,不是替换。
- **不能做清单**(与 Family Coding Constitution 同源,直接采纳,无需重新论证):页面直接写 Prompt / 每产品重新开发代码 / 产品直接调用模型(须经 Model Gateway) / AI 直接修改业务事实 / 一开始拆几十个微服务 / 把所有知识塞向量库 / AI 直接决定高风险家庭问题。

## 5. 下一步

1. **已执行(2026-08-28,`CURRENT_SPRINT.md` Override #5)**:先落地 `packages/contracts/`、`domains/product_strategy/`、`domains/market_intelligence/`、`intelligence/design_copilot/` 四处结构骨架(状态 `STRUCTURE_ONLY`)。骨架不含任何猜测出的业务参数。
2. **已执行(2026-08-28,`CURRENT_SPRINT.md` Override #6,PR-001)**:项目负责人授权把 Signal→Insight→Opportunity→GrowthProblem→GrowthHypothesis→GrowthStrategy→ProductConcept 这条验收链做成真实实现,落地为 `domains/product_intelligence/`。
3. **已执行(2026-08-28,PR-001R,chief-architect review on PR #27)**:审查发现 (1) 结构骨架里的 `domains/product_strategy/`、`domains/market_intelligence/` 与新落地的 `domains/product_intelligence/` 出现三套重复的 `MarketSignal`/`GrowthProblem`/`Opportunity` 业务真相,已裁决 **`domains/product_intelligence/` 是这条产品智能链唯一的 canonical 业务 Domain**,`domains/product_strategy/`、`domains/market_intelligence/` 已删除(其骨架内容从未被任何 app 引用,删除零成本);(2) `packages/contracts/product_strategy.py`、`packages/contracts/product_factory.py` 同样与 domain 层重复,已删除——`packages/contracts` 现在只保留 `versioned.py`/`evidence.py`(通用版本化与证据词汇机制)+ `product_learning.py`(尚未被任何 domain 实现,暂不冲突),不再是"第二份 domain truth"。`50_开发_dev/backend/tests/test_architecture_ssot.py` 新增架构测试,防止同类重复再次出现而不被发现。
4. 骨架/PR-001 均不接入任何 app 挂载(`apps/family_api` 尚不存在),不构成对 Batch 7 或新 Batch 9 的整体正式授权——正式授权仍需在 `governance/AUTHORIZATION_REGISTRY.yaml` 补登记(PR-001R 已新增 `PRODUCT_INTELLIGENCE_DOMAIN_V0_1_PR001` 条目,范围仅限本 PR)。
5. 若批准范围仅限"Service Blueprint 接入 primary_contradiction 输入"(第1节已列入 P1),可直接作为下一个 Approved Task 提交,与本文档其余部分的授权状态无关。
