# Family UI-01 至 UI-35：全量功能与业务闭环复核工作矩阵

> **用途**：将 35 个 UI 从“静态视觉基线加局部 Dev 投影”提升到完整 Family Growth OS 的可运行能力。此文件是工作底稿，不能作为已交付或已完成声明，也不纳入当前提交。
>
> **复核标准**：每页至少要回答入口、家庭私有读投影、Named Action、跨页回读、异常/空状态、审计/幂等、Consent/Human Gate、AI-ready 分层与自动化/浏览器证据。完整 90 天能力必须覆盖 `Profile → Priority → Intervention → Action → Event → Milestone → Outcome → Next Journey`，而非仅页面跳转或单次 no-op 回执。

## 一、全局事实与当前结论

| 维度 | 当前已有基础 | 距完整方案的主要缺口 |
|---|---|---|
| 家庭身份与范围 | `family_id`、Parent、Child、关系、LifeStage、Consent 及 account-scoped Bearer 已存在；多数动态接口 family-private。 | 需要把页面级读取统一收敛为 Consent Context，补齐 purpose/version/withdrawal 对计划、社区、服务、模型使用的实时影响。 |
| 成长主链 | Onboarding、Profile/Insight、Report、Plan preview、Today action、Action completion、私密 Perspective 和部分 readback 已接通。 | 尚未形成可持久化的 90 天 Journey、Phase、Goal、Intervention assignment、Action schedule、Milestone、Outcome、Phase transition 的完整状态机。 |
| AI-ready | Fact/Perspective/Recommendation/Action 分层与 Model Gateway no-op 边界已有；解释为 rule-based 文本等价物。 | 尚无 KnowledgeCard/Intervention Registry/Model trace/Evaluation set/Planner 调整协议的完整运行实现。 |
| 人工服务 | 支持主题、咨询需求、活动了解意向、服务记录在 Dev 已以 no-op 草稿/回读存在。 | 尚无 case owner、供给可用性、排期确认、人工审核、服务执行、服务复盘的完整状态机与 adapter。 |
| 商业与会员 | 商品了解意向、邀请/团购草稿、积分、年度会员、续费兴趣、资产说明已在 Dev 可读写或回读。 | 尚无 OrderRef/PaymentRef/Entitlement adapter、权益核销、续费确认、退订/退款引用或外部交易状态同步；不得在当前 UI 内伪造。 |
| 社区内容 | 交流阅读、私有分享草稿、表达笔记、私有回读已存在。 | 尚无可审计的可见性策略、内容审核、同意发布、撤回、发布 adapter、互动 moderation 与家庭/未成年人保护状态。 |

## 二、逐页功能与完整闭环差距

