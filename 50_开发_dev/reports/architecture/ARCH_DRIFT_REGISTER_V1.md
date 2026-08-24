# ARCH-00 · Drift Register V1

```text
DOC_KIND = ARCHITECTURE_AUDIT_EVIDENCE
TASK = ARCH-00 Architecture Inventory & Drift Lock
STATUS = AUDIT_ONLY (登记漂移,不修复)
SNAPSHOT = worktree D:\family-ai-plan @ babd49f
NOTE = 每条 drift 的「建议 ARCH Task」仅为建议,不得自动执行(blueprint §20)
```

> 漂移 = 「文档/目标声称」与「运行时/代码/DB 实况」之间的差。严重度:P0 阻塞治理决策/有安全风险;P1 收敛质量;P2 可维护性。

---

## P0

### DR-01 · 34 vs 35 UI 基线不一致(活跃冲突)
- **实况**:`governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json` 仍 `screens=35`(含 UI-35);而 `packages/contracts/src/family-35ui.ts` 的 `FAMILY_UI_IDS` 已是 UI-01..UI-34,`tools/validate-35ui-alignment.mjs`(工作树未提交)已改成 `length:34` + `FAMILY_34UI_BASELINE_GATE_V1` + `UI-35 is deleted must not appear`。
- **风险**:validator 要求 34、matrix 提供 35 → 一旦 validator 那次改动提交,`validate:35ui` 会 FAIL;且"删 UI-35" 与用户 blueprint/34UI 提案里"UI-35 保留为 Extension"存在**产品裁决冲突**。
- **状态**:`STALE_ARTIFACT + UNRESOLVED_PRODUCT_DECISION`。
- **建议**:统一到 34 baseline + Extension registry(UI-35 归 Program Extension),并同步 matrix。归 34UI baseline 裁决 / ARCH-03 邻域。

### DR-02 · 两条治理叙事并存且未桥接
- **实况**:旧线(M1/M2/M3 MOS:`PROJECT_STATUS.md` phase=M3_FAMILY_1_0_MOS、README PROGRAM_MODE=M3_MOS_CLOSEOUT)与新线(G0→V4.1→V5:`architecture/*V4_1*`、`FAMILY_35UI_RUNTIME_MATRIX`、`backlog/tasks/FAMILY-AI-V5-RUNTIME-FOUNDATION-001`)无从属/桥接说明。
- **证据**:`00_复盘/2026-08-23_全面阶段性复盘.md` §2 已登记为 P0,尚无裁决。
- **状态**:`GOVERNANCE_NARRATIVE_FORK`。
- **建议**:架构师裁决 M3_MOS 与 G0/V4.1/V5 的包含或并行关系,统一 PROGRAM_MODE 口径。

### DR-03 · PROJECT_STATUS / README 口径滞后
- **实况**:`PROJECT_STATUS.md` as_of 2026-08-11、phase=M3;README PROGRAM_MODE=M3_MOS_CLOSEOUT;但实际执行已转 V4.1/35UI(08-22 起)。
- **状态**:`STALE_DOC`(低权威层未被高权威层纠正,违 `TRUTH_HIERARCHY`)。
- **建议**:刷新 as_of 与 phase,或加"以 governance/runtime 为准"的显式指针。

### DR-04 · WAF 有代码但未接线,归属未定
- **实况**:`modules/waf` + `packages/waf-contracts` 存在;`AppModule.imports` 不含 WafModule。
- **状态**:`CODE_EXISTS_NOT_WIRED / OWNERSHIP_UNDEFINED`。
- **建议**:先 ADR 定 WAF 语义(是否 = We are Famili / Program / seeded domain)再接线(blueprint ARCH-06)。

### DR-05 · FamilyModule 过载(Growth OS 寄居)
- **实况**:FamilyModule 挂 20 providers,其中 14 属 Growth Intelligence / Journey&Action / Program / Projection。
- **状态**:`OWNERSHIP_DRIFT`。
- **建议**:先 ports/ownership,再渐进拆分(ARCH-02/04),行为与测试不变。

### DR-06 · 多孩子 Subject 隔离缺失(安全)
- **实况**:`growth_actions` / `intervention_episodes` / `growth_priorities` 三表**无 `subject_person_id` 列**;`growth-action.service.ts:46-92` `getTodayAction/listTodayActions` 仅 `where family_id=$1` 取数。
- **风险**:一个家庭多个孩子时,读取会串到另一孩子的 action/episode/priority。能力增强会放大此错误。
- **状态**:`RUNTIME_SECURITY_GAP`(违 blueprint FIT-004 精神:cross-subject 未 fail-closed)。
- **建议**:加 `subject_person_id` + 回填(profile 链)+ 读隔离 + 多孩子负向测试(已有草案 EXECUTION_PLAN;归 ARCH-02/04)。

