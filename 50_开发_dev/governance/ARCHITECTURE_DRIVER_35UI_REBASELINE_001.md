# ARCHITECTURE DRIVER — 35 UI PRODUCT SCOPE REBASELINE 001

```text
DOC_KIND     = GOVERNANCE_SSOT / ARCHITECTURE_METHOD_RULING
RULING_ID    = FAMILY-35UI-ARCHITECTURE-REBASELINE-001
RULING_DATE  = 2026-08-22
AUTHORIZED_BY= Chief Architect (owner ruling)
SUPERSEDES   = 上一轮"先有平台架构、再把 35 UI 塞进去"的隐含方法论
STATUS       = FROZEN (架构方法论最高出发点)
TRUTH_TIER   = 本文件属 §一 状态真相中的"Roadmap/Program State"之上的架构方法约束;
               它约束"怎么设计",不反向创造 Runtime/DB/GitHub 真相(见 TRUTH_HIERARCHY.md)。
```

> 本文件是这一轮系统整合的**最高架构出发点**。任何后续架构、契约、数据库、API、Agent/Skill 设计,
> 若与本文件的方法与验收条件冲突,以本文件为准(除非另有架构师签署的更高决策)。

---

## 一、方法论修正(最重要的变化)

**不是**"架构决定 35 个 UI 怎么做",**而是**"已经确定的 35 个 UI 反推出 Family 应该具备什么完整的业务架构、AI 架构、数据架构和服务架构"。

设计链固定为:

```text
35 UI → Journey → Capability → Domain → Runtime
```

而**禁止**反向的:

```text
技术架构 → 设计数据库 → 设计 API → 最后找页面来展示
```

---

## 二、冻结的边界(同等重要)

> **35 UI 是产品功能真相,不等于 35 套后台系统。**

从 35 页提炼出**少量稳定**的业务域、共享对象、AI 能力与平台服务,而不是"一页一个 Service、一页一张表"。

```text
ONE_UI_ONE_BACKEND = NO
ONE_UI_ONE_TABLE   = NO
UI_PROJECTION      = YES   # 35 页可有 35 个 Projection
SHARED_DOMAIN_MODEL= YES   # 但绝不能有 35 套 Domain / Truth
```

**核心工程原则:识别页面差异,但合并业务真相。**

---

## 三、35 UI = Family V1 Product Scope Baseline

35 个 UI(UI-01～UI-35)确立为 **Product Scope SSOT**。含义:

- **不是**说 35 页现在都必须一次性达到 Production。
- **而是**:整体架构必须能够完整解释、承载和连接全部 35 个 UI。

两个最高验收标准:

1. 任何架构如果**解释不了某一个 UI**,就还不完整。
2. 任何页面如果需要**重新发明一套后台业务模型**,就说明架构没收好。

---

## 四、产品本质定位

Family 不是"一个 AI 聊天工具",也不只是"一个家庭教育课程平台",而是:

> **Family Growth Service Platform**
> 以 AI 智能诊断为入口、以成长计划为主线、以资源和专业服务为手段、
> 以家庭长期成长档案为连续性基础。

---

## 五、七大核心业务域 + 一个横向智能层(从 35 UI 反推)

后台**不按 35 页拆**,冻结成 **7 个业务域 + 1 个横向智能层 + 1 个跨域上下文核心**。

| 业务域 | 消费者 UI | 家庭真正要解决的问题 | 关键对象(节选) |
|---|---|---|---|
| **1. Family Core** | UI-33(全 35 页提供上下文) | 谁是这个家庭/谁能看什么/谁能决定什么 | Account, Person, Family, Child, Parent, Relationship, Role, Consent, Visibility, FamilyGrowthAccount |
| **2. Growth Intelligence(测评+AI诊断)** | UI-02,03,07,08 | 我们家现在到底发生了什么 | Assessment, SituationUnderstanding, GrowthDiagnosticHypothesis, GrowthNeedSignal, FamilyInterpretation, ProgressAssessment |
| **3. Growth Journey(计划+行动)** | UI-04,05,09,11,12,29,35 | 接下来怎么持续改变 | GrowthJourney, GrowthGoal, GrowthPlan, Program, ProgramStage, GrowthAction, DailyTask, CheckIn, Reflection, Milestone, Review, ProgressProjection |
| **4. Resource & Commerce** | UI-06,13~18,30,32 | 我可以买/已经拥有什么成长资源 | ResourceOffer, ProductOffering, ProgramOffering, ServiceOffering, MembershipPlan, Subscription, Entitlement, Benefit, OrderIntent, Asset, PointsLedger, InvitationIntent |
| **5. Service OS(专家+服务)** | UI-19~24,31,34 | 什么时候需要真人,谁来帮助 | Provider, Expert, ServiceOffering, AvailabilitySlot, ServiceRequest, BookingRequest, ServiceCase, ServiceAssignment, ServiceDelivery, ServiceRecord, FollowUp, Feedback, SLA, ServiceRecovery |
| **6. Content & Community** | UI-25~28 | 能从其他内容和家庭经验得到什么 | ContentItem, Topic, FamilyNote, CommunityPost, CommentPerspective, Bookmark, Follow, ModerationState, Visibility |
| **7. Family Growth Context(跨域核心)** | 全部 35 页产生信息 | Family 到底记住了我们什么 | 长期事件链(见 §六) |
| **AI Intelligence Layer(横向)** | 全域 | — | 见 §七 |

