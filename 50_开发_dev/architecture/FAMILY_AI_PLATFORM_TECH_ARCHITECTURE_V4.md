> **EXECUTION NOTICE** — `SUPERSEDED_FOR_EXECUTION_BY = FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md + FAMILY_CONSUMER_UI_BASELINE_V1.json`. This file remains historical architecture context; UI-35 is deleted and this file must not be used as current execution SSOT.

# FAMILY AI PLATFORM — TECH ARCHITECTURE V4.0

```text
DOC_KIND       = GOVERNANCE_SSOT / TECHNICAL_ARCHITECTURE_FREEZE
RULING_ID      = FAMILY-legacy UI-FULLSTACK-REBASELINE-001 / G0
AUTHORIZED_BY  = Family Chief Architect (owner ruling)
DATE           = 2026-08-22
BASE_REPO      = PoCP-Protocol/family-ai
BASE_BRANCH    = main
BASE_SHA       = 708cf542ab130642f2248bbebecc997930d10a49
SUPERSEDES     = V3.2 的技术判断(不推翻,升级为 AI-native)
STATUS         = FROZEN (最高技术架构;G1/G2 编码须以本文件为施工依据)
RELATION       = 历史上与 reports/legacy-legacy UI/FAMILY_LEGACY_UI_FULLSTACK_ARCHITECTURE_V1.md 并列。
                 当前执行口径以 V4.1 + governance/FAMILY_CONSUMER_UI_BASELINE_V1.json 为准。
```

> 本文件冻结一版能支撑 5–10 年演进的目标技术架构。核心不是"选了哪些技术",而是**确立稳定边界**:
> 以后可以换模型、换云、换向量引擎、拆服务、扩用户量,但**不再重做 Family 核心架构**。

---

## 一、稳定边界(本架构的真正价值)

```text
业务真相 (Truth)        = 永远属于 Family Business Platform (NestJS + PostgreSQL)
智能能力 (Intelligence) = 永远属于可替换的 AI Runtime (Python)
Skill / Context         = Family 自有资产,不绑定任何厂商
Model / Cloud / Vector / Deploy = 全部可替换的实现细节
```

一旦这条边界冻结:Python AI 栈整体替换、模型厂商更换、部署平台迁移,**都不冲击业务核心**。

---

## 二、四个 Plane(所有架构讨论必须落在这四层内)

```text
EXPERIENCE PLANE      Mobile(RN+Expo) · Consumer Web(Next.js) · Ops/Advisor Web(Next.js) · historical UI-01..UI-35; current UI-01..UI-34
        ▼
BUSINESS / TRUTH PLANE   NestJS + TypeScript
        · Family Core · Growth Intelligence · Growth Journey · Resource&Commerce
        · Service OS · Content&Community · Family Context
        · Named Action · Auth · Consent · Audit   (canonical write 只在此层)
        ▼
   ┌──────────────────────────┬──────────────────────────┐
AI INTELLIGENCE PLANE(Python)   DATA / KNOWLEDGE PLANE
   Agent/Skill Runtime · Diagnosis   PostgreSQL18 · pgvector · Redis
   Retrieval/Rerank/Embedding        Object Store · Events · AI Runs
   Multimodal · Eval · Model Gateway Datasets · Evidence · Analytics
        └──────────────────────────┴──────────────────────────┘
        ▼
TRUST / CONTROL PLANE
   Identity · Consent · Policy · Safety · Human Gate
   Skill Version · Model Policy · Eval · Audit · OpenTelemetry · Cost
```

---

## 三、正式技术选型(冻结,停止反复讨论)

