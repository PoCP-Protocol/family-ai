# ARCH-00 · Runtime Inventory V1

```text
DOC_KIND = ARCHITECTURE_AUDIT_EVIDENCE
TASK = ARCH-00 Architecture Inventory & Drift Lock
STATUS = AUDIT_ONLY (无业务改动 / 无代码迁移 / 无 spec 改动)
SNAPSHOT = worktree D:\family-ai-plan @ babd49f (branch plan/family-34ui-intelligence-backbone-001)
SOURCE_OF_TRUTH_ORDER = CLAUDE.md → 10_规格_spec → CURRENT_SPRINT → Approved Task → architecture/* → BLUEPRINT_V1 → code
METHOD = 以运行时/代码/DB/registry 实况为准(遵 governance/TRUTH_HIERARCHY.md),不以叙述文档判定完成度
```

> 本报告是 `FAMILY_SYSTEM_ARCHITECTURE_EXECUTION_BLUEPRINT_V1.md` §19 ARCH-00 的三产物之一。每一项按 blueprint §21 的标签标注:
> `CURRENT_IMPLEMENTED / PARTIAL / TARGET_ONLY / TEST_LOOP_FIXTURE / LOCAL_DRAFT / STALE_DOC / BLOCKED / NOT_IMPLEMENTED`。

---

## 1. 应用拓扑 apps/

| app | 状态 | 说明 |
|---|---|---|
| `apps/api` | CURRENT_IMPLEMENTED | NestJS 11 modular monolith,业务真相 |
| `apps/mobile` | CURRENT_IMPLEMENTED | Expo 54(内部包名 `app-template`),35UI 壳,统一 reducer + AsyncStorage |
| `apps/web` | PARTIAL | 静态 HTML/JS 投影壳(strangler),非标准 React SPA |
| `apps/fes-api` | CURRENT_IMPLEMENTED | FELS/榜样迁移侧 API(legacy 迁移域) |
| `apps/fes-web` | PARTIAL | FELS 侧 web |

> blueprint §14 目标态的 `consumer-web/ ops-web/ worker/` **NOT_IMPLEMENTED**(仅 target)。不得为对齐文档立即 rename/move。

## 2. packages/

| package | 状态 | 说明 |
|---|---|---|
| `contracts` | CURRENT_IMPLEMENTED | 共享契约(`@family/contracts`);api vitest 需先 build dist |
| `ai-gateway` | CURRENT_IMPLEMENTED | provider/routing/attempt + 测试;真实外呼仅内部 dogfood |
| `principal-ai` | CURRENT_IMPLEMENTED | Principal soul/knowledge |
| `principal-runtime` | CURRENT_IMPLEMENTED | provider policy / registry / skill runtime |
| `program-runtime` | PARTIAL | program/challenge runtime(接线程度待 ARCH-04 核) |
| `harness` | PARTIAL(NEW) | `FAMILY_INTELLIGENCE_OS_HARNESS_BOUNDARY_V0_1` 的边界包(index.ts 195 行);G1-A boundary-only,未进业务路径 |
| `family-model` | PARTIAL | 家庭模型侧资产 |
| `fes-contracts` | CURRENT_IMPLEMENTED | FELS 契约 |
| `waf-contracts` | PARTIAL | WAF 契约(见 §5 WAF 未接线) |

> blueprint §10.1:`ai-gateway` / `principal-runtime` = **既有 runtime 资产,禁止另造第二套**。

## 3. API AppModule 接线实况

```text
AppModule.imports = [AuditModule, FamilyModule, PrincipalModule, AuthModule, OrchestrationModule]
```

| module 目录 | 是否被 AppModule 接线 | 状态 |
|---|---|---|
| `modules/auth` | ✅ 是 | CURRENT_IMPLEMENTED |
| `modules/family` | ✅ 是 | CURRENT_IMPLEMENTED(过载,见 §4) |
| `modules/principal` | ✅ 是 | CURRENT_IMPLEMENTED |
| `modules/orchestration` | ✅ 是 | CURRENT_IMPLEMENTED(责任过宽,见 §6) |
| `modules/waf` | ❌ **否** | **CODE_EXISTS_NOT_WIRED** —— 有 service/spec/seed 但 AppModule 未 import(印证 blueprint §2.2) |

控制器数量:**4 个 `*.controller.ts`**(auth/family/principal/orchestration 域)。

## 4. FamilyModule providers(20 项 —— 过载证据)

`modules/family/family.module.ts` 同时挂载以下 provider,横跨三类所有权:

```text
Family Core     : FamilyService, FamilyRepository, FamilyAggregateRepository
Growth OS       : GrowthActionService, GrowthPriorityService, GrowthReviewService,
                  GrowthHypothesisService, InterventionService, JourneyPlanService,
                  GrowthCampService, GrowthSubjectResolver, EvidenceSynthesisService,
                  AssessmentService, OnboardingService, TodayService
Projection/Home : FamilyHomeService, TenantScopedUiProjectionService
DEV surfaces    : DevCoreGrowthService, DevPlatformSurfacesService, DevFlowReceiptService
```