| UI | 页面/业务域 | 已有运行能力与血缘证据 | 按完整解决方案需补齐的能力 |
|---|---|---|---|
| UI-01 | 家庭首页/入口 | 今日任务投影、成长启动入口、专家直播 no-op 意向及服务记录回读。 | 家庭首页要汇总三条成长线、当前 Journey/Phase、Milestone、待确认建议、异常与人工支持状态；专家直播要接入外部直播 adapter 的 pending/confirmed/cancelled 生命周期。 |
| UI-02 | 成长启动 | active onboarding 恢复、关注方向选择与受控启动；UI-01 入口已对齐。 | 完整需求收集、家庭确认、支持强度选择、Consent purpose、风险/升级分流、生成 Journey 草案。 |
| UI-03 | 成长说明 | 受控规则说明、非诊断解释、进入计划预览。 | 三条 Profile 的来源、Evidence、置信度、家庭异议/补充 Perspective、Priority decision confirm 与可回退机制。 |
| UI-04 | 报告解释 | family-private report explanation；浏览器可进入 UI-05。 | Report 必须按 Fact/Perspective/Recommendation 展示，支持证据链、版本、人工复核、家庭确认和失效条件。 |
| UI-05 | 90 天计划 | 四阶段候选草稿、刷新和今天行动交接已可浏览器验证。 | 必须实现 Journey/Phase/Goal/Intervention/Action Template 持久化、家庭确认、Day 1–90 编排、暂停/恢复/换方案、阶段转换、复盘和下一 Journey。 |
| UI-06 | 私密服务旅程 | 私密 check-in draft、服务旅程投影、UI-07/08 readback。 | 需要 Perspective 分类、来源授权、人工可见性、升级分流、草稿确认/撤销及与正式 GrowthEvent 的严格区分。 |
| UI-07 | 成长档案 | family-private growth profile readback、跳转计划/回顾。 | 三张动态 Profile 的版本、有效期、Evidence/Confidence、人工确认、profile change lineage。 |
| UI-08 | 家庭回顾 | family review readback 与 UI-06 写后读。 | Day14/35/60/90 Review、趋势而非评分、家庭共同决定、cycle review action、next-step assignment。 |
| UI-09 | 今日行动 | Today projection、CompleteGrowthAction、idempotency、回执与 readback。 | 正式 action schedule、延期/跳过/替换原因、共同家庭行动、执行阻断识别、行为证据与 phase 进度关联。 |
| UI-10 | 成长小助手 | rule-based/no-op explanation、无模型直接调用、回到今日行动。 | Family Companion 对话状态、知识来源、受控工具调用、建议确认、风险升级、评估/trace；儿童独立体验仍应后置。 |
| UI-11 | 成长旅程 | 过程投影、UI-35 营期行动回读、到计划/回顾/故事路由。 | 正式 Journey timeline、当前 phase、cycles、milestones、transition action、适配不同支持强度。 |
| UI-12 | 家庭故事 | 过程片段的 private readback；无排名/总分/公开发布。 | 家庭可确认的 Milestone 叙事、来源/可见性/撤回、与 Outcome case 的非因果关联；默认私有。 |
| UI-13 | 商城目录 | family-scoped catalog read、无支付浏览。 | Catalog/Knowledge/Intervention 的关联、适用条件、权益资格、外部订单 adapter 状态。 |
| UI-14 | 商品详情/意向 | no-payment 商品了解意向；UI-32 家庭私有回读。 | 意向→OrderRef/Entitlement referral 受控交接，价格/资格/退款需外部 adapter 与人机确认，不能在页面直接完成。 |
| UI-15 | 邀请 | private invitation draft、Bearer-only 回归。 | Referral eligibility、真实 Milestone/Outcome 依据、分享 Consent、外发 adapter、撤回与审计。 |
| UI-16 | 组学草稿 | group study draft、无外部通知/报名。 | 群体/同意/可见性、活动容量、组织者审核、成员关系与外部社群 adapter。 |
| UI-17 | 积分/过程回看 | family-private platform readback，Bearer-only。 | 积分 ledger、来源、失效、兑换 eligibility、外部权益适配；禁止将行动打卡直接转为可消费积分。 |
| UI-18 | 我的成长服务 | 服务范围、成长画像/计划/支持主题导航。 | 当前服务 case、服务级别、owner、SLA、下一步和正式状态机。 |
| UI-19 | 专家支持主题 | admitted teacher-supply 只读投影、咨询入口。 | 专家资格、适用条件、禁忌/风险、供给/时区/可预约时段、专业人工审核。 |
| UI-20 | 服务说明 | 支持说明至咨询需求路径。 | 服务 explanation version、家庭适配、cost/benefit disclose、consent/human gate 和 booking policy。 |
| UI-21 | 咨询需求 | slots read、consultation need draft、support records readback；无真实预约。 | Booking lifecycle（requested/reviewed/offered/confirmed/cancelled）、人工排期、服务 owner、外部 calendar/notification adapter。 |
| UI-22 | 活动目录 | activity catalog/详情路由。 | 活动资格、容量、权益/费用、等候、取消、Consent、外部报名 adapter。 |
| UI-23 | 活动详情 | no-op registration interest、UI-24 服务记录回读。 | 正式 RegistrationRequest、审核/占位/确认状态；当前必须明确不占席不通知。 |
| UI-24 | 我的服务 | UI-21 咨询与 UI-23 活动意向的服务记录 readback。 | 统一 ServiceInteraction timeline、实际服务交付、复盘、服务质量、人工处理与 case closure。 |
| UI-25 | 家庭交流 | private reading projection、分享草稿入口。 | 内容范围/可见性/审核、家长社群 membership、publication consent，公开互动应被 adapter/human moderation 守护。 |
| UI-26 | 分享草稿 | 私有 draft、UI-28 刷新 readback。 | Draft lifecycle（private/review/request_publish/published/withdrawn）、media/evidence policy、内容审核与发布审计。 |
| UI-27 | 交流详情 | private detail readback、返回交流。 | 来源、可见性、内容版本、举报/撤回、仅在 consent 后允许公开。 |
| UI-28 | 我的小记 | 从 UI-26 持久化草稿恢复 Perspective。 | Expression Notes 到 Event/Milestone 的家庭确认、tag/relationship、保留/删除、导出/共享权限。 |
| UI-29 | 成长回顾 | growth review projection、跳转计划/家庭故事。 | Day14/35/60/90 review protocol、Observation/Evidence、MeasureOutcome、confounders、associated-with only、下一阶段选择。 |
| UI-30 | 年度会员 | 积分 readback、邀请说明、renewal interest draft。 | Membership lifecycle、Entitlement grant/consume、OrderRef/PaymentRef external adapter、续费确认/取消与 audit。 |
| UI-31 | 我的服务 | service/projected readback、跳转今日行动/计划/记录。 | 服务包和 Growth Journey 的归属、有效期、交付量、服务状态、人工 owner。 |
| UI-32 | 订单与资产 | membership/points + UI-14 意向回读；明确非订单/支付。 | 正式订单、退款、权益、优惠券、资产同步必须通过 adapter；可展示外部 reference 不持有支付核心状态。 |
| UI-33 | 家庭档案 | family-private profile projection、非诊断边界。 | Profile consent purpose、三主体档案、版本/更正/撤回、家长/孩子权限与数据导出边界。 |
| UI-34 | 服务记录 | family-private consultation/activity/readback、无状态变更。 | 全量 timeline、case note 权限、人工服务结论与家庭可见性、正式服务关闭/复开状态。 |
| UI-35 | 21 天成长营 | Day validation、daily action receipt、UI-11 journey readback。 | Growth Program 实例、day schedule、课程/资源、连续性但非总分、phase/90-day Journey 的可选交接、结束回顾与下一阶段确认。 |

