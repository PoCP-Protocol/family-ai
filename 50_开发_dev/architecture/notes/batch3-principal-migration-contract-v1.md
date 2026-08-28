# Batch 3 迁移契约 V1 — Principal 域 Python 化 + Human Handoff 解耦

```text
DOC_KIND   = MIGRATION_CONTRACT (契约先行:实现前锁定的接口/结构/状态机规格,不是调研)
DATE       = 2026-08-29
SCOPE      = Batch 3 收窄范围 = Principal(真migration) + Human Handoff(从Principal解耦)
DEFERRED   = Agent Runtime / Conversation / Daily Coach —— 三者NestJS侧零代码,是greenfield新建,
             不属"迁移",留待单独立项(与FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md §8.4"多Agent排P3"一致)
GROUNDING  = batch3-principal-migration前置调研(本会话Explore产出)逐条核实的NestJS现状
STATUS     = CONTRACT_FROZEN_FOR_IMPLEMENTATION —— agent须严格按本文档实现,签名/结构不得各自发挥
```

## 0. 为什么先写这份契约(方法论)

Batch 2 曾因"先fan out 6个agent各自实现、没有先锁契约"产生四分叉返工(Consent Port四签名 / resolve_growth_subject三返回类型 / tenancy两签名),事后花 #58/#59/#64 一大串任务收拾。本文档是对该教训的直接修复:**Principal 域的 Python 侧接口、四层结构、安全门管线分解、handoff 状态机、Soul 加载契约,在派任何实现 agent 之前全部在此锁定**。实现 agent 只允许"按此填充实现",不允许重新设计签名或结构。

## 1. 范围边界(必须严格遵守)

**做**:
- `backend/domains/principal/` —— Principal 运行时(handleMessage 安全管线 + acceptProposal 桥接 + Soul 加载/编译)。
- `backend/domains/human_handoff/` —— 从 Principal 解耦出的独立域(handoff 状态机 OPEN→resolved→released)。

**不做(本 Batch 明确排除,greenfield,留待单独立项)**:
- Agent Runtime(`AgentDefinition`/`AgentRegistry`)—— NestJS 零代码。
- Conversation 编排域 —— NestJS 零代码。
- Daily Coach —— NestJS 零代码。
- `packages/harness`(CodexHarnessAdapter)的生产接线 —— 它是零消费者孤儿骨架;本 Batch **不**把它接进 Principal(接不接、怎么接是 Agent Runtime 立项时才决定的事)。

**忠实复刻原则**:Principal 迁移是 one-way domain takeover,必须 1:1 复刻 NestJS 的安全语义,包括所有 fail-closed 门。不得在迁移中顺手"改进"安全判定的松紧(除非另有 owner 明确授权,如 Batch 2 的 tenancy 收紧是单独授权的)。

## 2. Python 侧四层结构(锁定)

严格沿用 `backend/domains/assessment/` 与 Batch 2 六域的既定四层模式:

```
backend/domains/principal/
  domain/
    entities.py          # PrincipalMessage, PrincipalResponse, ActionProposal, ModelRun
    value_objects.py     # RiskRoute(NORMAL/REVIEW/HIGH_RISK), DeliveryMode(LEGACY/ORCHESTRATION_AI_COACH),
                         #   RuntimeProfile(internal/internal_livecheck/model_first_internal),
                         #   BRIDGEABLE_INTERVENTIONS={"LISTEN_BEFORE_RESPOND":"LISTEN_BEFORE_RESPOND"}(单值,复刻)
    soul.py              # PrincipalSoulProfile(Pydantic), soul_hash 计算(FNV-1a变体,复刻stableHash)
    policies.py          # 纯函数安全门:parent_verbal_escalation_review / imminent_self_loss_of_control_review
                         #   (关键词+主语判定,复刻确定性升级护栏;NORMAL→REVIEW只升不降)
    errors.py            # PrincipalForbiddenError/ConflictError/NotFoundError/ValidationError
  application/
    ports.py             # PrincipalRepositoryPort / AiGatewayPort / QualityJudgePort / SoulLoaderPort /
                         #   InterventionBridgePort(桥到Intervention域) / HumanHandoffPort(桥到human_handoff域)
    commands.py          # PrincipalCommandHandler.handle_message / accept_proposal
  infrastructure/
    fake_repository.py
    sqlalchemy_repository.py   # 复用现有 principal_* 表(principal_messages/responses/proposals/model_runs)
    soul_loader.py       # ★ 按 YAML 来源实现(见 §5),不复刻硬编码常量
    fake_ai_gateway.py / deterministic_response.py  # gateway 未配置时的确定性回退(复刻)
  api/
    routes.py            # POST /principal/messages, POST /principal/proposals/{id}/accept
  tests/
    test_principal_flow.py                 # Fake-based 单测
    test_sqlalchemy_repository_integration.py  # 真实PG(env-gated skip),验证锚点

backend/domains/human_handoff/
  domain/        entities.py(HumanHandoff), value_objects.py(HandoffStatus OPEN/RESOLVED,
                 HandoffResolution APPROVED/其他, HandoffReason quota/model_error/high_risk/review),
                 state_machine.py(OPEN→resolved→released, 幂等释放), errors.py
  application/   ports.py(HumanHandoffRepositoryPort), commands.py(open/resolve/release)
  infrastructure/ fake_repository.py, sqlalchemy_repository.py(复用 principal_human_handoffs 表)
  api/           routes.py(POST /handoffs/{id}/resolve)
  tests/         test_handoff_flow.py, test_sqlalchemy_repository_integration.py
```

