# Family AI Native 生成式智能平台建设方向 V3.0（草案，方向性文档）

```text
DOC_KIND        = DIRECTIONAL_INPUT_FOR_FUTURE_BATCHES / NOT_EXECUTABLE_TRUTH
STATUS          = ARCHIVED_FOR_BATCH_2_PLUS_CONSIDERATION
DATE            = 2026-08-28
SUPERSEDES      = NOTHING — does not replace or amend CURRENT_SPRINT.md
                  Override #3 or FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md
AUTHORIZED_BY   = project-owner (verbal, in-session)
```

## 为什么存在这份文档，以及它不是什么

这是项目负责人在本次会话中提出的一份更完整的技术方向陈述（原话见会话记录），核心主张是把"Family是业务后端+AI平台"这个理解方式，升级为"**Family本身就是一个生成式AI平台，家庭成长业务是这个平台的第一个领域应用**"。

**这份文档不取代、不修改**当前正在执行的`CURRENT_SPRINT.md` Override #3 和 `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`——那两份文档是Batch 1（Assessment域）当前的执行真相，Batch 1仍按原计划收尾，不因这份文档而中断或改变当前进度。

存档这份文档的原因：项目负责人提出的方向在**大方向上与Override #3完全一致**（Python单轨、Replace In Place而非大爆炸重写、确定性业务与生成式智能同栈不同逻辑边界），但包含了大量**Batch 2及以后**才会涉及的具体设计（Domain Kernel八大内核命名、Context Engine、FGCN升级为Human+Agent协作网络、Design Studio产品化设计工作台等）。按项目自己定的纪律——"完成后STOP执行exact-head review，不得同时迁移第二个领域"——这些内容现在写进正式migration plan为时过早，先存档，留给Batch 2启动时的设计输入。

## 已核实与当前执行一致、无需额外确认的部分

- **Python单轨架构**：与Override #3完全一致，前端TS+后端全Python，NestJS Replace In Place逐段下线。
- **同进程 vs 独立进程边界**：本文档原文倾向"默认同进程，只有真正需要独立伸缩时才拆部署"。**已与项目负责人核实**：Batch 1现状（`ClaudeInterpretationAdapter`等AI适配器直接挂在`family_api`进程内，无独立`ai_runtime`进程）**保持不变，按之前的做法继续做**——即维持迁移计划里"三个独立进程family-api/ai-runtime/workflow-worker"的长期定论表述不变，但`ai_runtime`何时真正独立拆出，留给未来有真实伸缩需求时再决定，不是现在的既定执行方向。这是本次讨论中唯一被明确澄清、需要记录在案的分歧点。
- **迁移顺序**（Assessment → GrowthNeed/Profile → Program/ServiceBlueprint → ServiceCase → ServiceTask/Assignment → Provider/Organization → Contribution/Allocation → Membership/Growth → Governance → 关闭NestJS）：与`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`第8节的Batch 1-8划分方向一致，颗粒度更细，可作为Batch 2+排期时的参考细化。

## 存档的核心设计主张（留待 Batch 2+ 采纳评估，非现在的执行指令）

### 平台四层收敛

```text
Experience Layer (Family/Teacher/Institution/Ops)
  ↓
AI Application Platform (Assessment/Growth/Service/Design Studio/Operations)
  ↓
Family AI Runtime (Domain Kernel / Workflow Runtime / Agent Runtime /
                    Context Engine / FGCN Runtime / Knowledge & Skill /
                    Evaluation & Safety / Model Gateway)
  ↓
Infrastructure (PostgreSQL/Redis/Object Store/Vector/Queue/Models/Compute)
```

### 八大平台内核（命名体系，供Batch 2+参考）