## 三、完整 90 天 Journey 的最低验收状态机

```text
DRAFT
  → FAMILY_CONFIRMED
  → ACTIVE(SEE / PARENT_FIRST / CO_CREATE / STABILIZE)
  → PAUSED | ADJUSTMENT_PENDING | HUMAN_REVIEW_REQUIRED
  → REVIEW_DUE(D14/D35/D60/D90)
  → COMPLETED | ARCHIVED
  → NEXT_JOURNEY_DRAFT
```

每次状态变化均必须由 Named Action、`idempotency_key`、`actor_id`、`family_id`、`consent_context`、`audit_event` 和 `external_effect=false/adapter_receipt` 支撑。计划候选、AI/规则 Recommendation、父母 Perspective、Observation、Milestone 和 Outcome 必须是独立对象，不能互相自动提升。

## 四、优先实施次序（全量能力而非最小演示）

| 批次 | 目标 | 首要对象/动作 | 影响 UI |
|---|---|---|---|
| A | 正式 90 天 Journey 状态机 | GrowthJourney、Phase、Goal、Start/Confirm/Pause/Transition/Complete actions | UI-01–UI-12、UI-29、UI-35 |
| B | Intervention 与行动编排 | Intervention Registry、ActionTemplate、Schedule、Replace/Skip/Shared action | UI-05、UI-09、UI-10、UI-11、UI-35 |
| C | 反馈、复盘、Milestone 与 Outcome | Observation、Perspective、Review、ConfirmMilestone、MeasureOutcome、Next stage | UI-06–UI-08、UI-12、UI-28–UI-29、UI-33–UI-34 |
| D | 人工服务完整状态机 | ServiceCase、BookingRequest、HumanReview、ServiceInteraction、adapter receipts | UI-01、UI-18–UI-24、UI-31、UI-34 |
| E | 商业会员与权益 adapter | Intent、OrderRef、Membership、Entitlement、Renewal、Referral | UI-13–UI-17、UI-30、UI-32 |
| F | 内容与社区治理 | ContentItem、Draft、Visibility、PublicationConsent、Moderation、Withdrawal | UI-25–UI-28 |
| G | AI/知识/评估 | KnowledgeCard、Evidence、InterventionVersion、ModelTrace、EvalCase、HumanGate | UI-02–UI-12，贯穿全部页面 |

## 五、全量完成的判定

“完成”不能仅表示 UI 有跳转、静态图、synthetic 文案或 no-op receipt。每个批次至少要求：真实 family-private 数据关系；Named Action；readback；空/错误/撤销状态；审计与幂等；同意/人工/adapter 边界；单元/HTTP E2E/前端 authenticated 回归；浏览器证据；与前后页面闭环证据。外部支付、通知、直播、排期、公开发布仍以 adapter 受控接入，而非在 Dev 中伪造完成。
