# UI-06 BA Design: 90 Day Growth Plan

> **页面：** UI-06 陪跑服务 / 社群服务
>
> **当前状态：** BA_DESIGN_DRAFT / DOC_ONLY；未批准进入业务代码实现。
>
> **Visual baseline：** `apps/web/public/bangyang-reference/delivery-community-reference-458x1128.png`。

## Scope

UI-06 是 UI-05 计划之后的服务旅程承接页，承载家庭顾问、班主任陪跑、AI 提醒、专家答疑、本周完成度、成长打卡、家长交流、本周直播和私有服务/社群入口的可见结构。它的首轮业务目标是让家庭**查看受控的陪跑服务投影和家庭私有过程记录**，而不是把静态社群内容变成公开社区、真人服务履约、通知或效果证明。

UI-06 读取 UI-05/服务旅程相关 projection，允许在明确授权后通过受控动作产生打卡/回顾草稿；首轮不得自动创建 Journey、Task、Intervention、ServiceCase、Booking、Notification、CommunityPublication 或 Outcome。

## Source Research

### 证据来源与等级

| 来源 | 用途 | 证据边界 |
|---|---|---|
| `BANGYANG_34_UI_AND_3_PPT_MASTER_DELIVERY_PLAN_001.md` UI-06 条目 | 页面名称、入口/出口、可见文案、控件、布局和不确定文案 | 视觉/页面线索；不能证明后台能力已实现。 |
| `delivery-community-reference-458x1128.png` | 单页视觉 baseline | 视觉证据；不可辨认文字不猜测。 |
| `FAMILY_34_UI_EVIDENCE_OBJECT_INVENTORY_V1.md` | UI-06/UI-10 对象候选：ServiceOffering、AssistantSession、Reminder、CommunityPost、LiveSession、ServiceJourneyProjection | 对象设计线索；需契约验证。 |
| `FAMILY_34_UI_MASTER_DATA_API_NAMED_ACTION_MAPPING_V1.md` | UI-06 `ServiceJourneyProjection`、ServiceCase、ServiceRecord 和状态上限 | 治理/对象 SSOT；当前实现仍为 backend gap。 |
| `FAMILY_34_UI_FRONTEND_BACKEND_CONSISTENCY_MATRIX_001.md` | UI-06 为 `UI_READY_BACKEND_GAP`，仅允许受控说明和服务旅程只读 DTO | 一致性门禁；不能用路由通过替代 DTO/测试通过。 |
| Family UI BA Design Gate | 研究→设计→视觉→契约→实现→截图差异闭环 | 方法规则，不是业务事实。 |

### 需求来源链

```text
家庭教育实践：持续陪伴比一次性建议更需要可回顾的过程支持
→ 家庭成长需求：家长需要知道本周做了什么、下一步可否继续或暂停
→ 角色/场景：监护人查看陪跑服务、家庭打卡和交流入口
→ 证据：UI-06 视觉线索 + 现有对象/治理文档
→ 需求理解：提供私有、受控、可撤回的服务旅程投影
→ 实现切片：UI-06 read projection + safe-stop/decision stub
→ 验收：字段契约、scope/consent、状态测试和截图对标
```

“家庭陪伴有效”“78%代表真实成长效果”“家长动态证明孩子发生了改变”等均不是本报告可确认的事实。榜样教育/波波校长及自家材料如被引用，最高按 E1 作为假设/设计素材，不自证成立。

## 90 Day Growth Design

UI-06 不重新设计 90 天计划；它把 UI-05 的计划草稿/已确认回显与后续服务旅程投影连接起来。90 天在本页只表示家庭计划的时间容器，不是效果承诺、诊断、总分或排名。

| 90 天阶段 | UI-06 可见服务支持 | 允许的首轮语义 | 禁止解释 |
|---|---|---|---|
| Day 01–30 关系与启动 | 家庭顾问/班主任说明、可回顾的本周任务投影、家庭打卡入口 | “当前计划/过程记录显示……” | 不说“家庭已改善”或“孩子已被诊断”。 |
| Day 31–60 练习与调整 | 练习记录、提醒说明、暂停/继续入口、家长交流模板 | “可继续、暂停或查看说明” | 不自动调整计划，不自动发通知。 |
| Day 61–90 回顾与下一步 | 私有进度回顾、服务记录摘要、待确认下一步 | “形成回顾草稿，等待家庭确认” | 不把完成度、点赞、评论或次数解释为 Outcome。 |

### 过程状态原则

“7/9”“78%”“完成 3 次亲子沟通练习”“孩子情绪记录 3/3 天”“学习计划执行 4/6 天”只能作为 synthetic/private process projection 的示例字段。必须标明 `source`、`as_of`、`projection_version` 和可见范围；不得升级为家庭成长评分、儿童诊断、效果证明或跨家庭比较。

## BA Object Model

