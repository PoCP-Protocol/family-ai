# TENANCY-T3 — Party / Organization / Teacher Foundation V1

```text
DOC_KIND       = ARCHITECTURE_CONTRACT
STATUS         = PROPOSED_FOR_APPROVAL
RUNTIME        = 0
DB_SCHEMA      = 0
PRODUCT_SCOPE  = 0
BASELINE       = TENANCY-001 + T1/T2 Trusted Family Context
```

## 1. 目标

在现有 `Account → TenantMembership → TenantFamilyBinding → FamilyMembership → Person` 可信链之上，冻结家庭、个人专业服务者、机构和平台运营之间的对象边界。

本文件是 Patch 2 的设计合同，不新增 migration、API、UI 或业务 runtime。任何落地必须另行取得 `DB_SCHEMA_CHANGE` 与 `BUSINESS_RUNTIME` 授权。

## 2. 不变量

1. `Family` 是家庭成长数据的所有权根。
2. `Tenant` 是隔离、策略和运营工作区，不等于法人机构。
3. `Organization` 拥有自身组织数据，但不拥有家庭数据。
4. `Account` 是登录主体，不等于 `Person`、`Teacher` 或 `Organization`。
5. `Person` 的家庭角色与组织角色正交，不能自动映射。
6. `Teacher` 是自然人的专业身份，不直接复用家庭 `Person` 作为职业模型。
7. `ProviderProfile` 是可销售/可履约的供给主体，可以属于个人或机构。
8. 销售主体与实际履约教师必须分离。
9. `ServiceRelationship` 不等于数据访问权。
10. 跨主体访问必须同时满足有效关系、Purpose、Consent、AccessGrant、对象范围和有效期。
11. AI 只能生成 `Proposal/Draft`，不得直接完成准入、认证、发布、分配、收费或结算。
12. 现有 `TenantFamilyBinding` 继续表示 Family 的主数据归属，不表示家庭客户关系。

## 3. 对象模型

### 3.1 身份与参与方

```text
Account
  └─ AccountPartyBinding → Party

Party
  ├─ IndividualParty
  └─ Organization
```

- `Party`：合同、交易和服务中的统一参与方。
- `IndividualParty`：自然人的业务身份；不是登录账号。
- `Organization`：学校、教育机构、咨询机构、公益组织或企业。
- `AccountPartyBinding`：Account 与业务 Party 的绑定，不能赋予家庭数据访问权。

### 3.2 组织结构

```text
Organization
  ├─ OrganizationUnit
  ├─ OrganizationMembership
  ├─ OrganizationTenantBinding
  └─ OrganizationAgreement
```

`OrganizationMembership` 状态必须支持：

```text
INVITED → ACTIVE → SUSPENDED → ENDED
```

组织角色只在组织上下文内生效：`ORG_OWNER`、`ORG_ADMIN`、`ORG_OPERATOR`、`ORG_TEACHER`、`ORG_VIEWER`。这些角色不得投影为家庭角色。

### 3.3 教师与供给

```text
IndividualParty
  └─ TeacherProfile
       ├─ TeacherQualification
       ├─ TeacherCapability
       ├─ TeacherAffiliation ↔ Organization
       ├─ TeacherAvailability
       └─ ProviderProfile(kind=INDIVIDUAL)

Organization
  └─ ProviderProfile(kind=ORGANIZATION)
       └─ ServiceOffering
```

- `TeacherProfile`：自然人专业身份、服务简介和专业状态。
- `TeacherQualification`：资格、认证、签发方、有效期和审核状态。
- `TeacherCapability`：服务领域、年龄段、方法、语言和准入范围。
- `TeacherAffiliation`：教师与机构的多对多、带有效期和授权范围的合作关系。
- `ProviderProfile`：服务销售/履约主体；独立教师和机构供给共用该模型。
- `ProviderAdmission`：平台或机构的准入结果。
- `ProviderSettlementProfile`：结算与税务信息，必须与普通资料隔离。

教师不得通过普通 Account 自助勾选后立即发布和收费。独立教师发布正式 Offer 至少要求身份、资格、准入、合同、未成年人服务政策和结算资料有效。

## 4. 服务关系与数据授权

```text
Family ── ServiceRelationship ── Organization / Teacher / Provider
Family ── CaseAccessGrant ─────── Organization / Teacher / CaseParticipant
```

