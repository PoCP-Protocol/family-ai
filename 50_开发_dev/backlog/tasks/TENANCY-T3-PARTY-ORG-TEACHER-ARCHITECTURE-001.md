# TENANCY-T3-PARTY-ORG-TEACHER-ARCHITECTURE-001

status: PROPOSED_FOR_APPROVAL
type: ARCHITECTURE_AND_CONTRACT_GATE
gate: TENANCY_T3_FOUNDATION

## Goal

冻结 Party、Organization、Teacher、Provider、ServiceRelationship 和 CaseAccessGrant 的对象边界，为后续多租户业务实现提供唯一设计基线。

## Scope

- 审查现有 Tenant Trusted Context、Provider、Offering、AvailabilitySlot、Booking 链路。
- 产出 Party / Organization / Teacher / Provider canonical object map。
- 定义 Family、Tenant、Organization、Teacher 的所有权和上下文边界。
- 定义独立教师、机构教师、销售主体和履约教师的关系。
- 定义 ServiceRelationship 与 CaseAccessGrant 的最小授权模型。
- 设计现有 UI-19 供给接口的兼容投影策略。
- 分解后续 Patch 2～5 的迁移任务和质量门禁。

## Non-goals

- 不新增数据库 migration。
- 不新增业务 runtime、API、UI 或正式工作台。
- 不实现支付、Order、Settlement、Refund、Dispute。
- 不实现跨租户家庭数据读取。
- 不实现组织准入、教师认证或正式 Offer 发布。
- 不修改 `10_规格_spec` 概念规格。
- 不改变现有 Family 数据 owner 和 TenantFamilyBinding 语义。

## Required reads

- `architecture/tenancy/TENANCY_001_OWNERSHIP_TENANCY_CONTRACT_V1.md`
- `architecture/tenancy/TENANCY_T3_PARTY_ORG_TEACHER_FOUNDATION_V1.md`
- `reports/tenancy/FAMILY_TENANCY_T1T2_REPORT.md`
- `database/migrations/0025_tenant_master_data_foundation.sql`
- `database/migrations/0039_vs00_tenant_trusted_context.sql`
- `apps/api/src/modules/auth/auth.repository.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/family-scope.guard.ts`
- `apps/api/src/modules/orchestration/family-service-booking.service.ts`
- `apps/web/src/teacher-supply-view.js`

## Deliverables

- T3 Foundation architecture contract.
- Existing-to-target object mapping.
- Patch 2～5 task decomposition.
- Permission and data-sharing matrix.
- Migration rollback and compatibility notes.
- Architecture review report with unresolved questions.

## Acceptance criteria

- 明确 `Tenant != Organization`。
- 明确 `Family` 是家庭数据 owner。
- 明确 Account、Person、Teacher、Party 的区别。
- 明确 Provider 销售主体与实际履约教师分离。
- 明确 ServiceRelationship 不等于 AccessGrant。
- 明确不同上下文的默认可见范围。
- 明确现有 fixture-only 供给链不得被误称为生产履约。
- 明确后续 schema/runtime 必须另行授权。

## Validation

- `git diff --check`
- 授权扫描：确认无 migration、API、UI 和业务 runtime 变更。
- 引用现有 T1/T2 安全测试作为后续实现的回归基线。