| 对象 | UI-06 关系 | 首轮边界 |
|---|---|---|
| `Family` / `Person` / `FamilyMembership` | family scope、角色和可见范围 | 服务端派生，不信客户端 family/actor/subject。 |
| `Consent` | 读取计划/服务/儿童资料/社区私有投影的 purpose gate | 缺失或撤回立即 fail-closed。 |
| `JourneyProjection` / `ServiceJourneyProjection` | 页面主读模型 | 只读 projection，不是真相表。 |
| `ServiceOffering` / `Provider` / `Activity` | 家庭顾问、班主任、专家答疑和直播的 admitted catalog 摘要 | 不代表真人已承诺服务，不显示未验证资质。 |
| `ServiceCase` / `ServiceRecord` | 已受控记录的服务过程 | 过程记录不等于效果，不由 LLM 创建。 |
| `AssistantSession` / `Reminder` | AI 提醒/助手入口 | 仅说明或草稿；Model Gateway 约束，不自动发送。 |
| `CommunityPost` / `LiveSession` | 私有 synthetic feed / 直播信息投影 | 不公开发布、不预约、不外发。 |
| `TaskInstance` / `TaskProgressProjection` | UI-05/UI-09 计划/任务回读 | UI-06 首轮只读，不自动完成任务。 |
| `Evidence` / `Outcome` | 过程证据与未来结果边界 | 不将过程投影写为 Outcome。 |

## State Machine

| 状态 | 用户可见表现 | projection source | 允许动态级别 | 禁止升级 |
|---|---|---|---|---|
| `STATIC_BASELINE` | 原图页面结构和固定文案 | visual baseline | L0 | 不以静态文案声称服务已发生。 |
| `LOADING` | 原布局中的加载状态 | API pending | L1 | 不显示猜测数据。 |
| `READ_ONLY_READY` | 服务卡、完成度、私有动态和 tab | `ServiceJourneyProjection` | L1 | 不创建服务/社区/通知事实。 |
| `CONSENT_REQUIRED` | 权限/Consent 提示仍在原状态区 | policy result | L1 safe stop | 不绕过 Consent。 |
| `REVIEW_REQUIRED` | provenance/version/资格不全的安全停止 | policy/Gateway | L1 safe stop | 不展示未经验证的服务或儿童信息。 |
| `CHECKIN_DRAFT` | “＋打卡”形成家庭私有草稿 | draft projection | L2 | 不直接写 CommunityPost/Outcome。 |
| `FAMILY_DECISION_PENDING` | 继续/暂停/调整的待确认状态 | decision candidate | L2 | 不把候选当作 Decision/Action。 |
| `DECISION_READBACK` | 已确认的私有回执 | approved Named Action readback | L3 only if separately approved | 不自动创建 ServiceCase/通知/直播预约。 |
| `EXTERNAL_EFFECT_HOLD` | 预约、外发、真人联系等 HOLD | adapter/policy | L4 HOLD | 不产生真实外部 effect。 |

## UI Content Mapping

| 视觉区域 | 可见内容 | BA 对象/字段 | 动态规则 |
|---|---|---|---|
| Header | “陪跑服务”、返回、更多、圆形图标 | route/page metadata | 位置和层级不可变；右侧图标功能不猜测。 |
| 2×2 Service Cards | 家庭顾问、班主任陪跑、AI提醒、专家答疑 | admitted ServiceOffering/Provider/Assistant/LiveSession projection | 只显示来源明确的说明；不表示已预约或真人在线。 |
| Completion Card | 本周完成度、7/9、78%、三条任务记录 | TaskProgressProjection / process record | 标为过程投影；不能写成成长效果或评分。 |
| Content Tabs | 成长打卡、家长交流、本周直播 | PrivateCommunityProjection / LiveSession projection | tab 可切换只读内容；公开外发和真实直播互动 HOLD。 |
| Feed Items | 家长昵称、时间、文本、已打卡、点赞/评论 | Synthetic/private post projection | 只使用 synthetic/private fixture；不能写入公共社区或敏感原文。 |
| Floating CTA | “＋ 打卡” | CheckinDraft candidate | 首轮只生成私有草稿或 NO_ACTION；需 Consent/actor scope。 |
| Bottom Navigation | 首页、计划、社群、我的；社群选中 | route state | 维持原图选中态和导航位置。 |
| Failure states | loading、empty、permission、consent、HOLD | policy/error DTO | 在原画面骨架内表达，不用通用空白页替代。 |

低清文案“1对1专业陪导”“全程陪伴学习”“智能提醒不过漏”等必须保持原图可见文本或进入 `NEEDS_CONFIRMATION`；不可由 BA 设计自行补字。

## Backend Contract Implication

Stage B API Contract 应至少定义：

```text
GET /families/:familyId/ui-06/service-journey-projection
GET /families/:familyId/ui-06/private-community-projection
POST /families/:familyId/ui-06/checkin-draft
POST /families/:familyId/ui-06/decision-candidate
```

