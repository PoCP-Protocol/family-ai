# Family 项目级场景识别与 4A 解构基线

状态: `DRAFT_EXECUTION_BASELINE`  
日期: 2026-08-24  
适用范围: UI-01 至 UI-34 移动端逐页开发、前后端一致性补齐、后续场景驱动优化。

## 1. 定位

本文件把项目后续工作从“按页面补功能”升级为“按场景识别、按 4A 解构、再落到 UI/API/测试”。它不是新的产品愿景，也不替代上位规格；它是执行基线，用来约束 UI-06 之后以及 UI-01 至 UI-05 的回补优化。

上位方法论来自 `10_规格_spec/01_实施方法论/Family_FGAIM_实施方法论_V2.0.md` 的 S-D-A-O-L 主链与 A0+8A 架构。用户要求的 4A 在本项目中定义为四个工程执行视角:

| 4A 执行视角 | 对应上位架构 | 回答的问题 | 交付物 |
| --- | --- | --- | --- |
| BA 业务架构 | A1 Family Growth Business Architecture | 谁在什么家庭场景中，为了什么 Outcome 做什么选择和行动 | 场景、角色、触发、前置/后置、动作、退出路径、边界 |
| DA 数据架构 | A2/A3 Ontology + Data/Knowledge/Evidence | 哪些对象、状态、证据、视角、假设和结果可以被读写 | 对象模型、DTO/Projection、Evidence 等级、Fact/Perspective/Hypothesis 边界 |
| AA 应用架构 | A6 Application & Experience Architecture | 页面、组件、路由、API client 和测试如何承载场景 | UI 映射、状态管理、异常态、自动化测试、视觉基线 |
| TA IT 与 AI 架构 | A4/A5/A7/A8 Model/Agent/Platform/Governance | 哪些能力走 Family API、Named Action、Model Gateway、Human Gate 和 Audit | API、Named Action、幂等、Outbox、Consent、Policy、LLM Gateway、Human Gate |

原则: 4A 不是四份孤立文档，而是每个场景进入实现前必须完成的最小解构。没有 4A，不进入“功能完成”口径。

## 2. 输入源与证据纪律

| 输入源 | 当前已定位文件 | 用途 | 证据限制 |
| --- | --- | --- | --- |
| 上位方法论 | `10_规格_spec/01_实施方法论/Family_FGAIM_实施方法论_V2.0.md` | S-D-A-O-L、A0+8A、三条成长主线、四大闭环 | 概念权威规格，优先级最高 |
| 业务对象规格 | `10_规格_spec/03_详细方案/Family_详细实施方案_V2.0.md` | Family → LifeStage → GrowthProfile → GrowthPriority → GrowthJourney → Action → Outcome 主链 | 业务架构与 Ontology 基准 |
| 三份 PPT | `30_素材_materials/榜样教育/*.pptx`，登记见 `30_素材_materials/PROVENANCE.md` 与 `50_开发_dev/governance/BANGYANG_CONSUMER_UI_AND_3_PPT_MASTER_DELIVERY_PLAN_001.md` | 产品叙事、场景入口、视觉和闭环输入 | E1 内部材料，只能作为场景/假设/视觉来源，不证明效果 |
| Consumer UI Baseline | `50_开发_dev/governance/FAMILY_CONSUMER_UI_BASELINE_V1.json` | 页面范围、闭环归属、运行状态、Route/Projection/Domain 映射 | UI 是体验基线，不拥有业务真相 |
| 前后端矩阵 | `50_开发_dev/governance/FAMILY_CONSUMER_UI_FRONTEND_BACKEND_CONSISTENCY_MATRIX_001.md` | 每页后端状态、Gate、Named Action 和下一步 | 文档状态不得高于代码实况 |
| 对象契约 | `50_开发_dev/governance/FAMILY_CONSUMER_UI_OBJECT_MODEL_AND_CONTRACT_DESIGN_001.md` | Family、NeedInput、NeedSignal、Intent、Decision、Plan、ServiceRecord 等对象边界 | 新字段/API 必须先映射对象，不用页面临时字段绕过 |
| 波波校长/IP 研究 | `25_研究_research/docs/FAMILI_PRINCIPAL_IP_BLUEPRINT.md` | 家长第二成长、21/90 天陪伴、AI IP 语气与禁区 | E1 假设 + 待外部证据绑定 |
| 场景库 | `25_研究_research/docs/BOLE_DERIVED_SCENARIO_BANK_V0_1.md` | 手机冲突、顶嘴、厌学、拖拉、父母情绪等痛点 taxonomy | E1 场景候选，不作为专业事实 |
| 技术架构冻结 | `50_开发_dev/architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` | 六运行平面、七业务域、六业务循环、控制平面 | 当前执行技术架构 SSOT |

