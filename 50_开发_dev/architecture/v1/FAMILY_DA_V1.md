# Family Data Architecture V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

## 对象分层

| 层 | 对象 | 写入原则 |
| --- | --- | --- |
| Canonical Truth | Family、Person、Consent、GrowthPriority、GrowthJourney、ProgramEnrollment、Entitlement、ServiceCase、ServiceRecord | Named Action only |
| Projection | FamilyHomeProjection、AssessmentProjection、CommerceProjection、ServiceProjection、PlatformSurfaceProjection | Read only |
| Draft | AssessmentResponseDraft、AIReportDraft、PlanDraft、CommunityPostDraft、BookingRequestDraft | 可保存草稿，不等于事实 |
| Evidence | EvidenceRef、Citation、SourceBoundary、ModelRunRef | 必须标注等级与来源 |
| AI Artifact | Hypothesis、Recommendation、Explanation、Summary、ActionProposal | 不可直接写核心状态 |

## 语义边界

| 语义 | 可否作为 Fact | 进入核心状态条件 |
| --- | --- | --- |
| Perspective | 否 | 来源、角色、时间和可见性齐备 |
| Hypothesis | 否 | 家庭确认或人工确认后转为下一步 Intent，不转 Fact |
| Recommendation | 否 | 家庭 Decision 后才可触发 Action |
| Decision | 否 | 必须有 actor、scope、consent、idempotency |
| Action | 否 | Action 只证明发生过，不证明 Outcome |
| Outcome | 有条件 | 需要独立证据、时间窗和评估规则 |

## 21-Day 数据落点

21-Day Program 使用 `ProductOffering -> CommerceIntent -> Entitlement -> ProgramEnrollment -> GrowthAction -> ServiceRecord`。不得新增 `UI-35` 作为 canonical data owner。