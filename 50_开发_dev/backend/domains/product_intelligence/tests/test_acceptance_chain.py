"""Verifies the PR-001 acceptance criterion (Override #6 item 2 / project
owner instruction 01): a full Signal -> Insight -> Opportunity ->
GrowthProblem -> GrowthHypothesis -> GrowthStrategy -> ProductConcept chain
can be created and traced back end-to-end. Parametrized over both
repositories (Fake dict + SQLite-backed SQLAlchemy) so the test proves the
application layer, not just one implementation.
"""
from __future__ import annotations

import pytest

from ..application import commands, queries


async def _build_chain(repo):
    signal = await commands.create_market_signal(
        repo, raw_text="家长普遍反映每天辅导作业太累", created_by="researcher-1", tenant_scope="tenant-1",
    )
    insight = await commands.create_customer_insight(
        repo, signal_id=signal.id, statement="小学高年级家长群体存在学习管理退出困难",
        created_by="ai:market.insight.generate", tenant_scope="tenant-1", generated_by="ai:market.insight.generate",
        model_ref="claude-sonnet-4-6", confidence=0.7,
    )
    opportunity = await commands.create_opportunity(
        repo, insight_id=insight.id, statement="学习责任转移计划",
        created_by="ai:opportunity.propose", tenant_scope="tenant-1", generated_by="ai:opportunity.propose",
    )
    problem = await commands.create_growth_problem(
        repo, opportunity_id=opportunity.id, symptom="孩子写作业拖延", created_by="pm-1", tenant_scope="tenant-1",
    )
    hypothesis = await commands.create_growth_hypothesis(
        repo, problem_id=problem.id, statement="家长控制增加导致孩子自主感下降",
        created_by="ai:growth.hypothesis.generate", tenant_scope="tenant-1",
        generated_by="ai:growth.hypothesis.generate", confidence=0.6,
    )
    strategy = await commands.create_growth_strategy(
        repo, problem_id=problem.id, hypothesis_ids=[hypothesis.id], statement="先完成学习责任逐步转移",
        created_by="pm-1", tenant_scope="tenant-1",
    )
    concept = await commands.create_product_concept(
        repo, strategy_id=strategy.id, title="学习自主21天计划", created_by="pm-1", tenant_scope="tenant-1",
    )
    return signal, insight, opportunity, problem, hypothesis, strategy, concept


@pytest.mark.asyncio
async def test_full_chain_fake_repository(fake_repo):
    signal, insight, opportunity, problem, hypothesis, strategy, concept = await _build_chain(fake_repo)

    chain = await queries.get_product_concept_chain(fake_repo, product_concept_id=concept.id)

    assert chain["product_concept"].id == concept.id
    assert chain["growth_strategy"].id == strategy.id
    assert chain["growth_problem"].id == problem.id
    assert [h.id for h in chain["growth_hypotheses"]] == [hypothesis.id]
    assert chain["opportunity"].id == opportunity.id
    assert chain["customer_insight"].id == insight.id
    assert chain["market_signal"].id == signal.id


@pytest.mark.asyncio
async def test_full_chain_sqlalchemy_repository(sqlalchemy_repo):
    signal, insight, opportunity, problem, hypothesis, strategy, concept = await _build_chain(sqlalchemy_repo)

    chain = await queries.get_product_concept_chain(sqlalchemy_repo, product_concept_id=concept.id)

    assert chain["market_signal"].id == signal.id
    assert chain["market_signal"].raw_text == signal.raw_text
    assert chain["growth_hypotheses"][0].generated_by == "ai:growth.hypothesis.generate"


@pytest.mark.asyncio
async def test_growth_strategy_requires_at_least_one_hypothesis(fake_repo):
    from ..domain.errors import ProductIntelligenceValidationError

    signal, insight, opportunity, problem, *_ = await _build_chain(fake_repo)
    with pytest.raises(ProductIntelligenceValidationError):
        await commands.create_growth_strategy(
            fake_repo, problem_id=problem.id, hypothesis_ids=[], statement="empty strategy should be rejected",
            created_by="pm-1", tenant_scope="tenant-1",
        )