纪律:

1. PPT、榜样教育材料、内部 IP 研究和场景库最多是 E1，只能生成场景假设、体验输入和训练候选。
2. 不用 `all_materials.txt` 支撑证据；涉及原始材料抽取时优先使用带页码抽取或已登记来源。
3. `Perspective != Fact`，`Hypothesis != Fact`，`Recommendation != Decision != Action`。
4. 不做 Family Total Score、不做家庭 Ranking、不做儿童诊断、不把服务完成当成长 Outcome。
5. AI 输出只可形成解释、假设、候选建议或文本等价；核心状态必须经 Named Action。

## 3. 场景驱动实施方法

### 3.1 场景识别顺序

1. 从 Family 上位主链识别真实业务对象和阶段: Family、LifeStage、Profile、Priority、Journey、Action、Event、Milestone、Outcome。
2. 从三份 PPT 和当前 consumer UI baseline 提取用户可见入口、页面闭环、视觉基线和服务承诺。
3. 从家庭教育/家庭成长/榜样教育/波波校长资料提取高频家庭语境、家长心态、服务语言和禁区。
4. 从现有代码、Runtime Matrix、前后端矩阵校验当前可运行能力，不把目标态写成已完成。
5. 把场景归并到技术架构冻结的六个业务循环: `GROWTH / PLAN / ASSESSMENT / SERVICE / COMMERCE / COMMUNITY`。
6. 每个场景输出 4A 解构，再决定是否进入 UI、API、测试或评审项。

### 3.2 场景合格标准

一个场景必须同时回答:

| 检查项 | 必填问题 |
| --- | --- |
| 用户与角色 | 是家长、孩子、顾问、专家、运营还是系统在行动？是否涉及未成年人？ |
| 触发 | 来自测评、日常任务、服务、商城、内容、社区还是家庭档案回看？ |
| 业务意图 | 是理解、确认、选择、行动、记录、复盘、求助、购买意向还是公开传播？ |
| 状态边界 | 当前显示是 Fact、Perspective、Hypothesis、Recommendation、Decision、Action、Outcome 中哪一种？ |
| 数据来源 | 来自只读投影、固定 fixture、本地草稿、PostgreSQL 状态、LLM draft 还是人工服务记录？ |
| 风险 | 是否触及诊断、排名、支付、真人服务、公开外发、儿童直接作答、危机/高风险？ |
| 验收 | 哪个 UI、API、Named Action、测试和运行态证据证明它可用？ |

## 4. 项目级场景簇

以下场景簇是当前执行基线。后续逐页开发必须先映射到其中之一；如果新增场景，需要先补本节并登记来源。

