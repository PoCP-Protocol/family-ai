"""Real SQLAlchemy repository — async session-based, implements
`ProductIntelligenceRepositoryPort`. No real-Postgres integration test in
this PR (Override #6 item 4); tests run this same repository against an
in-memory SQLite engine via `tests/conftest.py`.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.entities import (
    ContradictionModel,
    CustomerInsight,
    CustomerSegment,
    Evidence,
    GrowthHypothesis,
    GrowthProblem,
    GrowthStrategy,
    MarketSignal,
    MarketTrend,
    Opportunity,
    ProductComponent,
    ProductConcept,
    ProductDefinition,
    ProductPattern,
    ProductZoneAssessment,
    ServiceBlueprintVersion,
    SignalCluster,
    UnmetNeed,
)
from ..domain.errors import ProductIntelligenceNotFoundError
from . import sqlalchemy_models as m


class SqlAlchemyProductIntelligenceRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    # -- MarketSignal --
    async def save_market_signal(self, entity: MarketSignal) -> None:
        row = m.MarketSignalRow(**entity.model_dump())
        await self._session.merge(row)
        await self._session.commit()

    async def load_market_signal(self, entity_id: str) -> MarketSignal:
        row = await self._session.get(m.MarketSignalRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("market_signal_not_found")
        return MarketSignal(**_row_to_dict(row))

    # -- supporting objects (create/save only, per Override #6 item 2) --
    async def save_signal_cluster(self, entity: SignalCluster) -> None:
        await self._merge(m.SignalClusterRow(**entity.model_dump()))

    async def save_market_trend(self, entity: MarketTrend) -> None:
        await self._merge(m.MarketTrendRow(**entity.model_dump()))

    async def save_customer_segment(self, entity: CustomerSegment) -> None:
        await self._merge(m.CustomerSegmentRow(**entity.model_dump()))

    async def save_evidence(self, entity: Evidence) -> None:
        await self._merge(m.EvidenceRow(**entity.model_dump()))

    # -- CustomerInsight --
    async def save_customer_insight(self, entity: CustomerInsight) -> None:
        await self._merge(m.CustomerInsightRow(**entity.model_dump()))

    async def load_customer_insight(self, entity_id: str) -> CustomerInsight:
        row = await self._session.get(m.CustomerInsightRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("customer_insight_not_found")
        return CustomerInsight(**_row_to_dict(row))

    async def save_unmet_need(self, entity: UnmetNeed) -> None:
        await self._merge(m.UnmetNeedRow(**entity.model_dump()))

    # -- Opportunity --
    async def save_opportunity(self, entity: Opportunity) -> None:
        await self._merge(m.OpportunityRow(**entity.model_dump()))

    async def load_opportunity(self, entity_id: str) -> Opportunity:
        row = await self._session.get(m.OpportunityRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("opportunity_not_found")
        return Opportunity(**_row_to_dict(row))

    # -- GrowthProblem --
    async def save_growth_problem(self, entity: GrowthProblem) -> None:
        await self._merge(m.GrowthProblemRow(**entity.model_dump()))

    async def load_growth_problem(self, entity_id: str) -> GrowthProblem:
        row = await self._session.get(m.GrowthProblemRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("growth_problem_not_found")
        return GrowthProblem(**_row_to_dict(row))

    # -- GrowthHypothesis --
    async def save_growth_hypothesis(self, entity: GrowthHypothesis) -> None:
        await self._merge(m.GrowthHypothesisRow(**entity.model_dump()))

    async def load_growth_hypothesis(self, entity_id: str) -> GrowthHypothesis:
        row = await self._session.get(m.GrowthHypothesisRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("growth_hypothesis_not_found")
        return GrowthHypothesis(**_row_to_dict(row))

    async def list_growth_hypotheses_by_problem(self, problem_id: str) -> list[GrowthHypothesis]:
        result = await self._session.execute(
            select(m.GrowthHypothesisRow).where(m.GrowthHypothesisRow.problem_id == problem_id)
        )
        return [GrowthHypothesis(**_row_to_dict(row)) for row in result.scalars().all()]

    # -- ContradictionModel --
    async def save_contradiction_model(self, entity: ContradictionModel) -> None:
        await self._merge(m.ContradictionModelRow(**entity.model_dump()))

    # -- GrowthStrategy --
    async def save_growth_strategy(self, entity: GrowthStrategy) -> None:
        await self._merge(m.GrowthStrategyRow(**entity.model_dump()))

    async def load_growth_strategy(self, entity_id: str) -> GrowthStrategy:
        row = await self._session.get(m.GrowthStrategyRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("growth_strategy_not_found")
        return GrowthStrategy(**_row_to_dict(row))

    # -- ProductZoneAssessment --
    async def save_product_zone_assessment(self, entity: ProductZoneAssessment) -> None:
        await self._merge(m.ProductZoneAssessmentRow(**entity.model_dump()))

    # -- ProductConcept --
    async def save_product_concept(self, entity: ProductConcept) -> None:
        await self._merge(m.ProductConceptRow(**entity.model_dump()))

    async def load_product_concept(self, entity_id: str) -> ProductConcept:
        row = await self._session.get(m.ProductConceptRow, entity_id)
        if row is None:
            raise ProductIntelligenceNotFoundError("product_concept_not_found")
        return ProductConcept(**_row_to_dict(row))

    # -- ProductComponent / ProductPattern / ProductDefinition / ServiceBlueprintVersion --
    async def save_product_component(self, entity: ProductComponent) -> None:
        await self._merge(m.ProductComponentRow(**entity.model_dump()))

    async def save_product_pattern(self, entity: ProductPattern) -> None:
        await self._merge(m.ProductPatternRow(**entity.model_dump()))

    async def save_product_definition(self, entity: ProductDefinition) -> None:
        await self._merge(m.ProductDefinitionRow(**entity.model_dump()))

    async def save_service_blueprint_version(self, entity: ServiceBlueprintVersion) -> None:
        await self._merge(m.ServiceBlueprintVersionRow(**entity.model_dump()))

    async def _merge(self, row: object) -> None:
        await self._session.merge(row)
        await self._session.commit()


def _row_to_dict(row: object) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}
