# 生成式AI系统现状评估与完善路径 V1

STATUS: ASSESSMENT_SNAPSHOT（非架构冻结文档，不覆盖 `FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` 的任何决定）
AUTHOR: family-chief-architect（Claude Code）
DATE: 2026-08-28
SCOPE: 家庭成长平台后端生成式AI系统（支撑前端AI应用的能力现状），评估依据为对 `50_开发_dev/` 代码、测试、governance registry 的直接核实，非文档自述。

---

## 0. 一句话结论

生成式AI系统当前**介于"半成品"与"齐全只差开关"之间，且明显偏向前者**：治理/安全边界工程（fail-closed、hypothesis-not-fact、human confirmation、Named Action桥接）已经做到相当成熟的水准；但真正跑通的AI能力只有4条业务代码，其中3条**从未被验证过对接真实模型后schema能否通过**，prompt/schema资产分散在3种不同资产化程度里，AI_USE_CASE_REGISTRY里7个业务级use case与代码实现无法一一对应，架构文档设计的Python AI Runtime（负责重AI计算与独立评估体系）完全是空壳。

---

## 1. 已经做好的：治理与边界工程

### 1.1 TS侧AI网关（`packages/ai-gateway`）
- 支持 Anthropic / OpenAI兼容 / 智谱多provider，`RoutingAiGateway` 仅对基础设施瞬时错误（TIMEOUT/NETWORK_ERROR/PROVIDER_5XX）做受控failover，4xx/schema失败/policy拒绝立即FAIL CLOSED，不静默兜底。
- 默认 `FakeAiGateway`（mock），只有显式env组合（`FAMILY_MODEL_GATEWAY_MODE=cc-switch` + `FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI=true` + 授权对象同时满足）才构造真实网关。
- 7个测试文件、43个测试全绿（均为mock/离线测试）。

### 1.2 AI输出与业务事实边界（抽查`growth-hypothesis.service.ts`/`principal.service.ts`结论：执行严格，未发现绕过口子）
- `family_growth_hypotheses` 表插入时硬编码 `fact_boundary='HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS'`，非可选字段。
- `decide()` 只有 `decision_type==='CONFIRM'` 才写入 `growth_intents`（`boundary='HUMAN_CONFIRMED_INTENT_NOT_OUTCOME'`），高风险场景（safety_gate.required）直接 `ForbiddenException` 拒绝confirm路径。
- AI草稿存 `family_assessment_ai_runs.output_body`（`state_upper_bound='DERIVED_DRAFT_PRIVATE'`），与canonical业务表分层存储。
- Principal陪练的proposal接受时（`acceptProposal`）桥接到既有 `InterventionService.startIntervention` Named Action，consent/safety/priority/权限/幂等在Named Action内部独立再校验，不信任上游AI判断。
- **唯一相对薄弱点**：`family-assessment-model.provider.ts` 真实网关调用失败时是 `catch{}` 静默回退到确定性版本，而非Principal路径的显式FAIL_CLOSED降REVIEW——逻辑可解释（反正都要走human confirm），但不是严格fail-closed，前端能否正确区分"这次是真模型生成还是回退内容"取决于`ai_state`字段是否被正确回传。

### 1.3 前端边界呈现（UI-03抽查）
- `fact_boundary` 强类型枚举贯穿到前端类型定义，非自由字符串。
- 8种状态精细渲染（`NO_SUBMITTED_ASSESSMENT/POLICY_BLOCKED/CONSENT_WITHDRAWN/SUBMITTED/ANALYZING/ACKNOWLEDGED/DISMISSED/ANALYSIS_FAILED`），`ai_state` 单独展示模型调用实况。
- 文案反复强调"这不是儿童诊断结论、能力测验或排名"，按钮触发的是 `decideGrowthHypothesis(...,'CONFIRM')` 这个Named Action，不是本地state直接置信；`safetyGateRequired` 时按钮变"等待人工复核"并禁用确认路径。

---

## 2. 真正的AI能力：4条业务代码，3条未验证

| # | 场景 | 调用链 | 默认状态 | 真实外呼测试 |
|---|---|---|---|---|
| 1 | UI-03 家庭测评AI解读 | `family-model-gateway.provider.ts` → `family-assessment-model.provider.ts` → `growth-hypothesis.service.ts` | mock | **无** |
| 2 | Principal陪练（问Famili家长） | `principal.service.ts`（`PRINCIPAL_AI_GATEWAY` DI token） | mock/deterministic | 有（`*.livecheck.ts`，默认skip） |
| 3 | Family LLM Gateway（UI-01~34通用"AI解释"） | `orchestration/llm-gateway/family-llm-gateway.service.ts` | `enabled=false` fail-closed | **无** |
| 4 | Mobile小记标签（PRIVATE_NOTE_TAGGING） | `apps/mobile/server/private-note-tags.ts` → `_core/llm.ts` | legacy，完全不经过`@family/ai-gateway` | 属于已知技术债，registry标记`NO_NEW_DIRECT_CALLS`，非主线 |

**核心问题**：只有Principal这一条线有"真调用能返回结构化数据"的证据链（哪怕默认skip）；另外两条主线（UI解释类网关、测评解读网关）覆盖了全部34个UI页面和核心测评场景，却从未真正验证过对接真实provider后schema能否通过。这是比"registry未授权"更基础的风险——即使治理放行，这两条线目前**没有任何证据证明跑得通**。

---

## 3. Prompt/Schema资产化程度：三种成熟度并存，无统一注册表