1. **Domain Kernel** — Family业务真相（Family/Member/Consent/Assessment/GrowthNeed/ServiceCase/ServiceTask/Assignment/Provider/Organization/Contribution/Allocation/Membership）。对应当前migration plan里"business domains"的集合，命名可考虑统一。
2. **Context Engine** — Family Context结构化快照（identity/consent/observations/assessments/growth_needs/goals/plans/actions/service_history/preferences/risks/memories/evidence），Agent不能直接查库，必须经Context Engine + Consent/Policy/Scope过滤。这是对当前`AssessmentInterpretationPort`模式（AI Runtime不能直接import业务repository）的泛化和平台化，值得在Batch 2+ Family/Consent域迁移时正式设计。
3. **Agent Runtime** — 标准Agent结构（Identity/Goal/Context Policy/Skills/Tools/Knowledge/Memory Policy/Model Policy/Workflow/Evaluation/Human Gate），跑在统一Runtime之上。
4. **Workflow Runtime** — 与Agent Runtime并列而非从属："Workflow负责可控，Agent负责智能"。21天成长服务等长流程走Workflow骨架+Agent智能填充，不是让AI自己决定下一步。
5. **FGCN Runtime** — 沿用V1.1文档`ServiceBlueprintVersion → ServiceCase → ServiceTask → TaskAssignment → ServiceContribution → AllocationStatement`主链（不推翻），但升级为"Human + Agent Collaboration Network"，`ServiceTask`的能力匹配对象扩展到AI Agent/Human Steward/Teacher/Expert/Organization/Content/Skill/Tool同一集合。**这正是Batch 1 Context发现的、V1.1文档第7.3节与Override#3矛盾的FGCN业务线（`feat/service-collab-allocation-p0-002`），本文档的处理方式是保留其领域设计价值、否定其"NestJS管业务"的技术路线表述**。
6. **Knowledge & Skill Registry** — 课程/家庭教育方法/内容版本/服务SOP/风险转介指南。
7. **Evaluation & Safety** — 正确性/帮助度/安全/年龄适配/越界/偏见/拒答/成本持续评测，Human Gate。
8. **Model Gateway** — 统一模型/成本/配额/隐私级别/故障转移/供应商策略。

### Family Design Studio（产品设计平台，Batch 7+范畴）

产品经理输入自然语言需求 → AI生成完整`Program → ServiceBlueprint → Stages → GrowthNeed Mapping → Family Actions → Service Tasks → Agents → Skills → Knowledge → Human Trigger → SLA → Evaluation → Contribution Rules` → Simulation（模拟正常/低参与/焦虑家庭、AI不确定、真人介入、服务失败、投诉、风险升级等场景）→ Publish Blueprint。这是`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`里"Batch 7 Design/Product Blueprint platform"的具体化设计，可在Batch 7启动时直接参考。

### Codex Harness定位（已与现有架构文档一致，无新增）

`Family Agent Runtime`调度`Codex Harness Adapter`作为其中一种Agent类型（用于强执行型任务：生成产品配置、分析大规模文档、自动生成评测集、构建工具、复杂运营任务、编程、数据分析），"Family Runtime调度Codex，而不是Codex控制Family"——这与现有`architecture/FAMILY_INTELLIGENCE_OS_HARNESS_BOUNDARY_V0_1.md`的`FamilyHarnessAdapter`边界设计原则一致，无需额外决策。

## 90天计划映射（供参考，不替代当前执行节奏）

本文档的0-30/31-60/61-90天计划本质上是`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`第11节"Reference timeline"的更细化版本（Python Core Takeover → Golden Vertical Slice → ServiceBlueprint Engine/FGCN/Design Studio落地），可在Batch 1完工review时用作Batch 2+排期的参考细化依据，不是现在就要执行的新时间表。

## 后续处理

- 本文档不需要任何代码改动即可存档，属于纯只读方向性记录。
- 待Batch 1完工、项目负责人完成exact-head review后，决定是否把本文档的命名体系（Domain Kernel/Context Engine等）正式采纳进下一版migration plan，或是否需要先落地一份独立的《Family AI Native Platform V3.0》正式方案文档（本文档定位为草案输入，不是可直接执行的正式方案本身）。
