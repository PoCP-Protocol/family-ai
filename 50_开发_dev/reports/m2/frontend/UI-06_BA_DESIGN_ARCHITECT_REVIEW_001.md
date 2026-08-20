# UI-06 BA Design Architect Review 001

> **Review type：** UI-06 陪跑服务 / 社群服务 BA Design 架构师评审模板
>
> **Review status：** `TEMPLATE_READY / CODE_NO_GO_UNTIL_REVIEW_COMPLETE`
>
> **Related BA Design：** `UI-06_BA_DESIGN_90_DAY_GROWTH_001.md`
>
> **Visual baseline：** `apps/web/public/bangyang-reference/delivery-community-reference-458x1128.png`

## Review Scope

评审 UI-06 是否可以从 BA Design 进入 API Contract。评审范围包括：家庭陪跑服务、服务卡、完成度投影、家长打卡、私有交流、直播入口、AI 提醒、儿童数据、服务记录、外部 effect、视觉复刻和前后端一致性。

本模板不批准业务代码。未完成本表和 Blocking Questions Decision Pack 前，保持 `CODE_IMPLEMENTATION=NO_GO`。

## Reviewed Inputs

| 输入 | 核对状态 | 评审说明 |
|---|---|---|
| UI-06 BA Design | `[READY / GAP / NOT_READ]` | 需核对对象、状态、字段和证据边界。 |
| UI-06 visual baseline | `[CONFIRMED / NEEDS_CONFIRMATION]` | 需核对 2×2 服务卡、完成度、tab、动态、打卡 CTA 和底部导航。 |
| 34 UI master mapping | `[READ / GAP]` | UI-06 应为 `ServiceJourneyProjection` / `SERVICE_RECORD_ONLY`。 |
| FE/BE consistency matrix | `[READ / GAP]` | 当前 UI-06 是 `UI_READY_BACKEND_GAP`，需专属只读 DTO。 |
| Object/API/Named Action mapping | `[READ / GAP]` | 不得把服务说明、打卡草稿和真实履约混为一谈。 |
| Consent/Human Gate/Policy/Audit | `[READ / GAP]` | 需验证 guardian scope、儿童资料、真人服务、通知和外发边界。 |

## Architecture Verdict

填写以下结果之一：

```text
CONDITIONAL_BA_READY
NO_GO_NEEDS_BA_FIX
NO_GO_NEEDS_HUMAN_DECISION
NO_GO_FOR_API_CONTRACT
NO_GO_FOR_CODE_IMPLEMENTATION
```

建议默认值：

```text
BA_DESIGN=[CONDITIONAL_BA_READY]
API_CONTRACT=[NO_GO_UNTIL_REVIEW]
CODE_IMPLEMENTATION=[NO_GO]
EXTERNAL_EFFECT=[HOLD]
```

## BA Design Completeness Review

- [ ] 是否明确 UI-06 服务旅程承接 UI-05 的哪个 projection，而不是重新创建计划系统？
- [ ] 是否区分家庭顾问、班主任、AI 提醒、专家答疑的服务说明、候选、真实服务和服务记录？
- [ ] 是否定义家庭成长需求、角色、场景和过程支持，而不是使用“陪伴有效”等空泛承诺？
- [ ] 是否说明 90 天/本周/7/9/78% 只是过程投影，不是评分、诊断、排名或效果事实？
- [ ] 是否区分私有家庭打卡、租户内社区和公开社区外发？
- [ ] 是否登记低清文案、未确认服务资质和不可辨认图标，而没有猜测补写？

## Evidence and Provenance Compliance

核对并记录：

| 结论 | 来源类型 | 证据等级 | 状态 |
|---|---|---|---|
| 页面可见文本/结构 | screenshot/PPT | visual evidence | `[PASS/GAP]` |
| 服务对象候选 | governance/object mapping | design SSOT | `[PASS/GAP]` |
| 家庭教育实践 | approved research/material | E0–E1 | `[PASS/GAP]` |
| 服务效果、资质、真人在线 | external/operational evidence | not established | `[HOLD]` |

必须确认：`Perspective != Fact`、`Hypothesis != Fact`，内部材料不能自证服务效果、资质或真实履约。