| 场景簇 | 来源线索 | 业务循环 | 关联 UI | 当前实现重点 |
| --- | --- | --- | --- | --- |
| S1 家庭成长入口与今晚一件事 | PPT 首页/平台叙事、UI-01、FGAIM 三条成长主线 | GROWTH | UI-01 | 首页不是 AI 工具入口，而是家庭成长入口；只读投影、今日行动、推荐内容与服务入口必须清楚区分 |
| S2 家庭自查与支持需要确认 | UI-02/UI-07、五主题测评、场景库痛点 taxonomy | ASSESSMENT | UI-02、UI-07 | 免费测评是 L0 家庭支持需要确认；不评分、不诊断、不排名；输入为 Perspective/NeedInput |
| S3 成长解读假设与家庭确认 | UI-03/UI-08、PPT 报告页、对象契约 NeedSignal/Intent | ASSESSMENT | UI-03、UI-08 | 报告/解读只能是 Hypothesis/Recommendation；家庭确认后才形成 Intent/Decision |
| S4 90 天计划与每日行动 | UI-04/UI-05/UI-09/UI-10/UI-11/UI-12、21/90 天路径 | PLAN | UI-04、UI-05、UI-09、UI-10、UI-11、UI-12 | 计划必须由确认后的 Growth Priority/Decision 承接；行动、打卡、故事和节奏只记录过程，不制造 Outcome |
| S5 课程/训练营/资源网络 | PPT 21 天挑战、课程阶梯、资源推荐 | COMMERCE / GROWTH | UI-13、UI-14、UI-09、UI-31、UI-34 | 21 天营是业务 Program，不是 UI-35 页面；资源先是 eligible candidate/resource，不按收入排序；购买/权益必须另走商业 Gate |
| S6 会员、积分、订单与资产 | PPT 商城闭环、会员中心、客户后台 | COMMERCE | UI-06、UI-15、UI-16、UI-17、UI-18、UI-30、UI-32 | 先做沙箱意向/只读资产；不得接真实支付、真实权益发放或外部分享 |
| S7 专家、顾问、沙龙与服务记录 | PPT 名师沙龙闭环、Service OS | SERVICE | UI-19、UI-20、UI-21、UI-22、UI-23、UI-24、UI-31、UI-34 | 真人服务供给必须有资格、准入、Consent、Human Gate；预约/报名在 DEV 为 external_effect=false |
| S8 家庭私有记录、社区与分享边界 | PPT 社区闭环、UI 社区页、内容治理 | COMMUNITY | UI-25、UI-26、UI-27、UI-28 | 默认 Private First；发布、评论、点赞、公开传播必须沙箱或待审核，不当作真实社区事实 |
| S9 家庭档案、服务历史与年度回看 | 业务对象规格、Family Context Platform、客户后台 | GROWTH / SERVICE / COMMERCE | UI-29、UI-31、UI-33、UI-34 | 回看是家庭私有过程与来源标签，不是成长效果证明、家庭排名或因果结论 |
| S10 法咪莉/波波校长 AI 陪练 | IP 蓝图、场景库、技术架构 AI 平面 | GROWTH / PLAN / SERVICE | 横跨 UI-02 至 UI-12、UI-19 至 UI-24 | AI 是受控能力包，不是自由聊天首页；必须经 Model Gateway、输出校验、Human Gate 与 Eval |

## 5. 场景簇 4A 解构

### S1 家庭成长入口与今晚一件事

| 4A | 解构 |
| --- | --- |
| BA | 家长打开首页，查看家庭当前成长入口、今晚可做的一件事、测评/计划/服务/内容入口；退出路径为进入测评、任务、计划、资源或服务。 |
| DA | `FamilyHomeProjection`、Family scope、今日行动、旅程摘要、资源/服务候选；不写核心对象，不生成家庭事实。 |
| AA | UI-01 首页、六宫格、Banner、今日任务、推荐内容、底部导航；测试需覆盖入口映射与视觉热点。 |
| TA | 首页默认只读；需要帮助时走 `REQUEST_GROWTH_HELP` 或后续 `RequestGrowthHelp`，AI 摘要必须走 Gateway，Consent/Visibility 横向控制。 |

### S2 家庭自查与支持需要确认

| 4A | 解构 |
| --- | --- |
| BA | 家长基于孩子/家庭近况表达关注点，完成五主题自查，并确认“不是评分/诊断/排名”。 |
| DA | `AssessmentSessionProjection`、`NeedInput`、`AssessmentResponse`、Evidence refs；所有回答先是家庭 Perspective，不是 Child Fact。 |
| AA | UI-02/ UI-07 测评入口、单选/下拉/补充信息/边界确认/结果页；测试覆盖五主题、边界禁词、提交前置条件。 |
| TA | `START_ASSESSMENT`、`SAVE_ASSESSMENT_RESPONSE`、`SUBMIT_ASSESSMENT`；幂等、修订历史、不可变提交；LLM 不直接评分。 |

