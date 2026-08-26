# FAMILY GROWTH EVIDENCE GRAPH DIRECTION V1

```text
DOC_KIND = ARCHITECTURE_DIRECTION
CONTRACT = V5-00
STATUS   = DIRECTION_ONLY
SCOPE    = Growth Evidence Graph
DATE     = 2026-08-26
```

## 1. 目的与定位

Growth Evidence Graph（成长证据图）是 Family Growth Intelligence & Ecosystem OS 的**证据与可追溯性方向**。它用于记录家庭成长场景中：

- 什么被观察到或陈述；
- 谁在什么时间、以什么角色、基于什么来源提出了什么主张；
- 哪些证据支持或挑战某个假设；
- 哪些建议经过谁的决定转化为行动；
- 行动之后发生了什么，以及如何通过复盘形成新的证据。

它不是儿童评分系统、家庭评级系统，也不是把家庭压缩成一个静态画像的标签系统。成长状态必须保持时间性、来源性、可解释性和可修正性。

本文件是 V5-00 的**方向与工程合同**，用于约束后续设计和实现。当前不实现图数据库，不创建或迁移数据库 schema，不改变现有 canonical ontology，也不授权新增运行时写路径。

## 2. 核心语义不变量

以下边界对所有图节点、关系、读模型和未来适配器永久有效：

1. `Perspective != Fact`。
2. `Hypothesis != Fact`。
3. `Recommendation != Decision != Action`。
4. `Action != Outcome`。
5. `Observation != Diagnosis`。
6. Evidence 是可追溯输入，不等于自动证明；证据等级不能替代专业判断或家庭决定。
7. AI 可以读取经授权的上下文并提出结构化提议，但不得直接写入 canonical ontology 或 canonical state。
8. 核心状态变更只能经批准的 Named Action，并由 Domain Core 记录。
9. 高风险家庭场景必须经过适用的 Human Gate、安全政策和授权检查。
10. 任何节点都不得被设计为对家庭或儿童进行跨家庭比较、竞争或固定化归类的工具。

## 3. 节点方向

图的节点是带版本、来源和审计信息的语义记录。下列十类节点构成 V1 方向；它们不是本文件授权立即新增的物理表或 schema。

| 节点 | 语义 | 关键边界 |
| --- | --- | --- |
| `Fact` | 在明确来源、时间和范围内可被系统记录的事实 | 不把主观判断、模型推断或标签冒充事实 |
| `Perspective` | 某个角色对家庭、成员、事件或成长问题的视角、叙述或自述 | 必须保留声称者；不能自动升级为 `Fact` |
| `Observation` | 在特定场景和时间对行为、变化或结果的观察记录 | 描述观察到的现象，不作临床诊断或确定性因果结论 |
| `Evidence` | 支持、挑战或限定某一主张的可追溯证据引用或证据片段 | 必须有 provenance 和证据等级；不能脱离来源独立使用 |
| `Hypothesis` | 基于当前信息形成的待验证解释或工作假设 | 必须标为假设，可被新证据修正、削弱或取代 |
| `Recommendation` | 面向下一步可能选择的建议或候选方案 | 不是决定，不是已执行行动，不得绕过人或政策门禁 |
| `Decision` | 具有授权主体和审计记录的选择、接受、拒绝或调整 | 必须能追溯到对应建议/上下文；不是 AI 默认行为 |
| `Action` | 经 Named Action 执行的领域动作或服务动作 | 由 Domain Core 执行和记录；不能由自由文本直接生成 canonical mutation |
| `Outcome` | 行动之后可观察、可复核的结果或结果信号 | 不是服务完成的同义词，不自动证明因果或成功 |
| `Review` | 对证据、假设、建议、行动和结果进行的阶段性复盘 | 可形成新证据或修订假设，不覆盖历史记录 |

节点至少应能关联 `family_id`、可选的 `subject_person_id`、节点版本、创建时间、有效时间范围、来源引用、创建/确认角色、置信度、证据等级、可见性和审计追踪。具体字段名、枚举和持久化形态须由后续批准的 contract/spec 决定。

## 4. 关系方向

关系必须表达语义和方向，不能只保存无类型的“相关”。V1 采用以下关系方向作为设计基线：