### DR-07 · 35UI 产品层 REAL_PERSISTED=0
- **实况**:matrix 中 REAL_PERSISTED=0(READ_ONLY 18 / TEST_LOOP 8 / GATE 6 / LOCAL_DRAFT 2 / NOT_IMPL 1)。UI-01 已 thin-client 化但其读模型底层仍多为投影/fixture。
- **状态**:`NOT_IMPLEMENTED(product write loop)`(诚实,与 governance 一致)。
- **建议**:按域纵切补真实写闭环(ARCH-04 起),勿一次铺开。

## P1

### DR-08 · Service/Commerce 仍 test-loop
- **实况**:orchestration 的 commerce-intent/objects/membership/service 多为 `TEST_LOOP_FIXTURE`(matrix 8 屏)。
- **状态**:`TEST_LOOP_FIXTURE`。**不得声称真实 payment/booking/fulfillment 完成**(FIT-006)。
- **建议**:ARCH-07/08,保持 `runtime_status=TEST_LOOP_FIXTURE, external_effect=false` 标注。

### DR-09 · Mobile 本地态边界弱
- **实况**:UI-05 `WEEKLY_TASKS`/"超过78%"、UI-31 本地进度%、`campCompletedDays` 等显示态由本地计算。
- **状态**:`LOCAL_DRAFT_OVERREACH`(违 blueprint §11 分层:AsyncStorage 非 canonical;FIT-011)。
- **建议**:分 SERVER_CANONICAL / PROJECTION_CACHE / LOCAL_DRAFT / UI_EPHEMERAL(ARCH-04/10)。

### DR-10 · Projection Meta / ports 未统一
- **实况**:`FamilyHomeProjection` 有 provenance/as_of 但未统一到 blueprint §6 `ProjectionMeta`(runtime_status/visibility/trace_id/stale);跨域 ports 未显式。
- **状态**:`PARTIAL`。
- **建议**:ARCH-01 统一 `ProjectionMeta/RuntimeStatus/SourceRef/Visibility/Trace`。

### DR-11 · blueprint §21 read-list 指向不存在路径
- **实况**:blueprint §21 让读 `docs/FAMILY_TECH_ARCH_V3.2.md`、`docs/PRODUCT_BOUNDARY_MAP_V3.2.md`、`specs/ontology/**`、`specs/actions/**` 等;本仓库无 `docs/*V3.2*` 与 `specs/` 目录,实际是 `10_规格_spec/` + `governance/` + `architecture/V4_1`。
- **状态**:`BLUEPRINT_ASSUMES_DIFFERENT_LAYOUT`。
- **建议**:执行后续 ARCH task 时按仓库真实结构读取;不新建 `specs/` 只为对齐 blueprint 文字。

## P2

### DR-12 · 版本文件并存(SUPERSEDED 未清)
- **实况**:`10_规格_spec/04_实施计划` 有 V3.3(当前)/ V3.0(SUPERSEDED)/ V2.0(ARCHIVED)并存;architecture 有 V4/V4.1;master data V1/V2。多数已标 SUPERSEDED_FOR_EXECUTION,但未清理。
- **状态**:`VERSION_SPRAWL(标记清晰)`。
- **建议**:定"版本生命周期"(SUPERSEDED→归档→删)时间表。

### DR-13 · 缺跨全仓 SSOT 地图
- **实况**:有 `governance/TRUTH_HIERARCHY.md`(权威序)与 `ENGINEERING_CONTRACT_INDEX.md`(工程合约导航),但无横跨 `10_规格_spec + 50_开发_dev + 20_知识` 的统一"文档 SSOT 地图"。
- **状态**:`MISSING_INDEX`。
- **建议**:新建 `DOCUMENTATION_MAP` + 每份 governance/architecture 首行标准化 `DOC_KIND/STATUS/SUPERSEDED_BY`(约 30% 现缺)。

### DR-14 · 多会话并发 churn
- **实况**:审计期间存在 ≥2 个并发会话在 `architecture/family-ai-v4-1-convergence-001` 与 `architecture/system-integration-baseline-001` 上提交/编辑(含未提交改动)。
- **状态**:`CONCURRENCY_HAZARD`。
- **建议**:以 git HEAD 为唯一权威;隔离 worktree 作业;合并只走 PR。

---

## 汇总

| severity | 条目 |
|---|---|
| P0 | DR-01 34/35不一致 · DR-02 双叙事 · DR-03 状态滞后 · DR-04 WAF未接线 · DR-05 FamilyModule过载 · DR-06 Subject隔离缺失 · DR-07 REAL_PERSISTED=0 |
| P1 | DR-08 test-loop · DR-09 本地态越界 · DR-10 ProjectionMeta未统一 · DR-11 blueprint路径错配 |
| P2 | DR-12 版本并存 · DR-13 缺SSOT地图 · DR-14 并发churn |

**ARCH-00 到此完成。不进 ARCH-01。** 后续 ARCH task 均需 owner/架构师逐项授权(blueprint §20:NEXT_RECOMMENDED_TASK 仅建议,不自动执行)。