### S3 成长解读假设与家庭确认

| 4A | 解构 |
| --- | --- |
| BA | 家长查看支持方向，理解来源和局限，选择确认、暂不行动或返回补充信息。 |
| DA | `NeedSignal`、`GrowthDiagnosticHypothesis`、`Intent`、`Recommendation`；Hypothesis 不能写成 Fact，Intent 必须由家庭确认。 |
| AA | UI-03/UI-08 报告结构、雷达/方向概览/建议卡/确认出口；测试覆盖非诊断、非总分、非排名、无数据空态。 |
| TA | `CONFIRM_GROWTH_HYPOTHESIS` / `DISMISS_GROWTH_HYPOTHESIS` 或同等 Named Action；Gateway 输出结构校验；高风险触发 Human Gate。 |

### S4 90 天计划与每日行动

| 4A | 解构 |
| --- | --- |
| BA | 家庭确认一个 Growth Priority 后，进入 90 天旅程、每日行动、打卡、阶段复盘和私有故事记录。 |
| DA | `GrowthPriority`、`GrowthJourney`、`GrowthAction`、`GrowthEvent`、`ServiceRecord`、`Reflection`；打卡是过程记录，不是 Outcome。 |
| AA | UI-04/05/09/10/11/12；计划页、陪跑页、今日任务、孩子侧助手、家庭节奏、私有故事卡；测试覆盖 no-plan 不显示进行中。 |
| TA | `createJourneyPlan`、`confirmJourneyPlan`、`reviewJourneyPhase`、任务状态 Named Action、幂等、Audit/Outbox；儿童直接作答和高风险反馈继续 Gate。 |

### S5 课程/训练营/资源网络

| 4A | 解构 |
| --- | --- |
| BA | 家庭在成长方向明确后查看课程、21 天挑战、工具包或服务资源候选，形成学习/参与意向。 |
| DA | `CatalogItem`、`ResourceCandidate`、`AdmittedCandidate`、`Entitlement` 只读或沙箱；资源推荐不得由商业收入排序。 |
| AA | UI-13/UI-14 承载发现与详情，UI-09 承载每日行动，UI-31/UI-34 承载服务进度与记录；商品/课程详情、资源说明、候选卡、继续学习入口。 |
| TA | `RESOURCE_NETWORK` 与 `COMMERCE_ENTITLEMENT` 分离；购买/权益/订单必须另有 Gate；ProgramEnrollment 和每日行动必须走 Named Action；AI 只解释资源适配理由。 |

### S6 会员、积分、订单与资产

| 4A | 解构 |
| --- | --- |
| BA | 家庭查看会员权益、邀请、同行计划、积分、订单与资产，表达意向或查看沙箱资产。 |
| DA | `TestExperienceOperation`、`CustomerAssetProjection`、未来 membership/order/points ledger；DEV `external_effect=false`。 |
| AA | UI-06、UI-15 至 UI-18、UI-30、UI-32；测试必须阻断真实支付、真实权益发放、真实外部邀请。 |
| TA | `CREATE_INVITE`、`CREATE_GROUP` 等受控动作；真实支付、续费、权益生产化需要独立 Gate 和审计。 |

### S7 专家、顾问、沙龙与服务记录

| 4A | 解构 |
| --- | --- |
| BA | 家庭查看名师/顾问/活动供给，提交咨询或活动意向，后续在我的服务中查看状态与记录。 |
| DA | `Provider`、`ServiceOffering`、`AvailabilitySlot`、`BookingRequest`、`ServiceCase`、`ServiceRecord`；服务记录不等于效果。 |
| AA | UI-19 至 UI-24、UI-31、UI-34；测试覆盖资格字段、预约/取消、服务记录只读、不声称真人已发生。 |
| TA | `SubmitServiceBooking`、活动报名 Named Action；Consent、Human Gate、外部通知/真人确认在 DEV 默认关闭。 |

