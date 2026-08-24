# ARCH-00 · Module Ownership Matrix V1

```text
DOC_KIND = ARCHITECTURE_AUDIT_EVIDENCE
TASK = ARCH-00 Architecture Inventory & Drift Lock
STATUS = AUDIT_ONLY
SNAPSHOT = worktree D:\family-ai-plan @ babd49f
PURPOSE = 把「blueprint §4 目标领域边界」与「代码当前所在模块」对照,标出所有权漂移;只映射,不搬迁
```

> blueprint §2.3 / §4 / §P0-02:目标是 `Family Core owns family truth` 与 `Growth OS owns growth state` 分离;当前代码是 `FamilyModule = Family Core + 大部分 Growth OS + DEV projections`。本矩阵给出精确对照。**本任务不移动任何文件**;迁移顺序是「先定 ports/ownership → 固定 contracts → 逐步迁 application service,行为与测试不变」。

---

## 1. 目标领域(blueprint §4) → 当前代码位置

| 目标领域(应拥有) | 目标所有权要点 | 当前代码位置 | 漂移 |
|---|---|---|---|
| **Identity/Auth** | Account/Session/AuthZ/Principal binding | `modules/auth` | ✅ 基本对齐 |
| **Family Core** | Family/Person/Relationship/Membership/LifeStage | `modules/family`: `FamilyService`, `FamilyRepository`, `FamilyAggregateRepository` | ✅ 在 family,但与 Growth 混居同模块 |
| **Consent** | Grant/Withdraw/Check/Purpose/Retention | 分散:`consents` 表 + 各 service 内 `assertRequiredGrowthConsents`(growth-action/intervention) | ⚠️ 无独立 Consent runtime 边界(§P0-03) |
| **Safety/Human Gate** | route/flag/human review/handoff | `normal-safety-route.policy` / `reflection-safety.policy` + principal 侧 | ⚠️ 策略在,未成独立边界 |
| **Growth Intelligence** | Evidence/Perspective/Hypothesis/Profile/Priority | `modules/family`: `EvidenceSynthesisService`, `GrowthHypothesisService`, `GrowthPriorityService`, `AssessmentService` | 🔴 应属 Growth OS,现挂 FamilyModule |
| **Growth Journey & Action** | Journey/Plan/Intervention/Action/Checkin/Review | `modules/family`: `JourneyPlanService`, `InterventionService`, `GrowthActionService`, `GrowthReviewService`, `GrowthCampService`, `GrowthSubjectResolver`, `TodayService`, `OnboardingService` | 🔴 应属 Growth OS,现挂 FamilyModule |
| **Principal AI** | 理解/上下文/结构化提案(不拥有 canonical) | `modules/principal` + `packages/principal-*` + `ai-gateway` | ✅ 对齐 |
| **Program/Challenge/WAF** | Program/21-day/Participation | `GrowthCampService`(family) + `packages/program-runtime` + `modules/waf`(未接线) | 🔴 归属未定(§P0-04/ARCH-06);Camp 现挂 FamilyModule |
| **Content/Community** | Editorial/Post/Bookmark/Follow | 主要在 mobile + orchestration/test-loop;后端域未独立 | ⚠️ PARTIAL |
| **Service OS** | Provider/Offering/Slot/Booking/Record | `modules/orchestration`(service-supply/booking)+ `DevPlatformSurfacesService` | ⚠️ 编排层承载,多为 TEST_LOOP_FIXTURE |
| **Commerce/Membership** | Product/Intent/Order/Entitlement | `modules/orchestration`(commerce-intent/objects/membership-entitlement) | ⚠️ 编排层承载,TEST_LOOP_FIXTURE |
| **Operations** | review/route/handoff(经 Named Action) | `DevPlatformSurfacesService`, `DevFlowReceiptService`(DEV 面) | ⚠️ DEV 面,未成正式 Ops |
| **Analytics** | ProductEvent/Funnel/Eval | outbox/audit + reports/model-eval | ⚠️ PARTIAL |

图例:✅ 对齐 · ⚠️ 部分/边界弱 · 🔴 明显所有权漂移。

## 2. FamilyModule 20 providers 的目标归属

| provider | 当前模块 | 目标域 | 结论 |
|---|---|---|---|
| FamilyService / FamilyRepository / FamilyAggregateRepository | family | **Family Core** | 留在 Family Core |
| GrowthSubjectResolver | family | Family Core↔Growth 边界件 | 归 Growth OS(subject scope),Family Core 供关系事实 |
| AssessmentService / EvidenceSynthesisService / GrowthHypothesisService / GrowthPriorityService | family | **Growth Intelligence** | 迁 Growth OS |
| JourneyPlanService / InterventionService / GrowthActionService / GrowthReviewService / TodayService / OnboardingService | family | **Growth Journey & Action** | 迁 Growth OS |
| GrowthCampService | family | **Program** | 迁 Program(待 ARCH-06 定 WAF/Program) |
| FamilyHomeService / TenantScopedUiProjectionService | family | **Projection Layer**(BFF) | 迁 Projection(blueprint §6) |
| DevCoreGrowthService / DevPlatformSurfacesService / DevFlowReceiptService | family | **DEV/Ops surfaces** | 隔离标注,非生产域 |

> 迁移不在本任务内;这是 ARCH-02/04/06 的目标态,ARCH-00 只登记。

## 3. 跨域读端口(ports)现状

blueprint §6 要求 page projection 只经「approved read ports」组合 domain 只读投影。当前:
- `FamilyHomeService.getHome` 已用进程内组合(`GrowthActionService.listTodayActions` + repository 读),不经 HTTP 自调 —— ✅ 符合 §6。
- 但跨域 ports **未显式化**(直接注入具体 Service),`PARTIAL`(§P1 "Cross-domain ports 不完全显式")。

## 4. 关键不变量当前遵守情况(证据)

| 不变量 | 当前 | 证据 |
|---|---|---|
| Named Action only 写 canonical | ✅ | 写路径均经 idempotency + audit + outbox(growth-action/intervention/priority service) |
| AI 不直接写 canonical | ✅ | home `NO_MODEL_CONCLUSION_IN_HOME_READ`;Principal 产 proposal |
| Account≠Person / Relationship≠AuthRole | ✅ | auth 模块分离 |
| test-loop 不冒充 real | ✅(诚实) | matrix 标 TEST_LOOP_FIXTURE=8,REAL_PERSISTED=0 |
| **Subject 隔离(多孩子)** | 🔴 **未做** | `growth_actions/intervention_episodes/growth_priorities` 无 `subject_person_id` 列;`getTodayAction/listTodayActions` 按 `family_id` 取数 → 多孩子串数据(见 DRIFT DR-06) |

---

结论:最大的所有权问题是 **Growth OS 事实上寄居在 FamilyModule**(14/20 providers 属 Growth/Program/Projection)。这是 blueprint §P0-02 的核心,处置走 ARCH-02(context/subject/consent gate)与 ARCH-04(growth slice),**先 ports 后迁移**。漂移清单见 `ARCH_DRIFT_REGISTER_V1.md`。
