# FAMILY-35UI-ARCHITECTURE-REBASELINE-001 — 35 UI 反推架构重整

Status: READY
Coding: FORBIDDEN (架构映射与契约任务,不写业务代码)
Ruling: governance/ARCHITECTURE_DRIVER_35UI_REBASELINE_001.md
Ruling_Date: 2026-08-22

## Business Intent

把仓库现有的、散落的能力,重新抽象成一套**能够完整支撑 35 个 UI 运行**的 Family 平台架构。
方法链固定为 `UI → Journey → Capability → Domain → Runtime`;
产品范围以 35 UI 为 **V1 Product Scope Baseline**;
边界:`35 UI ≠ 35 套后台`,识别页面差异但合并业务真相。

> 这不是削减 35 页,而是让整套架构从 35 页"长出来"。任何解释不了某个 UI 的架构都不完整;
> 任何需要重新发明后台模型的页面都说明架构没收好。

## Fixed Scope

- 产品范围基线: UI-01 ～ UI-35(Product Scope SSOT)
- 七大业务域 + 1 横向 AI 层 + 1 跨域 Context 核心(见 Ruling §五)
- 目标分层架构(见 Ruling §八)
- Projection 层原则(见 Ruling §九):35 Projection 可,35 Domain 不可

## Must Produce(核心交付物)

1. **UI Capability Matrix** — 35 UI → 用户旅程 → 业务能力
   `reports/rebaseline-35ui/UI_CAPABILITY_MATRIX_V1.md`
2. **Domain Ownership Matrix** — UI Capability → 七域归属(每个 UI 有明确 Domain Owner)
   `reports/rebaseline-35ui/DOMAIN_OWNERSHIP_MATRIX_V1.md`
3. **Canonical Object Model** — 七域 → 规范对象模型(合并重复页面的业务真相;无重复 Domain Truth)
   `reports/rebaseline-35ui/CANONICAL_OBJECT_MODEL_V1.md`
4. **35 UI × Journey × Domain × Object × API × Projection × AI × Skill × Data 主矩阵**
   `reports/rebaseline-35ui/UI_TO_RUNTIME_TRACE_MATRIX_V1.md`

主矩阵每行至少含:UI · Domain · Projection · API · AI · Skill · Canonical Write。
示例行:

| UI | Domain | Projection/API | AI | Skill | Canonical Write |
|---|---|---|---|---|---|
| UI-02 | Growth Intelligence | AssessmentSession | Assessment Agent | Assessment Skill | Evidence |
| UI-03 | Growth Intelligence | DiagnosisProjection | Diagnosis Agent | Diagnosis Skill | No direct Fact |
| UI-09 | Growth Journey | TodayTask | Family Copilot | Practice Skill | GrowthAction |
| UI-14 | Resource & Commerce | ProductDetail | Recommendation | — | OrderIntent only |
| UI-21 | Service OS | ServiceBooking | Routing | Service Policy | BookingRequest |
| UI-33 | Family Core | FamilyAccount | Context summary | — | Consent/Family actions |

## Journey 纵切(首批四条,后续实施按此,不按后台模块)

- Journey A 测评→AI诊断→下一步帮助: `UI07→UI02→Assessment Skill→Assessment Evidence→Diagnosis Agent→UI03→GrowthNeedSignal→ResourceRecommendation→UI01/UI35/UI19`
- Journey B 成长营→每日行动→阶段复盘: `UI35→UI09→CheckIn→UI11→Review→UI29`
- Journey C AI帮助→真人服务: `UI01/UI03→Need→UI19→UI20→UI21→ServiceCase→UI24/UI31→UI34`
- Journey D 资源→权益→服务: `UI13→UI14→OrderIntent→Entitlement→UI18/UI30→UI32→Service`

## Pass Condition(验收 = Ruling §十二)

```text
EVERY_UI_HAS_CLEAR_DOMAIN_OWNER
+ EVERY_WRITE_HAS_CANONICAL_OWNER
+ EVERY_AI_CALL_HAS_CONTROL_PLANE
+ NO_DUPLICATE_DOMAIN_TRUTH
+ 35_UI_ARCHITECTURE_COVERAGE = 100%
```

## Hard Rules(不可违背)

- 复用现有对象/权限/审计/幂等/投影层,不新建孤立页面或孤立数据模型。
- `Perspective/Hypothesis/Recommendation != Fact/Decision/Action`;AI诊断产出 GrowthDiagnosticHypothesis,不直接写 Fact。
- Program/Stage/Action/CheckIn/Review 统一模型,21天营/90天计划等仅为不同 Program Template。
- 商城不做系统中心;Community 服从 Family Privacy、Private First、不定义成长。
- 授权红线不因本任务改变:真实外部模型默认关、pilot/production 未授权,仍由 AUTHORIZATION_REGISTRY 单独管。
- 本任务不改 milestone/phase,不擅自跨 Sprint;只产出上述架构映射交付物。

## Existing Inputs(可复用,不重造)

- `governance/FAMILY_34_UI_*`(对象/API/Named Action/多租户/多模态映射雏形)
- `architecture/FAMILY_OBJECT_UNIVERSE_V1.md` / `FAMILY_OBJECT_STATE_ACTION_MATRIX_V1.md` / `FAMILY_SKILL_MODEL_V1.md` / `FAMILY_GROWTH_ORCHESTRATION_ARCH_V1.md`
- `apps/mobile`(44 UI 页面实现,Product Scope 的现实来源)
- `database/migrations/0001–0036`(现有 canonical schema)