### S8 家庭私有记录、社区与分享边界

| 4A | 解构 |
| --- | --- |
| BA | 家庭记录故事、小记、打卡感受或查看经验内容；公开传播必须是单独选择而不是默认状态。 |
| DA | `FamilyNote`、`CommunityPost`、`Visibility`、`Moderation`、`CommentPerspective`；默认 `FAMILY_PRIVATE`。 |
| AA | UI-25 至 UI-28；发布页默认草稿/私有，动态详情不显示真实跨家庭互动计数。 |
| TA | `PUBLISH_TEMPLATE` 在 DEV 为固定模板/零外发；真实社区外发、评论、审核和未成年人内容必须 Gate。 |

### S9 家庭档案、服务历史与年度回看

| 4A | 解构 |
| --- | --- |
| BA | 家庭查看档案、过程记录、报告摘要、服务历史和年度陪伴路径，用于复盘和下一步选择。 |
| DA | `FamilyProfileSnapshot`、`FamilySupportReportSnapshot`、`ServiceRecord`、`CustomerAssetProjection`；回看必须带来源和可见性。 |
| AA | UI-29、UI-31、UI-33、UI-34；标题/文案要避免效果证明和因果承诺。 |
| TA | 只读投影或受控撤回/取消动作；Family Context Platform 只组合/索引/投影，不创建 canonical truth。 |

### S10 法咪莉/波波校长 AI 陪练

| 4A | 解构 |
| --- | --- |
| BA | 家长在测评、行动、复盘、服务前后获得温暖、稳定、低剂量、可观察的陪练支持。 |
| DA | 输入最小化 Context Snapshot；输出为事实/视角/假设/风险/下一步结构化草稿；Evidence refs 必须绑定知识库或标注 E1 假设。 |
| AA | 横跨测评解释、计划草案、任务复盘、顾问 Copilot；界面不得变成开放式聊天工具首页。 |
| TA | Model Gateway、AI Use Case Policy、Output Validator、Audit/Replay、Eval、Human Gate；不得直写 Ontology 或绕过 Named Action。 |

## 6. 逐页实现门禁

每个 UI 进入开发或优化前，必须补齐以下表格，并在对应页面研究文档或测试中留下证据。

| 门禁 | 必须满足 |
| --- | --- |
| 场景门禁 | 明确映射到 S1-S10；若不能映射，先补场景而不是先写 UI |
| BA 门禁 | 写清角色、触发、业务意图、前置/后置、退出路径、不能做事项 |
| DA 门禁 | 写清对象/投影/DTO、状态来源、Fact/Perspective/Hypothesis/Recommendation/Decision/Action/Outcome 分类 |
| AA 门禁 | 写清 route、组件、状态、错误态、原图视觉约束、测试文件 |
| TA 门禁 | 写清 API、Named Action、幂等、Audit/Outbox、Gateway、Human Gate、Consent/Visibility |
| 验证门禁 | 至少一个窄测试；可运行页面需有浏览器快照或明确工具阻塞说明 |
| 文档门禁 | 更新逐页台账；文档不得高于代码状态 |

## 7. 当前优化方向

1. 暂停从 UI06 直接继续堆页面，先让 UI06 映射到 S6 会员/积分/订单资产场景，完成 4A 后再检查代码。
2. UI01-UI05 已做的修正应回填到 S1-S4 的证据链，尤其是 UI02 免费测评、UI03 支持方向、UI04 确认后计划、UI05 私有过程记录。
3. 商业、服务、社区、成果类页面优先识别 Gate，不通过静态文案制造真实支付、真人服务、社区外发、成长结果。
4. 后续任何“AI 诊断/校长 AI/AI 管家”可见能力，都必须在 S10 中声明能力包、输入输出、Evidence、Eval 和 Human Gate。