### `ServiceRelationship`

表示家庭与机构、教师或 Provider 之间存在服务关系，字段语义至少包括：

- `family_id`
- `counterparty_party_id`
- `provider_profile_id`
- `purpose`
- `status`
- `effective_from`
- `effective_to`
- `terminated_at`

服务关系存在不代表可以读取家庭成长档案。

### `CaseAccessGrant`

表示某个具体服务案例中的最小数据授权，字段语义至少包括：

- `family_id`
- `service_case_id`
- `grantee_party_id`
- `scope`
- `purpose`
- `consent_snapshot_ref`
- `effective_from`
- `expires_at`
- `revoked_at`
- `risk_level`
- `human_gate_ref`

默认拒绝。授权撤回后，继续读取必须失败；历史交付记录按保留政策保存，但不得继续扩大读取范围。

## 5. 供应链兼容策略

现有链路：

```text
ServiceProvider → ServiceOffering → AvailabilitySlot → BookingRequest → BookingServiceRecord
```

兼容转换：

```text
ProviderProfile → ServiceOffering → AvailabilitySlot → BookingRequest
                                         ↓
                                  ServiceCase / TeacherAssignment
```

要求：

1. 保留现有 UI-19 查询接口作为兼容投影。
2. `ServiceProvider` 不再扩展为职业身份万能表。
3. 新模型中分离 `owner_tenant_id`、销售主体、履约教师和渠道租户。
4. `TeacherAssignment` 只能发生在有效 ServiceCase 内。
5. 现有 `fixture_only=true`、`external_effect=false` 的测试边界保持不变。

## 6. 四类工作台上下文

| 工作台 | 可信上下文 | 默认可见范围 |
|---|---|---|
| 家庭端 | `FAMILY` | 本家庭数据、服务关系、授权和交付回顾 |
| 教师端 | `TEACHER` | 本人资料、资质、可用时间、被分配案例的授权数据 |
| 机构端 | `ORGANIZATION` | 组织、成员、供给、合同和被授权案例 |
| 运营端 | `PLATFORM_OPS` | 准入、风控、争议、结算和审计；不默认读取完整家庭档案 |

同一 Account 可拥有多个上下文，但请求必须明确选择上下文；服务端不得依据“这个人同时是家长/教师”自动扩大权限。

## 7. Named Actions

首批只冻结名称，不实现：

- `CreateOrganization`
- `InviteOrganizationMember`
- `AcceptOrganizationMembership`
- `SuspendOrganizationMembership`
- `CreateTeacherProfile`
- `SubmitTeacherQualification`
- `AdmitProvider`
- `EstablishServiceRelationship`
- `GrantCaseAccess`
- `RevokeCaseAccess`
- `AssignTeacherToServiceCase`
- `RecordDelivery`
- `SubmitProviderOfferProposal`
- `ApproveProviderOffer`

所有状态改变必须经过显式 Action、幂等键、审计事件和 correlation id。

## 8. 分阶段边界

### Patch 2 — Foundation

只落地 Party、Organization、Teacher、Provider 的 canonical schema 和可信上下文，不引入正式支付、结算或跨租户家庭数据读取。

### Patch 3 — Supply Catalog

将现有 Provider/Offering 接到 `ProviderProfile`，增加销售主体、渠道和履约教师分离的兼容投影。

### Patch 4 — Service Relationship / Case Access

先实现“机构购买权益包 → 家庭接受 → 最小授权 → 教师交付”的单一黄金纵切。

### Patch 5 — Individual Provider / Settlement

完成独立教师准入、合同、退款、争议和结算后，才允许独立教师正式发布收费 Offer。

## 9. 明确禁止

- 不把 `Organization` 写入 `Family` 作为家庭 owner。
- 不用 `tenant_family_bindings` 表达全部机构客户关系。
- 不在 `family_service_providers.attributes` 继续堆职业身份字段。
- 不将组织管理员投影成家庭监护人。
- 不因赞助或付款自动开放家庭档案。
- 不用单一 `organization_id` 表示教师唯一隶属关系。
- 不允许 AI 直接写认证、准入、发布、分配或结算状态。
- 不在本合同中新增数据库表、migration、API 或前端功能。
