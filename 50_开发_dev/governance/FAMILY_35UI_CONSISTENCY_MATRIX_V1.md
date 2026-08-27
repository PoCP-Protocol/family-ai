# FAMILY 35UI 一致性矩阵 (V1)

> 本文件由 `tools/validate-35ui-consistency.mjs --emit` 自动生成,请勿手改。
> 叠加于 V4.1;canonical 前端 = `apps/mobile`;`35_UI_BACKEND_COMPLETE=NO`。
> `named_actions_implemented` = 归一化精确匹配到后端 `@Require*Action` guard 的动作(实测);
> `naming_divergence` = 疑似改名的后端 guard(advisory,须架构师裁决),**不计入已实现**。

## 汇总

- screens: **35**
- canonical 前端(mobile)覆盖: **35/35**
- web 35UI 覆盖: **0/35 (ABSENT_BY_DESIGN)**
- 契约覆盖: **35/35**
- named_actions: declared=**56** / defined_in_specs=**3** / implemented_exact=**3** / naming_divergence=**44**
- 判定分布: {"BACKEND_WIRED":2,"DECLARED_ONLY_GATED":25,"READONLY_BY_DESIGN":7,"PARTIAL_BACKEND":1}

### 三套动作词汇(互不相认,须架构师裁决统一)

- 矩阵 named_actions(SCREAMING_SNAKE)
- specs/actions 注册表(PascalCase): `AddChild`, `AddParent`, `AssignLifeStage`, `CloseInterventionCycle`, `CompleteGrowthAction`, `CompleteGrowthReview`, `ConfirmGrowthPriority`, `CreateFamily`, `CreateFamilyRelationship`, `GrantConsent`, `RecordNextStepDecision`, `RecordOutcomeObservation`, `StartIntervention`
- 后端 guard(PascalCase): `AddChild`, `CompleteAction`, `ConfirmGrowthIntent`, `ConfirmGrowthPriority`, `ConfirmJourneyPlan`, `CreateJourneyPlan`, `DecideGrowthService`, `ExecuteFamilyPageObjectAction`, `ExecuteTestExperienceAction`, `GrantConsent`, `InviteAdult`, `ManageMembershipEntitlement`, `PauseJourneyPlan`, `ReadFamily`, `RecordPerspective`, `RequestGrowthHelp`, `ReviewJourneyPhase`, `StartIntervention`, `SubmitCommerceIntent`, `SubmitServiceBooking`, `SubmitServiceFollowUp`

## 逐 UI

