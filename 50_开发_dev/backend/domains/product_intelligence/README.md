# product_intelligence — PR-001, real (not skeleton)

状态 = 真实实现,非 `STRUCTURE_ONLY`。授权记录见 `CURRENT_SPRINT.md` Override #6。

- 已实现:`MarketSignal → CustomerInsight → Opportunity → GrowthProblem → GrowthHypothesis → GrowthStrategy → ProductConcept`
  全链路真实创建 + 可追溯查询,真实 SQLAlchemy 模型 + 原生 SQL migration(`0058_product_intelligence_domain.sql`),
  真实 FastAPI 路由(`api/routes.py`),Fake + SQLite-backed 双重测试全绿(6/6)。
- 护栏:AI 生成的 `GrowthHypothesis` 恒为 `DRAFT`,仅 `mark_validated()`(要求非 `ai:` 前缀的 human_actor)可转 `VALIDATED`;
  `GrowthStrategy` 构造时强制要求至少一个 `hypothesis_id`。两条规则均有 pytest 覆盖,且经真实 API 调用验证。
- 未实现(留给后续指令,不在本 PR 范围):Component/Pattern/FPDL/Compiler 真实逻辑、AI Use Case Registry、Simulation Runner、
  真实 Postgres 集成测试(当前用 SQLite 内存引擎代替,与 Batch 2 已知缺口同级)、任何 app 挂载(`routes.py` 尚未被任何
  FastAPI app 实例 include,因为 `apps/family_api` 还不存在)。
