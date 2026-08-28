"""Application service commands — the acceptance-chain creation path
(Override #6 item 2): each `create_*` command loads its parent, so the
chain is provably traceable back to a `MarketSignal`, not just
independently-created rows that happen to share ids.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from ..domain.entities import (
    CustomerInsight,
    GrowthHypothesis,
    GrowthProblem,
    GrowthStrategy,
    MarketSignal,
    Opportunity,
    ProductConcept,
)
from .ports import ProductIntelligenceRepositoryPort


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


async def create_market_signal(
    repo: ProductIntelligenceRepositoryPort, *, raw_text: str, created_by: str, tenant_scope: str, source_ref: str | None = None
) -> MarketSignal:
    now = datetime.utcnow()
    signal = MarketSignal(
        id=_new_id("signal"), created_at=now, updated_at=now, created_by=created_by,
        tenant_scope=tenant_scope, raw_text=raw_text, source_ref=source_ref,
    )
    await repo.save_market_signal(signal)
    return signal


async def create_customer_insight(
    repo: ProductIntelligenceRepositoryPort, *, signal_id: str, statement: str, created_by: str, tenant_scope: str,
    generated_by: str | None = None, model_ref: str | None = None, confidence: float | None = None,
) -> CustomerInsight:
    await repo.load_market_signal(signal_id)  # traceability: parent must exist
    now = datetime.utcnow()
    insight = CustomerInsight(
        id=_new_id("insight"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        statement=statement, signal_id=signal_id, generated_by=generated_by, model_ref=model_ref, confidence=confidence,
    )
    await repo.save_customer_insight(insight)
    return insight


async def create_opportunity(
    repo: ProductIntelligenceRepositoryPort, *, insight_id: str, statement: str, created_by: str, tenant_scope: str,
    generated_by: str | None = None, model_ref: str | None = None, confidence: float | None = None,
) -> Opportunity:
    await repo.load_customer_insight(insight_id)
    now = datetime.utcnow()
    opportunity = Opportunity(
        id=_new_id("opp"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        insight_id=insight_id, statement=statement, generated_by=generated_by, model_ref=model_ref, confidence=confidence,
    )
    await repo.save_opportunity(opportunity)
    return opportunity


async def create_growth_problem(
    repo: ProductIntelligenceRepositoryPort, *, opportunity_id: str, symptom: str, created_by: str, tenant_scope: str,
) -> GrowthProblem:
    await repo.load_opportunity(opportunity_id)
    now = datetime.utcnow()
    problem = GrowthProblem(
        id=_new_id("problem"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        symptom=symptom, opportunity_id=opportunity_id,
    )
    await repo.save_growth_problem(problem)
    return problem


async def create_growth_hypothesis(
    repo: ProductIntelligenceRepositoryPort, *, problem_id: str, statement: str, created_by: str, tenant_scope: str,
    generated_by: str | None = None, model_ref: str | None = None, confidence: float | None = None,
) -> GrowthHypothesis:
    await repo.load_growth_problem(problem_id)
    now = datetime.utcnow()
    # Rule (Override #6 item 3 / instruction 03 rule 4): status is always
    # DRAFT at creation regardless of `generated_by` — no path here sets
    # VALIDATED. Only `GrowthHypothesis.mark_validated()` can, and only a
    # separate, explicit application-service call should invoke it.
    hypothesis = GrowthHypothesis(
        id=_new_id("hyp"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        problem_id=problem_id, statement=statement, generated_by=generated_by, model_ref=model_ref, confidence=confidence,
    )
    await repo.save_growth_hypothesis(hypothesis)
    return hypothesis


async def create_growth_strategy(
    repo: ProductIntelligenceRepositoryPort, *, problem_id: str, hypothesis_ids: list[str], statement: str,
    created_by: str, tenant_scope: str, generated_by: str | None = None, model_ref: str | None = None,
    confidence: float | None = None,
) -> GrowthStrategy:
    await repo.load_growth_problem(problem_id)
    for hid in hypothesis_ids:
        await repo.load_growth_hypothesis(hid)  # traceability: every referenced hypothesis must exist
    now = datetime.utcnow()
    strategy = GrowthStrategy(
        id=_new_id("strategy"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        problem_id=problem_id, hypothesis_ids=hypothesis_ids, statement=statement,
        generated_by=generated_by, model_ref=model_ref, confidence=confidence,
    )
    await repo.save_growth_strategy(strategy)
    return strategy


async def create_product_concept(
    repo: ProductIntelligenceRepositoryPort, *, strategy_id: str, title: str, created_by: str, tenant_scope: str,
    description: str | None = None, generated_by: str | None = None, model_ref: str | None = None,
    confidence: float | None = None,
) -> ProductConcept:
    await repo.load_growth_strategy(strategy_id)
    now = datetime.utcnow()
    concept = ProductConcept(
        id=_new_id("concept"), created_at=now, updated_at=now, created_by=created_by, tenant_scope=tenant_scope,
        strategy_id=strategy_id, title=title, description=description,
        generated_by=generated_by, model_ref=model_ref, confidence=confidence,
    )
    await repo.save_product_concept(concept)
    return concept


async def validate_growth_hypothesis(
    repo: ProductIntelligenceRepositoryPort, *, hypothesis_id: str, human_actor: str,
) -> GrowthHypothesis:
    """The only path in this domain that can move a hypothesis to
    VALIDATED — requires an explicit human actor, per
    `GrowthHypothesis.mark_validated`.
    """
    hypothesis = await repo.load_growth_hypothesis(hypothesis_id)
    validated = hypothesis.mark_validated(human_actor)
    await repo.save_growth_hypothesis(validated)
    return validated
