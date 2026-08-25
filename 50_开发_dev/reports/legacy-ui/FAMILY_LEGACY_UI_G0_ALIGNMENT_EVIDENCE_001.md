# FAMILY legacy UI — G0 ALIGNMENT EVIDENCE 001

```text
TASK     = FAMILY-LEGACY-UI-FULLSTACK-REBASELINE-001 / G0
DATE     = 2026-08-22
BASE_SHA = 708cf542ab130642f2248bbebecc997930d10a49
SINGLE_WRITER = 本 Claude Code 会话(D:\Family-ai)
```

## 1. 基线对齐(Section 0-2)

| 项 | 结果 |
|---|---|
| origin | https://github.com/PoCP-Protocol/family-ai.git ✅ |
| 本地初始 HEAD | 964c8459(远端 main 的祖先,落后 2 提交) |
| fetch 后 origin/main | 708cf542 ✅(架构师核实一致:964c845→23ddbfe→708cf54) |
| reset --hard origin/main | HEAD=708cf542,cat-file=commit ✅ |
| LOCAL_RECONCILIATION | PASS |
| rescue 分支 | `rescue/legacy UI-pre-g0-20260822`(本地,未推送,保存 4 个 pre-G0 文件) |
| 工作分支 | `platform/legacy UI-fullstack-rebaseline-001`(merge-base=main=708cf542) |

## 2. rescue 既有产出定性(Section 6)

| 文件 | 来源 | 定性 |
|---|---|---|
| governance/ARCHITECTURE_DRIVER_legacy UI_REBASELINE_001.md | 前会话(untracked) | EVIDENCE_ONLY(方法论已被本轮 V4+PROGRAM 吸收;不再单独作为 SSOT) |
| backlog/tasks/FAMILY-LEGACY-UI-ARCHITECTURE-REBASELINE-001.md | 前会话 | SUPERSEDED(ABSORBED_INTO_G0;由 legacy-ui/FAMILY_LEGACY_UI_FULLSTACK_REBASELINE_001 取代) |
| reports/legacy-ui/UI_CAPABILITY_MATRIX_V1.md | **并发会话**(非本会话所写) | EVIDENCE_ONLY(信息被 RUNTIME_MATRIX 机器化取代;保留可追溯,未采纳为 canonical) |
| PROJECT_STATUS.md(改动) | 前会话 | MERGE(状态并入 CURRENT_SPRINT/PROGRAM_STATUS,不整体 cherry-pick) |

> historical canonical 机器契约已废弃；current execution SSOT = `governance/FAMILY_CONSUMER_UI_BASELINE_V1.json`,**不是**最先出现的任何 markdown。

## 3. runtime_status 逐页据实分类(Section 13)

分类枚举:REAL_PERSISTED / REAL_INTERNAL_RUNTIME / TEST_LOOP_FIXTURE / LOCAL_DRAFT / READ_ONLY_PROJECTION / GATE_BOUNDARY / NOT_IMPLEMENTED。
证据源:`governance/FAMILY_CONSUMER_UI_MASTER_DATA_API_NAMED_ACTION_MAPPING_V1.md`"当前实现"列 + `apps/mobile/lib/family/family-api-client.ts` 真实端点 + 第二控制面盘点。

分布:**REAL_PERSISTED=0** · READ_ONLY_PROJECTION=18 · TEST_LOOP_FIXTURE=8 · GATE_BOUNDARY=6 · LOCAL_DRAFT=2 · NOT_IMPLEMENTED=1。

| UI | status | 依据 |
|---|---|---|
| UI-01 | READ_ONLY_PROJECTION | FamilyHomeProjection;/dev/core-growth 只读 |
| UI-02 | GATE_BOUNDARY | 测评 AI interview 走 gateway draft,live model 未授权 |
| UI-03 | GATE_BOUNDARY | AI诊断 live 未授权;GrowthDiagnosticHypothesis 持久化未建 |
| UI-04 | READ_ONLY_PROJECTION | plan-preview 只读投影 |
| UI-05 | LOCAL_DRAFT | service-journey checkin-drafts 私有草稿 |
| UI-06 | READ_ONLY_PROJECTION | membership customer-projection;真实权益 Gate |
| UI-07 | READ_ONLY_PROJECTION | 测评目录只读 |
| UI-08 | READ_ONLY_PROJECTION | report-explanation 只读 |
| UI-09 | TEST_LOOP_FIXTURE | page-objects test-loop(consumer UI baseline 曾称 API+DB+集成过,但 namespace=test-loop) |
| UI-10 | GATE_BOUNDARY | 儿童直接作答 HOLD |
| UI-11 | READ_ONLY_PROJECTION | 私有进度,禁跨家庭排名 |
| UI-12 | LOCAL_DRAFT | 私有故事 + 分享草稿,公开 HOLD |
| UI-13 | READ_ONLY_PROJECTION | admitted catalog 只读 |
| UI-14 | TEST_LOOP_FIXTURE | order-intents(external_effect=false) |
| UI-15 | TEST_LOOP_FIXTURE | invite 体验闭环 |
| UI-16 | TEST_LOOP_FIXTURE | group 体验闭环 |
| UI-17 | GATE_BOUNDARY | 真实积分/兑换禁止 |
| UI-18 | READ_ONLY_PROJECTION | 会员投影;真实支付 Gate |
| UI-19 | READ_ONLY_PROJECTION | provider catalog |
| UI-20 | READ_ONLY_PROJECTION | provider(detail DTO 待补,记 gap) |
| UI-21 | TEST_LOOP_FIXTURE | booking-requests(no human contact) |
| UI-22 | READ_ONLY_PROJECTION | activity catalog |
| UI-23 | TEST_LOOP_FIXTURE | event 报名体验闭环 |
| UI-24 | READ_ONLY_PROJECTION | service/customer 投影 |
| UI-25 | GATE_BOUNDARY | 真实社区外发隔离 |
| UI-26 | TEST_LOOP_FIXTURE | publish RECORDED,no external |
| UI-27 | NOT_IMPLEMENTED | 详情 projection DTO 待接入 |
| UI-28 | READ_ONLY_PROJECTION | 私有社区投影 |
| UI-29 | READ_ONLY_PROJECTION | 私有成果/过程投影 |
| UI-30 | GATE_BOUNDARY | 年度会员真实支付 Gate |
| UI-31 | READ_ONLY_PROJECTION | MyServices 投影 |
| UI-32 | READ_ONLY_PROJECTION | 资产投影(SQL view) |
| UI-33 | READ_ONLY_PROJECTION | family profile 投影;consent 写动作未从 UI 接线 |
| UI-34 | READ_ONLY_PROJECTION | service record 投影 |
| UI-35 | TEST_LOOP_FIXTURE | 21天营(program-runtime 存在,UI 写未证实) |

## 4. 覆盖与验收(Section 12 摘要)

- 35/legacy UI 全部有 primary_domain / projection / named_actions / runtime_status。
- AI use case 页均 ai_control_plane=FAMILY_LLM_GATEWAY;无 AI 页=NONE。
- UI-03 保留 AI_DIAGNOSIS。
- 诚实声明:`LEGACY_UI_FRONTEND_BASELINE=KEEP` · `LEGACY_UI_BACKEND_COMPLETE=NO` · `G0=ALIGNMENT_FOUNDATION`。
- 已知 strict blocker:MOBILE_DIRECT_MODEL_PROVIDER(private-note-tags→forge)、MOBILE_SECOND_DB(mysql2)——见 inventory,G1 迁移。