```text
Fact          --ABOUT / OCCURS_IN-->        Family | Person | Event | Context
Perspective   --ABOUT--------------->       Family | Person | Fact | Observation | Need
Observation   --OBSERVES----------->       Person | Interaction | Action | Outcome
Evidence      --SUPPORTS----------->       Fact | Observation | Hypothesis | Review
Evidence      --CHALLENGES--------->       Fact | Hypothesis | Recommendation
Evidence      --DERIVED_FROM------->       SourceArtifact | Perspective | Observation | Event
Hypothesis    --ABOUT--------------->       Family | Person | Need | GrowthEpisode
Hypothesis    --SUPPORTED_BY------->       Evidence | Observation | Review
Hypothesis    --REFINED_BY--------->       Review | Evidence | Outcome
Recommendation--RESPONDS_TO------->       Hypothesis | Need | Review
Decision      --CONSIDERS---------->       Recommendation | Evidence | Policy
Decision      --AUTHORIZED_BY------>       Actor | HumanGate | Policy
Action        --EXECUTES----------->       Decision | NamedAction
Action        --TARGETS------------>       Need | GrowthEpisode | ServiceCase
Outcome       --RESULT_OF---------->       Action | ServiceEpisode
Outcome       --OBSERVED_BY-------->       Observation | Actor | Instrument
Review        --REVIEWS------------>       Evidence | Hypothesis | Recommendation | Decision | Action | Outcome
Review        --CREATES------------>       Evidence | Hypothesis
```

关系本身也必须保留来源、角色、时间、置信度、证据等级和审计信息；关系不能被解释为比其端点更强的事实。`SUPPORTS` 表示证据关系，不表示自动成立；`RESULT_OF` 表示时间或业务关联，不表示已经证明因果。

AI 世界与 canonical 世界之间只能存在受控桥接：

```text
AI / Model Output
      ↓ 结构化 Recommendation 或 Hypothesis
Policy / Human Gate / Authorized Decision
      ↓
Approved Named Action
      ↓
Domain Core records canonical Action / Outcome
```

不存在 `AI --WRITES--> Fact|Decision|Action|Outcome` 的直接关系，也不存在 `AI --MUTATES--> canonical ontology` 的旁路。

## 5. 来源、角色、时间、置信度与证据等级

### 5.1 来源（provenance）

每个节点和关系都必须能够回答“来自哪里”。来源应区分至少以下类别：

- 家庭成员或其他主体的原始陈述、自述或上传材料；
- 教师、顾问、服务人员或其他授权角色的观察/记录；
- 系统事件、Named Action、服务记录或仪器产生的观测；
- 经授权的外部研究、方法、知识或制度来源；
- 模型生成或模型抽取结果；
- `inferred`、`simulated`、`unverified`、`unknown` 等不确定溯源。

模型输出只能作为推断、提议或待审阅的输入，不能仅因模型置信度较高就升级为 canonical `Fact`。每条记录应可回溯到原始 artifact、事件、对话片段或外部引用；没有可回溯来源的内容不得作为强证据使用。

### 5.2 角色（actor / claimant / reviewer）

必须区分：

- `actor`：创建、执行或确认记录的主体；
- `claimant`：提出 `Perspective` 或主张的主体；
- `observer`：产生 `Observation` 的主体或设备；
- `reviewer`：复核、挑战或修订记录的授权主体；
- `decision_maker`：作出 `Decision` 的授权主体；
- `agent/model`：产生模型输出的系统身份，仅能作为提议来源。

角色不是可信度等级，也不能用家庭身份直接推导临床或成长结论。角色可见范围必须受 consent、purpose、subject、recipient 和 trust zone 约束。

### 5.3 时间（temporal semantics）

必须区分事件发生时间、观察时间、主张时间、记录时间、审核时间和有效期。未来实现不得用“当前 profile 值”覆盖历史；同一主题在不同时间、不同角色下可以存在多个并存视角。过期、撤回、修订或取代应通过版本和关系表达，而不是删除历史证据。

### 5.4 置信度（confidence）

置信度表示记录者或产生系统对该记录的确定程度，不等同于真实性，也不等同于证据等级。置信度必须带有评估主体、方法或来源上下文；不得将多个置信度简单平均成家庭分数或儿童分数。

### 5.5 证据等级（evidence level）

