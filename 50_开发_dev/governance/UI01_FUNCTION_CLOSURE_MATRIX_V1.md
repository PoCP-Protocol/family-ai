# UI01 功能闭环与依赖 UI 开发矩阵 V1

状态：`IN_PROGRESS`  
基线：3 份 PPT、35 个 UI、六条业务闭环  
产品可见品牌：Family / 伐木累

## 1. 设计规则

1. UI01 是家庭成长旅程入口，不是静态导航页；每个入口必须落到可恢复的领域状态、家庭范围 API、持久化数据、审计和明确退出路径。
2. 路径统一采用“家庭选择支持场景 → 家长小步行动 → 家庭私有记录 → 阶段回顾 → 继续/调整/暂停”。
3. 测评、说明、打卡与回顾不得被表达为儿童分数、医学/心理诊断、因果效果或跨家庭排名。
4. 推荐只能来自已审核且在有效期内的产品/服务目录；家庭必须显式决定，系统不得自动下单、预约、外发或联系真人。
5. 家庭教育内容按年龄、家庭情境和个体差异适配；未成年人隐私、人格尊严和参与意见的权利优先。

## 2. UI01 入口闭环

| UI01 功能 | 目标 UI | 核心对象与状态 | 当前实现 | 下一验收门 |
|---|---|---|---|---|
| 免费家庭测评 | UI02 → UI03 | AssessmentToolVersion / Session / Response / Evidence / GrowthHypothesisDecision | 已实现版本锁定、同意门、提交不可变、显式确认 | App/Web 视觉与异常态复验 |
| AI 成长说明 | UI03 → UI04 | Evidence-bound Hypothesis / GrowthIntent / Report Projection | UI03 已实现；UI04 已有计划前置运行态 | UI04 报告证据来源、限制与行动交接复验 |
| 21 天挑战营 | UI35 → UI09 → UI11/UI12 | ProgramVersion / Enrollment / DayCheckin / ParentReflection | 本轮升级为商业持久化生命周期 | Web UI 接入商业投影、暂停/取消/结营回顾 |
| 90 天成长计划 | UI04 → UI05 → UI09 | GrowthPriority / JourneyPlan / Phase / GrowthAction / Review | 已存在真实计划与任务 API | 按 PPT 90 天四阶段和完整异常路径复验 |
| 成长案例 | UI12 → UI29 | Family-private Story / EvidenceRef / PublicationConsent | 有家庭私有故事读模型 | 明确“私有回看/公开授权”双门与无效果宣称 |
| 专家直播 | UI19 → UI20 → UI24 | Admitted ServiceOffering / LiveSession / Interest / ServiceRecord | 已有已准入供给与内部兴趣回执 | 直播状态、场次容量、取消与履约适配器 |
| 家庭顾问 | UI19 → UI20 → UI21 → UI24 | Provider / Offering / Availability / ConsultationNeed / Booking | 已有供给与咨询需要草稿 | 预约状态机、真人服务 Gate、售后和 SLA |
| 今日成长任务 | UI09 → UI08/UI11 | GrowthAction / ExecutionLifecycle / Checkin / Review | 已实现开始、暂停、继续、取消、打卡 | 多来源任务编排与冲突规则 |
| 推荐内容/服务 | UI13 → UI14 或 UI19 | Admitted Catalog / Recommendation / Interest | 首页只读已准入目录；目标按后端 target_ui | 详情、权益、订单意向与无支付边界 |
| 家庭上下文/更多 | UI33/UI34 | Family / Membership / Consent / ServiceRecord | 当前聚合到 UI34 | 拆分家庭资料、权限、同意与服务记录 |
| 提醒 | 待确定（当前 consumer UI baseline 没有独立提醒页） | ReminderPreference / NotificationAttempt / DeliveryReceipt | 明确显示 NOT_CONFIGURED，不伪装可用 | 确认目标 UI 与通知渠道合规后实现 |
| 底部计划/社群/我的 | UI05 / UI25 / UI30 | Journey / PrivateCommunity / CustomerAccount | 页面已存在 | 逐入口完成商业状态与权限复验 |

## 3. 三份 PPT 追踪

- 商业模式 PPT：第 2 页定义持续家庭关系；第 4、7、17 页定义测评—21 天—90 天—会员/服务路径；第 11、15 页定义咨询、档案和统一账户；第 19 页定义完成率、留存和 LTV 指标。
- 战略白皮书：第 6、9、12 页定义“行为改变—成长记录—AI陪伴”和第一阶段“训练营 + AI陪练 + 成长报告”；第 13—19 页要求交付 SOP、指标、知识/画像/Agent/数据结构；第 27—29 页要求先验证产品与交付确定性。
- 家庭教育大模型平台合作方案：第 2、4、5、6 页约束平台愿景、商业闭环、核心板块和阶段节奏。

## 4. 外部研究补充规则

- 《家庭教育促进法》：家长/监护人承担主体责任；尊重未成年人身心规律、个体差异、人格、隐私和参与意见；平台定位为指导、支持和服务。
- WHO 2023 parenting intervention guideline：课程面向家长/照护者，目标包括减少严厉教养、改善亲子关系；产品不得把一般支持包装成诊断或保证性效果。
- UNICEF parenting support evidence：优先采用优势视角、示范与榜样、练习与演练、正向反馈；因此每一天必须包含“示范语句—小行动—家长回顾”，而不是只看视频或读文章。
- CDC/Harvard：日常规则应保持一致、可预测、可执行；互动强调积极倾听和响应式往返。因此任务要小、清楚、可暂停、可恢复，并允许孩子表达意见。
- “父母二次成长”与波波校长公开内容作为产品定位/内容线索（E1），不作为疗效证据、诊断依据或用户事实。

## 5. 本轮 UI35 商业化落地

- 迁移 `0043_ui35_growth_camp_lifecycle.sql`：版本化课程、21 天内容、报名、逐日记录、幂等操作。
- API：UI35 投影、报名、逐日打卡；家庭/租户/权限/服务同意复核；审计日志与 Outbox 事件。
- App：选择服务对象、显示课程版本和真实进度、UI35→UI09 当日行动、失败可重试。
- Web：共享 API adapter 已补齐读取、报名、打卡方法；Web UI 的商业投影替换列入下一验收门。
- 边界：只记录家长行动与家长视角；不评分、不诊断、不跨家庭比较、不自动生成 90 天计划或订单。