标签:**PARTIAL / OWNERSHIP_DRIFT** —— `FamilyModule = Family Core + 大部分 Growth OS + DEV projections`。详见 `ARCH_MODULE_OWNERSHIP_MATRIX_V1.md`。

## 5. WAF

```text
WAF_CODE = EXISTS (modules/waf/*, packages/waf-contracts)
WAF_RUNTIME = NOT_WIRED (AppModule 未 import WafModule)
WAF_OWNERSHIP = UNDEFINED (是否 = We are Famili / Program / seeded domain 未裁决)
```

标签:**BLOCKED** —— 接线前须先 ADR(blueprint §P0-04 / ARCH-06)。

## 6. Orchestration 责任面

`modules/orchestration/` 现含:eligibility、decision-integrity、commerce-intent、commerce-objects、membership-entitlement、service-supply/booking、test-loop projection、跨域编排。

标签:**PARTIAL / SCOPE_TOO_WIDE** —— 长期应收束为「跨域应用编排 + Intent/Decision Bridge + 外部效果边界」,非 canonical domain owner(blueprint §2.4)。其中 commerce/service 多为 **TEST_LOOP_FIXTURE**。

## 7. 数据库迁移

```text
迁移文件数 = 47   末号 = 0044_ui02_family_assessment_ai_capability_memory.sql
```

已落:Outbox(0030)、LLM 网关审计(0021)、model attempts 账本(0014)、90 天 journey(0035/0036)、21 天 camp(0043)、UI02/03/09 生命周期(0040-0042)。
**NOT_IMPLEMENTED**:PG18 升级、pgvector、Redis、Temporal(无 SQL/依赖痕迹)。

## 8. 35UI 运行时矩阵(governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json)

```text
screens = 35   ⚠️(仍含 UI-35;而 FAMILY_UI_IDS 与 validator 已改为 34 —— 见 DRIFT DR-01)
runtime_status 分布:
  READ_ONLY_PROJECTION = 18
  TEST_LOOP_FIXTURE     = 8
  GATE_BOUNDARY         = 6
  LOCAL_DRAFT           = 2
  NOT_IMPLEMENTED       = 1
  REAL_PERSISTED        = 0   ← 面向家庭产品层无真实持久化写闭环
```

> 注意区分:M1 family-core 后端确有真实 PG + E2E(TASK-101~106);但 35 个消费者 UI 层 `REAL_PERSISTED=0`。

## 9. UI-01 首页数据流(已验证)

```text
mobile app/(tabs)/index.tsx:111  → familyApi.getFamilyHome()  [单一读]
family-api-client.ts:373         → GET /families/:id/ui/01/home
family.controller.ts:65          → FamilyHomeService.getHome()  [服务端投影]
```

标签:**CURRENT_IMPLEMENTED** —— UI-01 已是 thin client + 单一服务端 `FamilyHomeProjection`(即 blueprint FIT-013 / ARCH-03 样板已达成)。`ai_assistance.state='NOT_INVOKED'`,无 synthetic fact,`today_tasks` 仅真实 GrowthAction。

## 10. Mobile 本地状态(AsyncStorage)

`lib/family/family-state*.ts` 的 reducer 持有:`campCompletedDays`、`lastReceipt`、`uiActionReceipts`、`todayAction`、`campStarted` 等。
标签:**LOCAL_DRAFT / 边界偏弱** —— 部分显示态(如 UI-05 `WEEKLY_TASKS`、"超过78%"、UI-31 本地进度%)仍源自本地计算,未全部服务端化(blueprint §11 / §P0-06)。AsyncStorage 非 canonical。

## 11. AI / Principal Runtime

`packages/ai-gateway` + `packages/principal-ai` + `packages/principal-runtime` + `modules/principal` 均 **CURRENT_IMPLEMENTED**;真实外呼仅内部 dogfood(profile=model_first_internal),pilot/prod=NO。PrincipalModelRun 账本(迁移 0014/0021)已在。

## 12. 事件 / 审计

Outbox(`outbox_events`)、audit_logs、growth 事件、product event envelope(0030)均 CURRENT_IMPLEMENTED。ProductEvent/GrowthEvent/AuditEvent/OutboxEvent 四类分离在代码中成立,但统一观测链(blueprint §9/ARCH-11)**PARTIAL**。

---

## 汇总标签统计

| 标签 | 计数(本清单) |
|---|---|
| CURRENT_IMPLEMENTED | apps 3 / packages 5 / modules 4 / UI-01 / AI runtime / events core |
| PARTIAL | web, fes-web, program-runtime, harness, family-model, waf-contracts, orchestration, mobile local-state, 观测链 |
| CODE_EXISTS_NOT_WIRED / BLOCKED | WAF |
| TEST_LOOP_FIXTURE | orchestration commerce/service 面(matrix 8 屏) |
| NOT_IMPLEMENTED | consumer-web/ops-web/worker、PG18/pgvector/Redis/Temporal、35UI REAL_PERSISTED=0 |

下一步不在本任务内。见 `ARCH_MODULE_OWNERSHIP_MATRIX_V1.md` 与 `ARCH_DRIFT_REGISTER_V1.md`。ARCH-00 完成即停,不进 ARCH-01。