| 层 | V4.0 选择 | 备注 |
|---|---|---|
| Mobile | React Native + Expo + TS | 现状保留;剥离其自带后端 |
| Consumer Web | Next.js + TS | 现 web 轻量,后续正式化 |
| Ops / Advisor Web | Next.js + TS | AI 平台运营台(Review/Human Gate/Skill/Model/Eval) |
| Business API | **NestJS + TS** | 现有,KEEP,不改 FastAPI |
| Domain Runtime | TypeScript | 业务真相唯一归属 |
| AI Runtime | **Python** | 新增 `apps/ai-runtime/` |
| AI Worker / Pipeline | **Python** | 新增 `apps/ai-worker/` |
| Canonical DB | **PostgreSQL 18** | 现 16→18 迁移成本此刻最低 |
| Semantic Memory | **pgvector** | 不引入独立向量库 |
| Cache / ephemeral | Redis | 绝不做业务真相 |
| Durable Workflow | **Temporal** | 管流程,不管事实 |
| Domain Event | **PostgreSQL Outbox** | 规模大后可接 NATS/Kafka,domain 不改 |
| Object / multimodal | S3-compatible | 图/音/视/PDF/dataset/artifact |
| AI Data Lake | Object Store + Parquet | 先 S3+Parquet,后 Iceberg/DuckDB/Spark |
| API contract | OpenAPI + JSON Schema | 唯一 contract 源,生成 TS/Python/Client |
| Streaming | SSE | 双向实时再上 WebSocket/WebRTC |
| Model Access | Family Model Gateway | 唯一模型入口 |
| Skill | Family Skill Registry | 平台一等公民,强制 version |
| Agent | Family Agent Runtime | 编排者,非状态所有者 |
| Memory | Family Context Service | Working/Episodic/Semantic/Evidence 四类 |
| Observability | OpenTelemetry | trace/metrics/logs 业务+AI 统一 |
| AI Eval | Family Eval Platform | 强制 CI 门 |
| Secrets | Cloud Secrets Manager / KMS | 高敏字段 app 级加密 |
| Packaging | OCI/Docker | 全服务容器化 |
| IaC | Terraform / OpenTofu | — |
| CI/CD | GitHub Actions | — |
| MongoDB | **NO** | — |
| Kafka | 暂不引入 | — |
| Kubernetes | 非应用架构依赖 | 部署平台,可后置 |
| 独立 Vector DB | 暂不 | pgvector 足够 |
| Mobile MySQL | **RETIRE**(G1) | 见第八节 |
| Mobile 直连 LLM | **FORBIDDEN** | CI FAIL |

---

## 四、语言边界:TypeScript 与 Python 不是二选一

**TypeScript 拥有"业务世界"**(NestJS + PostgreSQL 管理):
`Family / Person / Relationship / Consent / AssessmentSession / GrowthIntent / Program / GrowthAction / ResourceOffer / Decision / ServiceCase / Membership / Entitlement / Community / Audit`。

**Python 拥有"智能世界"**(`apps/ai-runtime` / `apps/ai-worker`):
`AI诊断 / Assessment intelligence / Embedding / RAG / Rerank / Context compression / Knowledge / Multimodal / Skill execution / Agent reasoning / Eval / Dataset / Fine-tuning prep / Future ML`。

**永久不变式**:
```text
AI Runtime != Canonical Business Backend
Python 不得直接 UPDATE GrowthIntent / 完成 ServiceCase / 改 Entitlement / 写 Child Fact
Python 只返回 Hypothesis / Draft / Recommendation / Interpretation / Proposal
真正动作回到 NestJS Named Action → PostgreSQL
```

---

## 五、AI 调用链(永久冻结,唯一合法路径)

```text
Mobile/Web → NestJS API → Identity → Family Authorization → Consent
  → AI Use-Case Policy → Context Service → Skill Resolver
  → AI Runtime → Family Model Gateway → Model
  → Structured Output → Validator/Safety → AI Run Audit
  → Draft/Hypothesis → Family/Human Confirmation → Named Action → PostgreSQL
```

`Mobile → OpenAI/Claude/DeepSeek/Manus` 等一律 **CI FAIL**(当前校验器 `validate:consumer-ui:strict` 检测 `MOBILE_DIRECT_MODEL_PROVIDER`)。