### 关键域约束

- **Growth Intelligence**:`AI诊断`是产品能力;后台语义为
  `Assessment Evidence + Current Situation + Family Context → GrowthDiagnosticHypothesis → GrowthNeedSignal → Family Interpretation`。
  **不得**直接写 `Child = 某种问题`。`AI诊断是产品能力;Diagnostic Hypothesis 是内部智能结果;Fact 仍由 Truth 体系管理`。
- **Growth Journey**:UI-04/05/09/35 **不各做一套模型**,统一走 `Program / Stage / Action / CheckIn / Review`,区别只是 **Program Template** 不同(21天营、90天计划、7天挑战、父母情绪管理营、孩子习惯培养计划……都只是不同 Program)。
- **Resource & Commerce**:商城**不能成为系统中心**。正确关系 `成长需要 → GrowthCapability → ResourceOffer → 用户选择 → 商业权益`;UI-13 商城只是"资源发现界面"。
- **Service OS**:逐步把 `AI Coach / 21天营 / 90天计划 / 真人顾问 / 专家咨询 / 活动` 抽象成 **Growth Service**——用户看到的是"Family 正在帮我处理这件事",而非后台用了 AI 还是专家。
- **Content & Community**:必须永远服从 Family Privacy;`家庭小记/孩子表达/家庭故事` 默认 **Private First**(不是社交产品的 Public First);此域**非核心 Truth**,不定义成长。

---

## 六、Family Growth Context —— 跨域连续性核心

**不是**一张"超级画像表",**而是**一条长期事件链:

```text
家庭表达了什么 → 系统当时怎么理解 → 家庭确认了什么 → 推荐了什么 →
选择了什么 → 做了什么 → 服务发生了什么 → 家庭反馈什么 → 后来观察到了什么
```

这是 `AI诊断 / 个性化 / 服务连续性 / 资源匹配 / 长期陪伴` 的真正基础。
它与硬规则一致:`Perspective/Hypothesis/Recommendation != Fact/Decision/Action`,链条各环语义分明。

---

## 七、AI Intelligence Layer(从 35 UI 反推,不先造万能 Agent)

35 页真正需要的 AI 只有 **六类**:

| AI 能力 | 主要 UI |
|---|---|
| Situation Understanding | UI-01,02,03,07 |
| AI Diagnosis | UI-03,08 |
| Growth Planning | UI-04,35 |
| Daily Coach | UI-09,10 |
| Context Intelligence | UI-08,11,29,33 |
| Resource Recommendation | UI-01,13,19,30 |

控制平面:

```text
                Family AI Control Plane
                         │
        ┌────────────────┼───────────────┐
     Agents           Skills          Policies
   (管流程)         (管专业判断)     (管安全与授权)
```

示例映射:`Assessment Agent → Communication Assessment Skill`;
`Diagnosis Agent → Situation Understanding Skill + Growth Diagnosis Skill`;
`Growth Planner → Program Planning Skill`;
`Family Copilot → Communication / Emotion / Follow-up Skill`。

> 授权真相仍单独走 AUTHORIZATION_REGISTRY:真实外部模型默认关、pilot/production 未授权的红线不因本方法论改变。

---

## 八、目标整体架构(分层)

```text
FAMILY EXPERIENCE              UI01 ................ UI35
        ▼
EXPERIENCE APPLICATION LAYER   Home/Growth/Service/Discovery/Family Projection · Nav/Session/ViewState/BFF
        ▼
BUSINESS DOMAINS               Family Core · Growth Intelligence · Growth Journey · Resource&Commerce · Service OS · Content&Community · Family Growth Context
        ▼
GROWTH ORCHESTRATION           GrowthNeedSignal → GrowthIntent → GrowthCapability → ResourceOffer → Recommendation → Family Decision → OrchestrationPlan → ServiceCase
        ▼
FAMILY AI CONTROL PLANE        Agents · Skills · Policies · Model Gateway · Context Assembler · Output Validator · Human Gate · Audit/Replay · Eval
        ▼
DATA & TRUST FOUNDATION        PostgreSQL · Event/Audit · Consent · Identity/Authorization · Evidence · Model Run · Family Growth Context
```

