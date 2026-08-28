"""API request DTOs — acceptance chain only (Override #6 item 2)."""
from __future__ import annotations

from pydantic import BaseModel


class CreateMarketSignalRequest(BaseModel):
    raw_text: str
    source_ref: str | None = None
    created_by: str
    tenant_scope: str


class CreateCustomerInsightRequest(BaseModel):
    signal_id: str
    statement: str
    created_by: str
    tenant_scope: str
    generated_by: str | None = None
    model_ref: str | None = None
    confidence: float | None = None


class CreateOpportunityRequest(BaseModel):
    insight_id: str
    statement: str
    created_by: str
    tenant_scope: str
    generated_by: str | None = None
    model_ref: str | None = None
    confidence: float | None = None


class CreateGrowthProblemRequest(BaseModel):
    opportunity_id: str
    symptom: str
    created_by: str
    tenant_scope: str


class CreateGrowthHypothesisRequest(BaseModel):
    problem_id: str
    statement: str
    created_by: str
    tenant_scope: str
    generated_by: str | None = None
    model_ref: str | None = None
    confidence: float | None = None


class CreateGrowthStrategyRequest(BaseModel):
    problem_id: str
    hypothesis_ids: list[str]
    statement: str
    created_by: str
    tenant_scope: str
    generated_by: str | None = None
    model_ref: str | None = None
    confidence: float | None = None


class CreateProductConceptRequest(BaseModel):
    strategy_id: str
    title: str
    description: str | None = None
    created_by: str
    tenant_scope: str
    generated_by: str | None = None
    model_ref: str | None = None
    confidence: float | None = None


class ValidateGrowthHypothesisRequest(BaseModel):
    human_actor: str