以上是候选路径，不是已批准 endpoint。所有 DTO 必须包含 `source`、`visibility`、`version`、`status`、`projection_version`、`as_of`、`source_refs`、`policy_version`、`consent_ref` 和 `expires_at`（适用时）。写 DTO 不接受客户端 `family_id`、`tenant_id`、`actor_person_id`、`subject_person_id`、模型名、外部 URL、服务商联系方式或自由文本核心状态。

`＋打卡`首轮只能通过受控的 `CreatePrivateCheckinDraft` 或等价 Named Action；它不得创建公开 `CommunityPost`、真实 `ServiceRecord`、Outcome 或 Notification。AI 提醒/解释必须经 Model Gateway，输出说明/草稿/安全停止，不能自动发送或改写核心对象。

## Risk and Human Gate

| 风险 | Gate/HOLD |
|---|---|
| 78%/7/9 被理解为评分或效果 | `NO_SCORE_NO_EFFECT_CLAIM`；仅 private process projection。 |
| 家长动态被外发 | `PRIVATE_ONLY`；公开 CommunityPublication 永久独立 Gate。 |
| 家庭顾问/班主任/专家被理解为真人已承诺 | `HUMAN_SERVICE_GATE`；不预约、不联系、不宣称在线。 |
| AI 提醒自动通知 | `NOTIFICATION_EXTERNAL_EFFECT_HOLD`；只返回说明/草稿。 |
| 儿童情绪记录或家庭文本泄露 | `CHILD_DATA_CONSENT` + guardian scope + Human Gate。 |
| 直播入口变成真实报名/视频 | `VIDEO/LIVE_ADAPTER_HOLD`。 |
| CTA 直接创建 Task/Case/Outcome | Named Action boundary；首轮只 projection/draft/no-op。 |
| 不清晰视觉文字被猜测 | `NEEDS_CONFIRMATION`，不进入动态 copy allowlist。 |

## Acceptance Criteria

### BA and Contract

- [ ] 所有 UI-06 字段标明 source、visibility、version、status 和 projection boundary。
- [ ] `Recommendation != Decision != Action` 在服务卡、打卡 CTA、AI 提醒和社群 tab 中保持成立。
- [ ] Consent、guardian scope、child-data visibility、Human Gate、audit、idempotency 和 correlation_id 已进入 Contract Plan。
- [ ] 未确认的低清文案、服务资质、真人在线状态和直播/预约能力均保持 `NEEDS_CONFIRMATION` 或 HOLD。

### Visual Fidelity

- [ ] 以 `delivery-community-reference-458x1128.png` 为 baseline。
- [ ] 完整复刻 Header、2×2 服务卡、完成度卡、三个 tab、两条动态、悬浮“＋ 打卡”、底部四项导航及“社群”选中态。
- [ ] 不使用通用社区模板替代原画面，不删除低清/截断区域，不重新设计布局。
- [ ] 对 static、loading、empty、permission、consent、review-required、checkin-draft、pending 和 safe-stop 状态进行 screenshot diff。

### Runtime and Tests

- [ ] API projection/contract test 证明 family/tenant/subject scope 和 DTO 字段一致。
- [ ] Web page-object/route test 证明 UI-06 route、tab、CTA 和 error states 与 API 状态一致。
- [ ] Consent 缺失、儿童越权、跨家庭、过期 projection、无 provenance、外部 effect 请求均 fail-closed。
- [ ] `＋打卡`不会创建真实 CommunityPost、ServiceCase、Task、Outcome、Notification 或外部 effect。
- [ ] 只有测试通过、视觉差异修复并形成小提交后，才可声明 UI-06 slice complete。

## Gate Verdict

```text
BA_DESIGN=READY_FOR_ARCHITECT_REVIEW
VISUAL_BASELINE=LOCATED_WITH_TEXT_AMBIGUITIES
API_CONTRACT=NOT_STARTED
CODE_IMPLEMENTATION=NO_GO
EXTERNAL_EFFECT=HOLD
```

## References

[1]: `governance/BANGYANG_34_UI_AND_3_PPT_MASTER_DELIVERY_PLAN_001.md` UI-06 canonical baseline
[2]: `governance/FAMILY_34_UI_EVIDENCE_OBJECT_INVENTORY_V1.md` UI-06 object candidates
[3]: `governance/FAMILY_34_UI_MASTER_DATA_API_NAMED_ACTION_MAPPING_V1.md` UI-06 mapping
[4]: `governance/FAMILY_34_UI_FRONTEND_BACKEND_CONSISTENCY_MATRIX_001.md` UI-06 readiness
[5]: `governance/FAMILY_34_UI_EVIDENCE_OBJECT_RELATIONSHIP_MODEL_V1.md` UI-06 relationship model
[6]: `apps/web/public/bangyang-reference/delivery-community-reference-458x1128.png` visual baseline
[7]: `skills/family-ui-ba-design-gate/SKILL.md` reusable gate workflow
