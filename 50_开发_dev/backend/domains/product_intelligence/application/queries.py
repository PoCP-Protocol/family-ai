"""Chain-traversal query — satisfies the PR-001 acceptance criterion
("每一步均可追溯前一对象" / instruction 03's `strategy-map` shape) by walking
the acceptance chain backward from a `ProductConcept` to its `MarketSignal`.
"""
from __future__ import annotations

from .ports import ProductIntelligenceRepositoryPort


async def get_product_concept_chain(repo: ProductIntelligenceRepositoryPort, *, product_concept_id: str) -> dict:
    concept = await repo.load_product_concept(product_concept_id)
    strategy = await repo.load_growth_strategy(concept.strategy_id)
    problem = await repo.load_growth_problem(strategy.problem_id)
    hypotheses = [await repo.load_growth_hypothesis(h) for h in strategy.hypothesis_ids]
    opportunity = await repo.load_opportunity(problem.opportunity_id) if problem.opportunity_id else None
    insight = await repo.load_customer_insight(opportunity.insight_id) if opportunity else None
    signal = await repo.load_market_signal(insight.signal_id) if insight and insight.signal_id else None
    return {
        "product_concept": concept,
        "growth_strategy": strategy,
        "growth_problem": problem,
        "growth_hypotheses": hypotheses,
        "opportunity": opportunity,
        "customer_insight": insight,
        "market_signal": signal,
    }