## Domain Boundary Review

- [ ] `ServiceJourneyProjection` 是共享读模型，不是 UI-06 私有真相表。
- [ ] `ServiceOffering`、`Provider`、`Activity` 只展示 admitted/verified 摘要，不宣称真人承诺。
- [ ] `ServiceCase`/`ServiceRecord` 只表示受控过程记录，不表示 Outcome。
- [ ] `AssistantSession`/`Reminder` 只允许 Model Gateway 解释/草稿，不直接发送提醒。
- [ ] `CommunityPost`、`LiveSession` 为私有/synthetic projection；公开发布、直播、预约另行 Gate。
- [ ] UI-06 不重复建设 UI-05 Growth Plan、UI-09 Task、UI-25 Community 的共享子系统。

## Data and Object Boundary Review

填写 UI-06 的读写边界：

| 对象 | Read/Write | 来源 | 状态上限 | 评审结论 |
|---|---|---|---|---|
| Family/Person/Membership | read | trusted family scope | private | `[PASS/GAP]` |
| Consent | read/policy | consent registry | granted/revoked | `[PASS/GAP]` |
| ServiceJourneyProjection | read | projection service | L1 | `[PASS/GAP]` |
| TaskProgressProjection | read | UI-09/shared task projection | L1 | `[PASS/GAP]` |
| CheckinDraft | controlled write | Named Action | L2 | `[PASS/GAP]` |
| FamilyDecision | controlled write | approved action | L3 only if approved | `[PASS/GAP]` |
| ServiceCase/ServiceRecord | no automatic write | steward/service action | HOLD | `[PASS/GAP]` |
| CommunityPublication/Notification/Live/Booking | no automatic write | adapter + Human Gate | L4 HOLD | `[PASS/GAP]` |

## State Machine Review

| State | Allowed | Forbidden | Evidence/decision |
|---|---|---|---|
| `STATIC_BASELINE` | original visual structure | claims of real service | `[ ]` |
| `LOADING` | loading skeleton within original frame | guessed values | `[ ]` |
| `READ_ONLY_READY` | service/progress/private feed projection | durable writes | `[ ]` |
| `CONSENT_REQUIRED` | visible safe stop | bypass consent | `[ ]` |
| `REVIEW_REQUIRED` | visible safe stop | unverified provider/child data | `[ ]` |
| `CHECKIN_DRAFT` | private draft | public post/Outcome | `[ ]` |
| `FAMILY_DECISION_PENDING` | pending candidate | decision/action promotion | `[ ]` |
| `EXTERNAL_EFFECT_HOLD` | hold explanation | notification/booking/live/contact | `[ ]` |

## Named Action / Decision / Recommendation Boundary

Answer each question:

1. Is the service card an admitted explanation/recommendation, not a decision?
2. Does `＋打卡` create at most a private draft through an approved Named Action?
3. Can the CTA ever create a Task, ServiceCase, CommunityPost, Reminder or Outcome? Expected: **No** for the first slice.
4. Does any FamilyDecision require guardian actor, purpose-limited Consent, source/version, idempotency, correlation and audit?
5. Does AI only explain, summarize or draft through Model Gateway? Expected: **Yes**.
6. Is `NO_ACTION` a safe stop with no Plan/Case/Task/Reminder/external effect? Expected: **Yes**.

## Consent / Human Gate / Minor Protection Review

- [ ] `PLAN_READ`, service-read, child-data and service-followup purposes are distinct or explicitly approved for reuse.
- [ ] OWNER_GUARDIAN/GUARDIAN actor policy is enforced server-side.
- [ ] ADULT_MEMBER/CHILD_SUBJECT negative cases are tested where applicable.
- [ ] `subject_person_id`, family and tenant scope are server-derived.
- [ ] Consent withdrawal immediately produces fail-closed projection/action behavior.
- [ ] Child emotional records and family text use minimum visibility.
- [ ] Human Gate exists for sensitive interventions, real-person service, notification, live/video, external sharing and uncertain evidence.

## Frontend Backend Consistency Implications

Before API Contract approval, confirm:

| Layer | Required evidence |
|---|---|
| Visual baseline | source image, viewport, DOM region map, ambiguous-text register |
| Web route | `core-community` mapping and all states retain original layout |
| Read DTO | fields map to service journey/progress/private community projections |
| Write DTO | only approved draft/decision boundary; no client scope fields |
| Policy | Consent, guardian, subject, Human Gate and fail-closed errors |
| Audit | Named Action, correlation_id, idempotency_key, policy_version, consent_ref |
| Tests | API contract, Web route/page-object, fixture, negative scope/consent tests |
| Screenshot | desktop/mobile baseline comparison and state coverage |

## Visual Fidelity Implications

The review must compare the implementation plan against `delivery-community-reference-458x1128.png` and confirm:

- Header title “陪跑服务”, top controls and visual hierarchy remain unchanged.
- 2×2 cards retain order: 家庭顾问、班主任陪跑、AI提醒、专家答疑.
- Completion card retains 78%, 7/9, progress bar, three task rows and their visual states as projection examples.
- Tabs retain 成长打卡、家长交流、本周直播 and selected-state styling.
- Feed cards, “已打卡” label, reaction counters, floating “＋ 打卡” and bottom navigation remain structurally faithful.
- Unreadable text/icon regions are not guessed or silently replaced.
- Loading/empty/permission/Consent/Human Gate states fit the same original screen frame.

## Blocking Questions

| ID | Question | Expected decision owner | Status |
|---|---|---|---|
| UI06-BQ-01 | 2×2 service cards are catalog explanations, service candidates, or already admitted offerings? | Architect/BA | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-02 | Does `＋打卡` create only a private draft, or a recorded service event? | Architect | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-03 | Is 78%/7/9 a process projection with exact source and as-of, never a score/effect claim? | Architect/Policy | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-04 | Which Consent purposes permit service read, child records, private community and check-in draft? | Policy/Privacy | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-05 | Are live, expert answer, family adviser and class teacher links permanently HOLD for the first slice? | Product/Architect | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-06 | Are feed items synthetic/private fixtures, and is public community publication excluded? | Product/Privacy | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-07 | Which low-resolution copy is immutable and which may be projection data? | Architect/Design | `NEEDS_HUMAN_DECISION` |
| UI06-BQ-08 | Does AI reminder return explanation/draft only through Model Gateway? | AI Governance | `NEEDS_HUMAN_DECISION` |

## Required Fixes Before API Contract

1. Resolve UI06-BQ-01 through UI06-BQ-08 in a Decision Pack.
2. Define a `ServiceJourneyProjectionDto` with provenance, visibility, version, as-of, policy and expiry.
3. Define the private check-in draft boundary and no-effect guarantee.
4. Define Consent/Human Gate and guardian/subject negative cases.
5. Produce visual copy allowlist and screenshot state manifest.
6. Confirm shared-subsystem reuse with UI-05, UI-09, UI-25 and UI-31.

## Go / No-Go Verdict

```text
BA_DESIGN=[CONDITIONAL_BA_READY]
API_CONTRACT=[NO_GO_UNTIL_BQ_CLOSURE]
CODE_IMPLEMENTATION=NO_GO
EXTERNAL_EFFECT=HOLD
```

## Acceptance Checklist

- [ ] All UI06-BQ questions have explicit decisions and statuses.
- [ ] No unresolved visual mapping or low-resolution text is guessed.
- [ ] `Recommendation != Decision != Action` is demonstrated in the UI states and contract.
- [ ] No AI free text writes core ontology.
- [ ] No Family Total Score, ranking, diagnosis, effect claim, public publication, real service, booking, notification or payment is introduced.
- [ ] API/DTO/read model/policy/audit/idempotency/correlation plan is internally consistent.
- [ ] Visual baseline comparison covers static, loading, empty, permission, consent, draft, pending and safe-stop states.
- [ ] Only after this checklist passes may UI-06 proceed to API Contract review.

## Reviewer Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Architect | [ ] | `[GO / NO-GO]` | [ ] |
| BA/Product | [ ] | `[GO / NO-GO]` | [ ] |
| Policy/Privacy | [ ] | `[GO / NO-GO]` | [ ] |
| AI Governance | [ ] | `[GO / NO-GO]` | [ ] |
