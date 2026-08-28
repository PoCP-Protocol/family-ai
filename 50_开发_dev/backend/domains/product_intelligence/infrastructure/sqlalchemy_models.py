"""SQLAlchemy ORM models for the Product Intelligence domain.

No shared `packages/persistence` Base exists yet repo-wide (Batch 1 has not
bootstrapped one as of this PR) — this module defines its own
`declarative_base()` as a temporary measure, to be merged into a shared
Base once `packages/persistence` exists. JSON columns (not Postgres ARRAY)
are used for list fields so the same models work against both real
Postgres and the SQLite engine used by this PR's tests (Override #6 item 4
— no real-PG integration test in this PR yet).
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import declarative_base
from sqlalchemy.types import JSON

Base = declarative_base()


class MarketSignalRow(Base):
    __tablename__ = "product_intelligence_market_signals"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    raw_text = Column(Text, nullable=False)
    source_ref = Column(String, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)


class SignalClusterRow(Base):
    __tablename__ = "product_intelligence_signal_clusters"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    label = Column(String, nullable=False)
    signal_ids = Column(JSON, nullable=False, default=list)
    evidence_refs = Column(JSON, nullable=False, default=list)


class MarketTrendRow(Base):
    __tablename__ = "product_intelligence_market_trends"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    cluster_ids = Column(JSON, nullable=False, default=list)
    evidence_refs = Column(JSON, nullable=False, default=list)


class CustomerSegmentRow(Base):
    __tablename__ = "product_intelligence_customer_segments"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    label = Column(String, nullable=False)
    definition = Column(Text, nullable=False)


class EvidenceRow(Base):
    __tablename__ = "product_intelligence_evidence"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    evidence_ref = Column(String, nullable=False)


class CustomerInsightRow(Base):
    __tablename__ = "product_intelligence_customer_insights"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    signal_id = Column(String, nullable=True)
    segment_id = Column(String, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class UnmetNeedRow(Base):
    __tablename__ = "product_intelligence_unmet_needs"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    insight_id = Column(String, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)


class OpportunityRow(Base):
    __tablename__ = "product_intelligence_opportunities"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    insight_id = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    evidence_refs = Column(JSON, nullable=False, default=list)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class GrowthProblemRow(Base):
    __tablename__ = "product_intelligence_growth_problems"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    symptom = Column(Text, nullable=False)
    opportunity_id = Column(String, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)


class GrowthHypothesisRow(Base):
    __tablename__ = "product_intelligence_growth_hypotheses"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    problem_id = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    supporting_evidence_refs = Column(JSON, nullable=False, default=list)
    counter_evidence_refs = Column(JSON, nullable=False, default=list)
    assumptions = Column(JSON, nullable=False, default=list)
    expected_observations = Column(JSON, nullable=False, default=list)
    falsification_conditions = Column(JSON, nullable=False, default=list)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class ContradictionModelRow(Base):
    __tablename__ = "product_intelligence_contradiction_models"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    primary_factor_a = Column(String, nullable=False)
    primary_factor_b = Column(String, nullable=False)
    relationship = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    supporting_hypothesis_ids = Column(JSON, nullable=False, default=list)
    evidence_refs = Column(JSON, nullable=False, default=list)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class GrowthStrategyRow(Base):
    __tablename__ = "product_intelligence_growth_strategies"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    problem_id = Column(String, nullable=False)
    hypothesis_ids = Column(JSON, nullable=False, default=list)
    contradiction_id = Column(String, nullable=True)
    statement = Column(Text, nullable=False)
    applicable_segment_ref = Column(String, nullable=True)
    exclusion_conditions = Column(JSON, nullable=False, default=list)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class ProductZoneAssessmentRow(Base):
    __tablename__ = "product_intelligence_zone_assessments"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    subject_ref = Column(String, nullable=False)
    subject_type = Column(String, nullable=False)
    customer_scarcity = Column(Float, nullable=False)
    replaceability = Column(Float, nullable=False)
    data_advantage = Column(Float, nullable=False)
    network_effect = Column(Float, nullable=False)
    learning_effect = Column(Float, nullable=False)
    switching_cost = Column(Float, nullable=False)
    commodity_score = Column(Float, nullable=False)
    advantage_score = Column(Float, nullable=False)
    unique_score = Column(Float, nullable=False)
    zone = Column(String, nullable=False)
    assessment_reason = Column(Text, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)
    assessor = Column(String, nullable=False)


class ProductConceptRow(Base):
    __tablename__ = "product_intelligence_product_concepts"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    strategy_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    generated_by = Column(String, nullable=True)
    model_ref = Column(String, nullable=True)
    prompt_use_case_version = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class ProductComponentRow(Base):
    __tablename__ = "product_intelligence_product_components"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    component_type = Column(String, nullable=False)
    title = Column(String, nullable=False)


class ProductPatternRow(Base):
    __tablename__ = "product_intelligence_product_patterns"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    title = Column(String, nullable=False)
    component_ids = Column(JSON, nullable=False, default=list)


class ProductDefinitionRow(Base):
    __tablename__ = "product_intelligence_product_definitions"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    concept_id = Column(String, nullable=False)
    pattern_id = Column(String, nullable=True)
    component_ids = Column(JSON, nullable=False, default=list)


class ServiceBlueprintVersionRow(Base):
    __tablename__ = "product_intelligence_service_blueprint_versions"
    id = Column(String, primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    tenant_scope = Column(String, nullable=False)
    status = Column(String, nullable=False)
    product_definition_id = Column(String, nullable=False)
    checksum = Column(String, nullable=True)