| UI | 标题 | loop | 域 | runtime_status | declared | defined_in_specs | implemented | 判定 | 关闭 Gate |
|---|---|---|---|---|---|---|---|---|---|
| UI-01 | 家庭成长首页 | GROWTH | FAMILY_CORE | READ_ONLY_PROJECTION | REQUEST_GROWTH_HELP | — | REQUEST_GROWTH_HELP | BACKEND_WIRED | G1/G2 (write path per owning domain) |
| UI-02 | 家庭测评 | ASSESSMENT | GROWTH_INTELLIGENCE | GATE_BOUNDARY | START_ASSESSMENT, SAVE_ASSESSMENT_RESPONSE, SUBMIT_ASSESSMENT | — | — | DECLARED_ONLY_GATED | G2+ business gate (payment/human/child/public) |
| UI-03 | 家庭成长解读 / AI诊断 | ASSESSMENT | GROWTH_INTELLIGENCE | GATE_BOUNDARY | CONFIRM_GROWTH_INTENT | — | CONFIRM_GROWTH_INTENT | BACKEND_WIRED | G2+ business gate (payment/human/child/public) |
| UI-04 | 90 天成长方案 | PLAN | GROWTH_JOURNEY | READ_ONLY_PROJECTION | ACCEPT_GROWTH_PLAN, PAUSE_GROWTH_PLAN | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-05 | 90 天陪跑 | PLAN | GROWTH_JOURNEY | LOCAL_DRAFT | RECORD_PROGRAM_CHECKIN, PAUSE_PROGRAM, RESUME_PROGRAM | — | — | DECLARED_ONLY_GATED | G1-C (promote local draft to canonical) |
| UI-06 | 我的会员 | COMMERCE | COMMERCE_ENTITLEMENT | READ_ONLY_PROJECTION | SUBMIT_RENEWAL_INTENT | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-07 | 成长测评入口 | ASSESSMENT | GROWTH_INTELLIGENCE | READ_ONLY_PROJECTION | START_ASSESSMENT | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-08 | 成长报告 | ASSESSMENT | GROWTH_INTELLIGENCE | READ_ONLY_PROJECTION | ACKNOWLEDGE_GROWTH_REPORT | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-09 | 今日成长任务 | GROWTH | GROWTH_JOURNEY | TEST_LOOP_FIXTURE | START_GROWTH_ACTION, COMPLETE_GROWTH_ACTION, RECORD_REFLECTION, SKIP_GROWTH_ACTION | COMPLETE_GROWTH_ACTION | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-10 | 孩子成长小助手 | GROWTH | GROWTH_JOURNEY | GATE_BOUNDARY | SAVE_CHILD_PERSPECTIVE_DRAFT, REQUEST_HUMAN_HELP | — | — | DECLARED_ONLY_GATED | G2+ business gate (payment/human/child/public) |
| UI-11 | 我们的成长节奏 | GROWTH | GROWTH_JOURNEY | READ_ONLY_PROJECTION | PAUSE_JOURNEY, RESUME_JOURNEY | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-12 | 成长故事卡 | COMMUNITY | CONTENT_COMMUNITY | LOCAL_DRAFT | SAVE_PRIVATE_GROWTH_STORY, CREATE_SHARE_DRAFT | — | — | DECLARED_ONLY_GATED | G1-C (promote local draft to canonical) |
| UI-13 | 家庭成长商城 | COMMERCE | RESOURCE_NETWORK | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-14 | 成长方案详情 | COMMERCE | RESOURCE_NETWORK | TEST_LOOP_FIXTURE | SUBMIT_ORDER_INTENT, CANCEL_ORDER_INTENT | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-15 | 邀请有礼 | COMMERCE | COMMERCE_ENTITLEMENT | TEST_LOOP_FIXTURE | CREATE_INVITATION_DRAFT, CANCEL_INVITATION_DRAFT | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-16 | 家庭同行计划 | COMMERCE | COMMERCE_ENTITLEMENT | TEST_LOOP_FIXTURE | SAVE_COHORT_INTENT, CANCEL_COHORT_INTENT | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-17 | 成长积分 | COMMERCE | COMMERCE_ENTITLEMENT | GATE_BOUNDARY | CLAIM_POINTS_TASK | — | — | DECLARED_ONLY_GATED | G2+ business gate (payment/human/child/public) |
| UI-18 | 会员中心 | COMMERCE | COMMERCE_ENTITLEMENT | READ_ONLY_PROJECTION | SUBMIT_RENEWAL_INTENT, CONSUME_MEMBERSHIP_BENEFIT | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-19 | 名师专区 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-20 | 名师详情 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-21 | 在线咨询预约 | SERVICE | SERVICE_OS | TEST_LOOP_FIXTURE | REQUEST_SERVICE_BOOKING, CANCEL_SERVICE_BOOKING | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-22 | 沙龙活动 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-23 | 活动详情 | SERVICE | SERVICE_OS | TEST_LOOP_FIXTURE | SAVE_ACTIVITY_INTENT, CANCEL_ACTIVITY_INTENT | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-24 | 我的咨询与活动 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-25 | 家长社区 | COMMUNITY | CONTENT_COMMUNITY | GATE_BOUNDARY | BOOKMARK_CONTENT | — | — | DECLARED_ONLY_GATED | G2+ business gate (payment/human/child/public) |
| UI-26 | 发布家庭小记 | COMMUNITY | CONTENT_COMMUNITY | TEST_LOOP_FIXTURE | SAVE_FAMILY_NOTE_DRAFT, SUBMIT_NOTE_FOR_REVIEW | — | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |
| UI-27 | 家庭小记详情 | COMMUNITY | CONTENT_COMMUNITY | NOT_IMPLEMENTED | SAVE_COMMUNITY_RESPONSE_DRAFT, TOGGLE_BOOKMARK, TOGGLE_FOLLOW | — | — | DECLARED_ONLY_GATED | G1-C (build projection + wiring) |
| UI-28 | 我的社区 | COMMUNITY | CONTENT_COMMUNITY | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-29 | 成长成果 | ASSESSMENT | GROWTH_INTELLIGENCE | READ_ONLY_PROJECTION | CONFIRM_MILESTONE | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-30 | 年度陪伴方案 | COMMERCE | COMMERCE_ENTITLEMENT | GATE_BOUNDARY | SUBMIT_MEMBERSHIP_INTENT, SUBMIT_RENEWAL_INTENT | — | — | DECLARED_ONLY_GATED | G2+ business gate (payment/human/child/public) |
| UI-31 | 我的服务 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | NONE | — | — | READONLY_BY_DESIGN | G1/G2 (write path per owning domain) |
| UI-32 | 订单与资产 | COMMERCE | COMMERCE_ENTITLEMENT | READ_ONLY_PROJECTION | CANCEL_ORDER_INTENT | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-33 | 家庭档案 | GROWTH | FAMILY_CORE | READ_ONLY_PROJECTION | UPDATE_FAMILY_PROFILE, GRANT_CONSENT, WITHDRAW_CONSENT, UPDATE_VISIBILITY | GRANT_CONSENT | GRANT_CONSENT | PARTIAL_BACKEND | G1/G2 (write path per owning domain) |
| UI-34 | 服务记录 | SERVICE | SERVICE_OS | READ_ONLY_PROJECTION | SUBMIT_SERVICE_FEEDBACK | — | — | DECLARED_ONLY_GATED | G1/G2 (write path per owning domain) |
| UI-35 | 21 天智慧父母成长营 | PLAN | GROWTH_JOURNEY | TEST_LOOP_FIXTURE | START_PROGRAM, COMPLETE_GROWTH_ACTION, RECORD_STAGE_REVIEW, PAUSE_PROGRAM, RESUME_PROGRAM | COMPLETE_GROWTH_ACTION | — | DECLARED_ONLY_GATED | G1-C/G2 (real effect beyond fixture) |