---

## 六、Family Model Gateway = Model Control Plane

不再只是 LLM HTTP Adapter,升级为:Provider/Model Registry · Model/Use-case Routing · Structured Output/Streaming/Multimodal · Embedding/Rerank · Timeout/Retry/Fallback · Token/Cost Budget/Rate Limit · Safety/Data Classification/Region Policy · Model/Prompt/Skill Version · Trace/Audit/Eval。

核心:**Family 不依赖任何模型厂商**。GPT/Claude/Gemini/DeepSeek/Qwen/本地 7B 皆为 Provider。

---

## 七、Skill / Agent / Workflow 边界

**Skill(平台护城河,非 Prompt)** 至少含:`skill_id, version, domain, use_case, age_scope, input_schema, output_schema, professional_method, evidence_refs, system_instruction, workflow, allowed_tools, model_policy, consent_policy, safety_policy, eval_suite, quality_threshold, release_status`。链路:专家知识→Skill→Eval→发布→Agent 调用→服务反馈→Skill 升级。

**Agent = Process Coordinator**:无 canonical 状态所有权;无直接 DB 写;工具=Named Action/Read Projection;结果=proposal/draft/hypothesis;长流程状态=Workflow+PostgreSQL。→ Agent 框架(自研/LangGraph/PydanticAI/OpenAI SDK)可换,业务架构不改。

**Temporal = Durable Workflow**:管时间/等待/恢复/Retry(21天营/90天/评估/预约/回访/暂停恢复/人机协同);**Temporal 管流程,PostgreSQL 管事实**。**Outbox 保留**:事务内写业务数据 + Outbox 事件 → Worker/Workflow/Analytics。

---

## 八、Memory / Data / Graph

**AI Memory 四类**(非"聊天历史"):Working(会话临时) / Episodic(家庭事件) / Semantic(长期稳定知识) / Evidence(判断原始证据)。Context Service 决定"本次 AI 该看什么/不能看什么/已过期/仅 Perspective/是 Hypothesis/已 Supersede"。

**数据库四层**:PostgreSQL18(唯一 canonical truth) · pgvector(语义层) · Redis(cache/lock/ratelimit,非真相) · S3(对象/多模态/artifact)。**数据湖预留**:Operational → Outbox/CDC → AI Data Lake(Parquet/S3) → Dataset/Eval/Analytics/Training。**Graph 能力先用 PostgreSQL nodes+relations+materialized projection**,经 `GraphProjectionPort` 预留未来专用引擎,不引入 Neo4j。

---

## 九、跨语言 Contract / Observability / Eval / Security

- **Contract**:唯一源 OpenAPI + JSON Schema → 生成 TS SDK / Python Pydantic / Mobile Client / Ops Client。**禁止双方手写 DTO**(防漂移)。
- **Observability**:一个用户动作贯穿单一 `trace_id`(Mobile→NestJS→DB→Context→Skill→AI Runtime→Model→Validator→Workflow→Named Action);AI Trace 额外记 `model/model_version/skill_version/prompt_version/tokens/cost/latency/context_refs/retrieval_refs/safety/human_review/helpfulness`。
- **Eval**:每个 Skill 发布须过 Unit/Golden/Safety/Regression/Model 对比/Prompt 对比/Human Judge/Model Judge/Latency/Cost;升级现有 model-judge 与 runtime-faithful eval 资产。
- **Security 三层分离**:`Authentication != Family Authorization != Consent`。DB 携 `family_id scope/person scope/visibility/consent_scope/purpose/retention/provenance`。AI 调用前:Data Classification → Minimum Context → Consent Check → Provider Policy → Region Policy → Send;高敏字段 app 级加密 + KMS。

---

## 十、永久禁止(机器可读,校验器/CI 逐步落地)