---

## 九、Projection 层(整合 35 页最关键的技术设计)

页面与后台之间**必须**有 Projection 层;**不允许每个页面自己拼数据库**。

```text
35 个页面可以有 35 个 Projection,但绝不能有 35 套 Domain。
```

示例:`UI-01 → FamilyHomeProjection`(汇总:当前家庭/AI诊断状态/今日行动/当前 Program/当前 ServiceCase/推荐资源/未处理事项);
`UI-31 → MyServicesProjection`;`UI-29 → GrowthOutcomeProjection`;`UI-33 → FamilyAccountProjection`。

### 重复页面 → 合并业务真相(保留多消费者视图)

- `UI-06 我的会员 / UI-18 会员中心 / UI-30 年度陪伴` → 统一 `Membership / Subscription / Entitlement`,三个消费者视图。
- `UI-24 我的咨询与活动 / UI-31 我的服务 / UI-34 服务记录` → 统一 `ServiceCase / ServiceDelivery / ServiceRecord`,不是三套 Service。

---

## 十、Mobile 定位

```text
MOBILE = PRIMARY_CONSUMER_PRODUCT   # Family 的第一消费者产品
MOBILE = Experience Runtime         # 不是第二套业务后台
```

- **保留**:已建立的页面、视觉资产、导航、UI state。
- **逐步退出**:自己的 MySQL、openId 业务身份、直接 LLM Gateway。
- **统一**:Mobile 调用 Family API。

---

## 十一、实施方式:按 UI 用户旅程纵切(不按后台模块开发)

首批四条 Journey(每条都必须落到真实消费者闭环):

- **Journey A**(测评→AI诊断→下一步帮助):`UI07 → UI02 → Assessment Skill → Assessment Evidence → Diagnosis Agent → UI03 → GrowthNeedSignal → ResourceRecommendation → UI01/UI35/UI19`
- **Journey B**(成长营→每日行动→阶段复盘):`UI35 → UI09 → CheckIn → UI11 → Review → UI29`
- **Journey C**(AI帮助→真人服务):`UI01/UI03 → Need → UI19 → UI20 → UI21 → ServiceCase → UI24/UI31 → UI34`
- **Journey D**(资源→权益→服务):`UI13 → UI14 → OrderIntent → Entitlement → UI18/UI30 → UI32 → Service`

---

## 十二、正式修正声明(机器可读)

```text
ARCHITECTURE_DRIVER            = 35_UI_PRODUCT_SCOPE
35_UI                          = V1_PRODUCT_BASELINE
ARCHITECTURE_METHOD            = UI → JOURNEY → CAPABILITY → DOMAIN → RUNTIME
ONE_UI_ONE_BACKEND             = NO
ONE_UI_ONE_TABLE               = NO
UI_PROJECTION                  = YES
SHARED_DOMAIN_MODEL            = YES
AI_DIAGNOSIS                   = CORE
ASSESSMENT                     = CORE
PROGRAM                        = CORE
SERVICE_OS                     = CORE
COMMERCE_ENTITLEMENT           = CORE
COMMUNITY_CONTENT              = CORE
FAMILY_GROWTH_CONTEXT          = CROSS_DOMAIN_CORE
MOBILE                         = PRIMARY_CONSUMER_PRODUCT
35_UI_ARCHITECTURE_COVERAGE    = 100%
NEW_ARCHITECTURE_PASS_CONDITION= EVERY_UI_HAS_CLEAR_DOMAIN_OWNER
                               + EVERY_WRITE_HAS_CANONICAL_OWNER
                               + EVERY_AI_CALL_HAS_CONTROL_PLANE
                               + NO_DUPLICATE_DOMAIN_TRUTH
```

> 这次不是把 35 个 UI 削减成一个窄产品,而是:
> **以 35 个 UI 为完整产品蓝图,把目前散落的能力重新抽象成一套能够支撑 35 页完整运行的 Family 平台架构。**

---

## 十三、落地任务

本决策由任务 **FAMILY-35UI-ARCHITECTURE-REBASELINE-001**
(`backlog/tasks/FAMILY-35UI-ARCHITECTURE-REBASELINE-001.md`)执行,产出核心交付物为:
**35 UI × Journey × Domain × Object × API × AI × Skill × Data 矩阵**。