**四层规则(不得违反)**:domain 层不 import FastAPI/SQLAlchemy;跨域只走 Port(Principal 依赖 Intervention/HumanHandoff 都通过 application/ports.py 定义的 Protocol,不直接 import 对方 repository);tenant_id 贯穿(复刻 assessment 域已有的 `assert_tenant_family_scope` 四参数模式)。

## 3. handleMessage 安全管线分解(18步,锁定为 handler 内顺序执行)

复刻 `principal.service.ts::handleMessage` 的完整链路。**每一步都是 fail-closed 门,失败一律建 handoff + 短路,绝不 500、绝不返原始模型文本**。实现 agent 按此顺序,不得调换/省略:

1. 落用户消息 + 记 `principal_question_submitted` 事件
2. Consent 门(`resolve_principal_consent` —— 是否允许读家庭上下文)
3. Runtime Profile 门(env `FPAI_RUNTIME_PROFILE`:internal 默认不外呼;图片始终隔离)
4. Provider Policy 门(env `FPAI_PROVIDER_POLICY_RUNTIME`)
5. Processing 门(综合 consent+policy+provider → `will_call_external`)
6. 图片隔离(任何图片不外发,只记 `principal_image_quarantined`)
7. 每日配额门(env `FPAI_PRINCIPAL_DAILY_CAP`;仅约束真实外呼;超额→建 handoff(reason=quota)短路)
8. 组装 PrincipalAiInput(仅 consent 允许时注入 family_context 最小 allowlist 切片)
9. 调 `run_principal_text_mvp`(单轮 structured 调用,无 tool use;precheck→gateway→postcheck→schema校验→禁语黑名单;失败→fail-closed回退文案降REVIEW)
10. 落 model_run 溯源 + grounding 证据事件
11. 配额 80% 阈值告警
12. HIGH_RISK 路由:不展示不建proposal,直接 handoff(reason=high_risk)短路
13. W2R-104 质量闸(`assess_response_quality`,生成式judge+确定性底座回退;不过仅在原NORMAL时降REVIEW,只降不升)
14. 确定性 REVIEW 升级护栏(parent_verbal_escalation / imminent_self_loss_of_control 纯函数关键词判定;命中→NORMAL强制升REVIEW)
15. 落响应
16. REVIEW 路由:响应存但扣留,挂 handoff(reason=review),`human_handoff=true`
17. NORMAL 路由(仅 LEGACY delivery):有 one_small_action → 建 ActionProposal(type=RECOMMEND_INTERVENTION, recommended_intervention_id="LISTEN_BEFORE_RESPOND" 硬编码单值)
18. ORCHESTRATION_AI_COACH delivery:复用同管线,不建legacy proposal,只多记事件

**关键不变量(对偶)**:自动化只能 NORMAL→降→REVIEW;只有人工 APPROVED 才能把 REVIEW 的响应放出(release)。这条对偶必须在 Principal(降级侧)和 human_handoff(释放侧)两个域各自的代码里都成立。

## 4. acceptProposal 桥接契约(锁定)