证据等级表示证据的可验证性、来源质量和适用范围。等级只能由统一的 Evidence 门禁和知识层规则解释；本图不另起一套评分体系。`simulated`、`inferred`、`unverified`、`unknown` 等来源不能用于支撑“已成立”的强事实，只能用于形成假设、待验证建议或验收门槛。自家素材和自家生成产出不得通过图关系循环证明自身主张。

## 6. 读模型边界

Growth Evidence Graph 首期只提供**授权的只读上下文和解释投影**，不提供通用写图 API。读模型必须：

- 按 `family_id`、`subject_person_id`、purpose、recipient、consent、policy、trust zone 和有效期过滤；
- 返回节点、关系、来源、角色、时间、置信度、证据等级、版本和不确定性；
- 保留 `Fact`、`Perspective`、`Observation`、`Evidence`、`Hypothesis`、`Recommendation`、`Decision`、`Action`、`Outcome`、`Review` 的类型边界，不把它们拼成一个“结论”；
- 可以生成 FamilyNow、GrowthEpisode、Review 或专业工作台所需的最小上下文，但不得暴露全局儿童画像或跨目的复用的超级档案；
- 明确标识推断、待复核、过期、被挑战和被取代的记录；
- 不允许读模型反向写入 canonical object、改变 consent、改变安全等级或改变 membership/成长状态。

以下能力不属于本合同的读模型授权：

- 任意 `PATCH` 图节点或关系；
- 通过读模型触发 Action、服务启动或权限提升；
- 由模型摘要覆盖来源记录；
- 将证据图聚合成家庭/儿童总分、等级、排名或固定标签。

## 7. 明确禁止事项

Growth Evidence Graph 永久禁止用于：

1. **Family Total Score**：不得计算、存储、展示或以隐含字段表达家庭总分。
2. **家庭或儿童 Ranking**：不得进行家庭间、儿童间的排名、百分位竞赛或“最佳家庭/最佳儿童”排序。
3. **固定儿童标签**：不得把临时状态、模型推断、成长阶段或单次观察固化为永久人格、能力、风险或价值标签。
4. **临床诊断**：不得将图节点、证据等级或模型输出作为临床诊断、医疗结论或替代专业评估。
5. **AI 直接 canonical mutation**：AI、Agent、模型或自由文本不得直接创建/修改 canonical `Fact`、`Decision`、`Action`、`Outcome` 或核心 Ontology 状态；必须经过结构化提议、政策/人工门禁、授权 Decision 和 Named Action。
6. **因果越权**：`Action --RESULT_OF--> Outcome` 或证据支持关系不得被渲染为已证实因果。
7. **证据循环自证**：同一来源的推断、摘要、推荐和派生物不得相互循环提升证据等级。
8. **跨家庭比较**：不得使用图数据对家庭进行运营评级、商业歧视或资源优先级排名。

## 8. 实现范围与非目标

当前 V5-00 只批准：

- 形成节点、关系、元数据和读模型边界的共同语言；
- 为后续 Trusted Context、Agent Harness、Evidence、Review、Outcome 和 Named Action 合同提供引用方向；
- 为未来 API、Adapter、Eval 和 Human Gate 设计提供不可违反的语义约束。

当前明确不批准：

- 图数据库选型、部署或接入；
- PostgreSQL/图数据库 schema migration、DDL、索引或数据回填；
- 新增核心 Ontology、表、枚举或生产 API；
- 将现有对象强行迁移为十类图节点；
- 生产级图查询、推荐排序、模型训练或自动化行动；
- 删除、重写或覆盖既有历史记录。

任何实现任务必须另行获得批准的 Task、API/ontology/action contract、安全与 consent 评审，并通过相应门禁后方可开始。

## 9. 验收原则

后续实现或设计评审至少应证明：

- 每个主张、观察、证据和结果都能追溯到来源、角色和时间；
- `Fact`、`Perspective`、`Observation`、`Evidence`、`Hypothesis`、`Recommendation`、`Decision`、`Action`、`Outcome`、`Review` 类型不可混写；
- 读模型遵守 purpose、consent、recipient、subject 和 trust zone 边界；
- AI 没有直接 canonical mutation，核心写入均可追溯到 Named Action；
- 没有 Family Total Score、家庭/儿童 Ranking、固定儿童标签或临床诊断输出；
- 新证据可以修订或挑战旧假设，同时保留历史和审计轨迹；
- 当前实现没有未经批准的图数据库、schema migration 或生产写入能力。
