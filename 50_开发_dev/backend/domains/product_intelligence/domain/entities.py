"""Product Intelligence domain entities.

No TS predecessor. Authored directly against the project owner's
instruction 01 (Override #6, `CURRENT_SPRINT.md`). Every entity carries the
required common fields (`id/status/version/created_at/updated_at/
created_by/tenant_scope`) plus, for AI-generated types, the AI provenance
fields (`generated_by/model_ref/prompt_use_case_version/confidence`).

This module has no FastAPI/SQLAlchemy dependency — see `infrastructure/
sqlalchemy_models.py` for the persistence mapping, per the four-layer rule
in `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .errors import ProductIntelligenceValidationError
from .value_objects import (
    ContradictionStatus,
    GenericRecordStatus,
    HypothesisStatus,
    OpportunityStatus,
    ProductConceptStatus,
    StrategyStatus,
)


class _CommonFields(BaseModel):
    id: str
    version: int = 1
    created_at: datetime
    updated_at: datetime
    created_by: str
    tenant_scope: str


class _AiProvenanceFields(BaseModel):
    """Only present on records that can be AI-generated. `generated_by` is
    an actor ref (e.g. `"ai:growth.hypothesis.generate"` or a human actor id
    for manually-authored records) — this PR does not wire a real AI Use
    Case Registry (Override #6 item 3/5), so these fields are populated by
    callers directly, not by any model adapter.
    """

    generated_by: str | None = None
    model_ref: str | None = None
    prompt_use_case_version: str | None = None
    confidence: float | None = None


class Evidence(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    description: str
    evidence_ref: str


class MarketSignal(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    raw_text: str
    source_ref: str | None = None
    evidence_refs: list[str] = []


class SignalCluster(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    label: str
    signal_ids: list[str]
    evidence_refs: list[str] = []


class MarketTrend(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    description: str
    cluster_ids: list[str] = []
    evidence_refs: list[str] = []


class CustomerSegment(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    label: str
    definition: str


class CustomerInsight(_CommonFields, _AiProvenanceFields):
    status: GenericRecordStatus = "ACTIVE"
    statement: str
    signal_id: str | None = None
    segment_id: str | None = None
    evidence_refs: list[str] = []


class UnmetNeed(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    statement: str
    insight_id: str | None = None
    evidence_refs: list[str] = []


class Opportunity(_CommonFields, _AiProvenanceFields):
    status: OpportunityStatus = "WATCH"
    insight_id: str
    statement: str
    evidence_refs: list[str] = []


class GrowthProblem(_CommonFields):
    status: GenericRecordStatus = "ACTIVE"
    symptom: str
    opportunity_id: str | None = None
    evidence_refs: list[str] = []


class GrowthHypothesis(_CommonFields, _AiProvenanceFields):
    status: HypothesisStatus = "DRAFT"
    problem_id: str
    statement: str
    supporting_evidence_refs: list[str] = []
    counter_evidence_refs: list[str] = []
    assumptions: list[str] = []
    expected_observations: list[str] = []
    falsification_conditions: list[str] = []

    def mark_validated(self, human_actor: str) -> "GrowthHypothesis":
        """Only a human actor call may validate a hypothesis. AI-generated
        hypotheses are created with `status="DRAFT"` and no code path in
        this domain may transition them to `VALIDATED` except this explicit
        method, called by an application-service handler acting on behalf
        of a human reviewer — never automatically from
        `generated_by`-populated creation. Per Override #6 item 3 /
        project-owner instruction 03 rule 4.
        """
        if not human_actor or human_actor.startswith("ai:"):
            raise ProductIntelligenceValidationError("hypothesis_validation_requires_human_actor")
        return self.model_copy(update={"status": "VALIDATED", "updated_at": datetime.utcnow()})


class ContradictionModel(_CommonFields, _AiProvenanceFields):
    status: ContradictionStatus = "DRAFT"
    primary_factor_a: str
    primary_factor_b: str
    relationship: str
    description: str | None = None
    supporting_hypothesis_ids: list[str] = []
    evidence_refs: list[str] = []


class GrowthStrategy(_CommonFields, _AiProvenanceFields):
    status: StrategyStatus = "DRAFT"
    problem_id: str
    hypothesis_ids: list[str] = []
    contradiction_id: str | None = None
    statement: str
    applicable_segment_ref: str | None = None
    exclusion_conditions: list[str] = []

    def __init__(self, **data: object) -> None:
        super().__init__(**data)
        if not self.hypothesis_ids:
            raise ProductIntelligenceValidationError("growth_strategy_requires_at_least_one_hypothesis")


class ProductZoneAssessment(_CommonFields):
    status: GenericRecordStatus = "DRAFT"
    subject_ref: str
    subject_type: str
    customer_scarcity: float
    replaceability: float
    data_advantage: float
    network_effect: float
    learning_effect: float
    switching_cost: float
    commodity_score: float
    advantage_score: float
    unique_score: float
    zone: str
    assessment_reason: str | None = None
    evidence_refs: list[str] = []
    assessor: str


class ProductConcept(_CommonFields, _AiProvenanceFields):
    status: ProductConceptStatus = "DRAFT"
    strategy_id: str
    title: str
    description: str | None = None


class ProductComponent(_CommonFields):
    status: GenericRecordStatus = "DRAFT"
    component_type: str
    title: str


class ProductPattern(_CommonFields):
    status: GenericRecordStatus = "DRAFT"
    title: str
    component_ids: list[str] = []


class ProductDefinition(_CommonFields):
    status: GenericRecordStatus = "DRAFT"
    concept_id: str
    pattern_id: str | None = None
    component_ids: list[str] = []


class ServiceBlueprintVersion(_CommonFields):
    status: GenericRecordStatus = "DRAFT"
    product_definition_id: str
    checksum: str | None = None