复刻 `acceptProposal`:加载proposal→校验family_id匹配(不匹配返回None→404)→status!=PROPOSED→Conflict→risk_route!=NORMAL→Forbidden(纵深防御)→查 BRIDGEABLE_INTERVENTIONS 白名单(仅 LISTEN_BEFORE_RESPOND,找不到→Conflict "intervention_not_bridgeable")→经 `InterventionBridgePort` 调 Intervention 域的 start_intervention(Named Action,内部重新校验 family/权限/priority/consent/safety/幂等,桥接不绕任何门)→标记 ACCEPTED + 记溯源。

**InterventionBridgePort** 是 Principal→Intervention 的跨域 Port(Protocol),真实实现是一个 adapter 委托 Batch 2 已完成的 intervention 域 `InterventionCommandHandler.start`(复刻 Batch 2 建立的 adapter 接线模式,如 GrowthPriorityAdapter)。

## 5. Soul 加载契约(★ 锁定为 YAML 来源,不复刻硬编码)

调研确认:NestJS 侧 `PrincipalSoulLoader.load()` 当前(未合并 wt-soul 时)是**硬编码常量**;修复(f6a36d2,读 `products/famili-principal/soul/` 下6个YAML为唯一权威来源)卡在 `wt-soul` 分支未合并。

**Python 侧迁移直接采用 YAML 来源契约,不复刻硬编码漂移**:
- `SoulLoaderPort.load() -> PrincipalSoulProfile`,真实实现 `soul_loader.py` 解析 `products/famili-principal/soul/` 下的6个YAML(persona/values/action-policy/language-style/relationship-policy/thinking-policy)。
- 加 `assert_principal_soul_shape()` fail-closed 结构校验(YAML被改坏时降级到一个 fixture 常量并报错,不静默读到不完整数据)—— 复刻 wt-soul 的 assertPrincipalSoulShape 意图。
- `PrincipalSoulProfile` 是 Pydantic model;`soul_hash` 复刻 FNV-1a 变体 stableHash(仅溯源标识,非加密)。
- 这样 Python 侧从第一天就没有"硬编码 vs YAML"的双份人格漂移问题——是对 TS 侧那个技术债的"迁移即修复"。

## 6. 检索契约(锁定:关键词匹配,不做向量)

复刻现状:`retrieve_principal_assets` → `detect_scenario`(固定中文关键词子串匹配)→ 从硬编码的 REVIEWED_METHOD_CARDS/REVIEWED_KNOWLEDGE_CARDS 常量按 scenario 过滤+截断。**不引入 embedding/向量库**——这与 P0 阶段 Family Context 只做"时间倒序取最近N条"的克制一致;向量检索是后续独立能力,不在 Principal 迁移范围。

## 7. 实现批次与派发计划(时间盒 agent 舰队)

按契约锁定后,分**两个可独立并行的实现单元**派发(它们表结构不重叠、Port 边界清晰,不会四分叉):

- **单元A:human_handoff 域**(先做,因 Principal 依赖它)—— 状态机相对独立,体量小。
- **单元B:principal 域**(依赖 A 的 HumanHandoffPort + Batch2 的 InterventionBridgePort)—— 体量大,是重点。

每个实现 agent 强制:①独立 worktree;②**增量 commit**(每写完一层就 commit,避免 stall 丢进度——Batch 2 Family域二次收尾验证过这个有效);③时间盒;④按本契约的签名/结构实现,不重新设计;⑤Fake 单测 + env-gated 真实PG集成测试骨架;⑥完成后报告完成度,不夸大(NotImplementedError 的部分如实标注)。

## 8. 前置依赖 / 待 owner 确认项

1. **分支基线**:Batch 2 成果在 `batch2-integration-p0-001`(未合并main);Principal 迁移应基于哪个基线?建议基于 batch2-integration(能复用其 InterventionBridgePort 接线模式与四层脚手架),但这会继续堆叠未合并工作 —— 待确认。
2. **principal_* 表现状**:调研确认 NestJS 侧有真实表(principal_messages/responses/proposals/model_runs/human_handoffs),Python 侧 sqlalchemy_repository 复用这些既有表(不新建),复刻 assessment 域"PYTHON_READY 阶段只读既有schema、cutover 才改 migration owner"的约定。
3. **greenfield 三项(Agent Runtime/Conversation/Daily Coach)确认暂缓** —— 已在 §1 记录,若 owner 后续要启动需单独立项+概念方案评审(它们是新业务设计,不是迁移)。