## 词汇分歧(naming divergence — 须架构师裁决统一)

| UI | declared 动作 | 疑似后端 guard |
|---|---|---|
| UI-02 | START_ASSESSMENT | StartIntervention |
| UI-02 | SUBMIT_ASSESSMENT | SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-04 | ACCEPT_GROWTH_PLAN | ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, RequestGrowthHelp |
| UI-04 | PAUSE_GROWTH_PLAN | ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, PauseJourneyPlan, RequestGrowthHelp |
| UI-05 | RECORD_PROGRAM_CHECKIN | RecordPerspective |
| UI-05 | PAUSE_PROGRAM | PauseJourneyPlan |
| UI-06 | SUBMIT_RENEWAL_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-07 | START_ASSESSMENT | StartIntervention |
| UI-08 | ACKNOWLEDGE_GROWTH_REPORT | ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, RequestGrowthHelp |
| UI-09 | START_GROWTH_ACTION | CompleteAction, ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, ExecuteFamilyPageObjectAction, ExecuteTestExperienceAction, RequestGrowthHelp, StartIntervention |
| UI-09 | COMPLETE_GROWTH_ACTION | CompleteAction, ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, ExecuteFamilyPageObjectAction, ExecuteTestExperienceAction, RequestGrowthHelp |
| UI-09 | RECORD_REFLECTION | RecordPerspective |
| UI-09 | SKIP_GROWTH_ACTION | CompleteAction, ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, ExecuteFamilyPageObjectAction, ExecuteTestExperienceAction, RequestGrowthHelp |
| UI-10 | SAVE_CHILD_PERSPECTIVE_DRAFT | AddChild, RecordPerspective |
| UI-10 | REQUEST_HUMAN_HELP | RequestGrowthHelp |
| UI-11 | PAUSE_JOURNEY | ConfirmJourneyPlan, CreateJourneyPlan, PauseJourneyPlan, ReviewJourneyPhase |
| UI-11 | RESUME_JOURNEY | ConfirmJourneyPlan, CreateJourneyPlan, PauseJourneyPlan, ReviewJourneyPhase |
| UI-12 | SAVE_PRIVATE_GROWTH_STORY | ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, RequestGrowthHelp |
| UI-12 | CREATE_SHARE_DRAFT | CreateJourneyPlan |
| UI-14 | SUBMIT_ORDER_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-14 | CANCEL_ORDER_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-15 | CREATE_INVITATION_DRAFT | CreateJourneyPlan |
| UI-16 | SAVE_COHORT_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-16 | CANCEL_COHORT_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-18 | SUBMIT_RENEWAL_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-18 | CONSUME_MEMBERSHIP_BENEFIT | ManageMembershipEntitlement |
| UI-21 | REQUEST_SERVICE_BOOKING | DecideGrowthService, RequestGrowthHelp, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-21 | CANCEL_SERVICE_BOOKING | DecideGrowthService, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-23 | SAVE_ACTIVITY_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-23 | CANCEL_ACTIVITY_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-26 | SAVE_FAMILY_NOTE_DRAFT | ExecuteFamilyPageObjectAction, ReadFamily |
| UI-26 | SUBMIT_NOTE_FOR_REVIEW | ReviewJourneyPhase, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-27 | TOGGLE_FOLLOW | SubmitServiceFollowUp |
| UI-29 | CONFIRM_MILESTONE | ConfirmGrowthIntent, ConfirmGrowthPriority, ConfirmJourneyPlan |
| UI-30 | SUBMIT_MEMBERSHIP_INTENT | ConfirmGrowthIntent, ManageMembershipEntitlement, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-30 | SUBMIT_RENEWAL_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-32 | CANCEL_ORDER_INTENT | ConfirmGrowthIntent, SubmitCommerceIntent |
| UI-33 | UPDATE_FAMILY_PROFILE | ExecuteFamilyPageObjectAction, ReadFamily |
| UI-33 | WITHDRAW_CONSENT | GrantConsent |
| UI-34 | SUBMIT_SERVICE_FEEDBACK | DecideGrowthService, SubmitCommerceIntent, SubmitServiceBooking, SubmitServiceFollowUp |
| UI-35 | START_PROGRAM | StartIntervention |
| UI-35 | COMPLETE_GROWTH_ACTION | CompleteAction, ConfirmGrowthIntent, ConfirmGrowthPriority, DecideGrowthService, ExecuteFamilyPageObjectAction, ExecuteTestExperienceAction, RequestGrowthHelp |
| UI-35 | RECORD_STAGE_REVIEW | RecordPerspective, ReviewJourneyPhase |
| UI-35 | PAUSE_PROGRAM | PauseJourneyPlan |