| 资产 | 位置 | 成熟度 |
|---|---|---|
| Principal Soul（人格/边界/关系/思维/语言风格） | `products/famili-principal/soul/*.yaml`（6个独立YAML）+ golden set导出工具链 | 高，唯一真正独立资产目录 |
| Family LLM Gateway（UI-01~34解释类） | `family-llm.contract.ts`（schema）+ `family-llm-page-policy.ts`（prompt_version/use_case映射） | 中，TS内强类型常量，结构化但非独立文件资产 |
| Family Assessment Model（UI-03测评解读） | `packages/family-model/src/index.ts` 单文件 | 低，prompt逻辑/schema推测内联 |
| Principal核心orchestration | `packages/principal-ai/src/index.ts` 单文件 | 低，同上 |

已有明确版本号+output_schema+人工确认门的use case约**3-4个**，无统一prompt版本注册表/schema目录，三条线各管各的版本字符串。

---

## 4. AI_USE_CASE_REGISTRY 与代码实现对照

`governance/FAMILY_AI_USE_CASE_REGISTRY_V1.yaml` 登记7个业务级use case，全部 `runtime_authorization: NOT_YET_AUTHORIZED`（除`PRIVATE_NOTE_TAGGING`为`MIGRATION_ONLY`）：

| use_case_id | 代码实现情况 |
|---|---|
| AI_DIAGNOSIS | 有雏形（Principal陪练里的risk诊断类输出），无独立skill |
| ASSESSMENT_INTERPRETATION | **已实现**（对应表2 #1） |
| GROWTH_PLAN_DRAFT | 未找到独立实现 |
| PRIVATE_NOTE_TAGGING | 已实现，legacy路径（表2 #4） |
| RESOURCE_RECOMMENDATION | 未找到实现 |
| EXPERT_ROUTING | 未找到实现 |
| REPORT_EXPLANATION | **已实现**（对应表2 #3的`explain_report`） |
| DAILY_COACH | 与Principal"one_small_action"接近但非严格对应 |

**治理缺口**：Family LLM Gateway下还有6个use_case（`explain_need`/`explain_task`/`explain_mock_commerce`/`explain_mock_service`/`explain_mock_community`/`text_equivalent`/`safety_stop`）在registry里没有对应条目——registry是业务语义分类，代码是页面语义分类，两套体系无显式映射表，审计覆盖率无法直接确认。

---

## 5. Python AI Runtime（架构设计角色 vs 现实）

`FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` 第5 Plane "AI INTELLIGENCE PLANE" 设计分工：
- **Family Intelligence Runtime（TS）**：治理边界内的server-side orchestration —— 当前`ai-gateway`+各service实际承担的角色。
- **Python AI Services**：FastAPI+Pydantic+httpx，明确"MUST NOT own business repositories or directly mutate canonical business tables"，服务重计算/长耗时/RAG等场景。
- **Codex Harness**：可选内部执行runtime，无客户端暴露、无canonical mutation权限。

现实：`apps/ai-runtime` 源码目录完全空壳（仅`__pycache__`残影，0个`.py`文件）。多语言schema绑定生成链路（TS SDK→Python Pydantic绑定）没有源头资产。Eval体系（Unit/Golden/Safety/Regression/Model comparison/Prompt comparison/Human judge/Model judge/Latency/Cost/Online quality共11种信号）除Principal一条线的golden set雏形外基本不存在。

**空壳意味着缺失**：无法做异步/长耗时/重计算AI任务（复杂多轮agent、批量embedding、复杂RAG）；TS侧被迫兼任了本该Python侧承担的部分职责，与架构设计的分工不符；Codex Harness零基础；schema多语言绑定链路需从头补资产目录。

---

## 6. 完善路径（按优先级）

### P0：先验证，不是先开关
在给UI-03测评解读、Family LLM Gateway任何一条线申请`runtime_authorization`放行之前，先补齐真实外呼集成测试（可参照Principal的`*.livecheck.ts`模式，默认skip、显式env触发），确认对接真实provider后schema真的能通过。当前风险是"治理批了，代码却没跑通"。

### P1：补齐registry↔代码映射
建立一张显式映射表，把Family LLM Gateway的8个页面级use_case对应到registry的7个业务级use_case（或反向拆分registry粒度），否则审计永远无法确认覆盖是否完整。

### P1：收拢prompt/schema资产
参照Principal Soul的YAML模式，把UI-03测评解读、Principal核心orchestration里内联的prompt/schema逻辑拆成独立、可版本化的资产文件，建立跨use_case的统一版本注册表。

### P2：明确Python AI Runtime的建设决策
若近期业务不需要重计算/长耗时/RAG，可暂不建，但应在架构文档里显式标注"TS侧ai-gateway临时兼任Python Runtime职责"这一实况，避免文档设计与代码现实继续分裂。若决定要建，先补最小schema资产目录，作为TS/Python共享绑定源头。

### P2：建立最小可用Eval流程
不必照搬架构文档里全套11种信号，先针对已上线的Principal陪练线，把golden set雏形（`export-soul-golden-set.mjs`）落成可被CI消费的门槛（Unit+Golden两种信号），再逐步扩展到其他use case。

---

## 附：调查方法说明

本评估基于对以下路径的直接代码/测试核实（非文档自述）：`packages/ai-gateway/src/*`、`apps/api/src/modules/{family,principal,orchestration}/*`、`packages/family-model/src/index.ts`、`packages/principal-ai/src/index.ts`、`products/famili-principal/*`、`apps/mobile/server/{private-note-tags.ts,_core/llm.ts}`、`governance/FAMILY_AI_USE_CASE_REGISTRY_V1.yaml`、`architecture/FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md` 第18-20节。调查时主worktree存在另一会话的未提交WIP（orchestration模块、mobile UI-03/05/08/23/24等），本文档基于HEAD+该WIP混合可见状态，未验证WIP最终形态。