```text
NO_SECOND_BUSINESS_BACKEND
NO_SECOND_IDENTITY_SYSTEM
NO_SECOND_CANONICAL_DB
NO_CLIENT_DIRECT_MODEL_CALL
NO_AGENT_DIRECT_DATABASE_WRITE
NO_SKILL_WITHOUT_VERSION
NO_AI_WITHOUT_TRACE
NO_AI_WITHOUT_EVAL
NO_PRODUCTION_AI_WITHOUT_CONSENT_POLICY
NO_UI_CAPABILITY_WITHOUT_BACKEND_OWNER
NO_DOCUMENT_STATUS_ABOVE_RUNTIME_TRUTH
NO_VENDOR_MODEL_AS_ARCHITECTURE
```

---

## 十一、正式技术裁决(机器可读)

```text
FAMILY_AI_PLATFORM_V4
ARCHITECTURE_STYLE      = MODULAR_PLATFORM + DURABLE_WORKFLOW + AI_RUNTIME + EVENT_DRIVEN_EVOLUTION
FRONTEND_LANGUAGE       = TYPESCRIPT
MOBILE                  = REACT_NATIVE + EXPO
WEB                     = NEXTJS
BUSINESS_LANGUAGE       = TYPESCRIPT
BUSINESS_RUNTIME        = NESTJS
AI_LANGUAGE             = PYTHON
AI_RUNTIME              = INDEPENDENT_CAPABILITY_RUNTIME
CANONICAL_DATABASE      = POSTGRESQL_18
VECTOR                  = PGVECTOR
CACHE                   = REDIS
DURABLE_WORKFLOW        = TEMPORAL
DOMAIN_EVENT            = POSTGRES_OUTBOX
OBJECT_STORAGE          = S3_COMPATIBLE
AI_DATA_LAKE            = OBJECT_STORAGE + PARQUET
MODEL_CONTROL_PLANE     = FAMILY_MODEL_GATEWAY
PROFESSIONAL_CAPABILITY = FAMILY_SKILL_PLATFORM
AGENT                   = ORCHESTRATOR_NOT_STATE_OWNER
MEMORY                  = FAMILY_CONTEXT_SERVICE
OBSERVABILITY           = OPENTELEMETRY
AI_EVAL                 = MANDATORY_PLATFORM_CAPABILITY
API                     = REST + OPENAPI
CONTRACT                = OPENAPI + JSON_SCHEMA
STREAMING               = SSE
REALTIME                = WEBSOCKET / WEBRTC_WHEN_NEEDED
MICROSERVICE_FIRST      = NO
KAFKA_FIRST             = NO
KUBERNETES_DEPENDENCY   = NO
INDEPENDENT_VECTOR_DB   = NO_FOR_NOW
MOBILE_MYSQL            = REMOVE
MOBILE_SERVER_BACKEND   = REMOVE
CLIENT_DIRECT_LLM       = FORBIDDEN
```

---

## 十二、与 G0 的关系 / 现状差距(诚实声明)

- 本文件是**目标态冻结**,不代表现状已实现。现状(base 708cf542)与目标差距:
  - Temporal / pgvector / OpenTelemetry / AI Data Lake / Python `apps/ai-runtime` / OpenAPI→Python 生成:**尚未落地**,属 G1+ 工程。
  - Mobile 第二后端(Express/tRPC/Drizzle/MySQL/forge.manus 直连):**存在**,G0 封锁盘点、G1 迁移移除(见 `reports/legacy-legacy UI/MOBILE_SECOND_CONTROL_PLANE_INVENTORY_001.md`)。
  - PostgreSQL 现为 16,升级 18 属 G1 基础设施任务。
- G0 只冻结**架构与边界**,不做业务运行时改造、不删除 Mobile 运行时、不改 DB schema。
- 演进规则:换模型/云/向量/部署/Agent 框架 = 允许且不改核心;新增第二业务后端/第二身份库/第二 canonical DB/客户端直连模型 = 永久禁止。
```
