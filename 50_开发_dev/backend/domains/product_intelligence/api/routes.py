"""FastAPI routes for the PR-001 acceptance chain. Not mounted into any app
yet — see `dependencies.py`. Written and tested via direct `APIRouter` +
`TestClient` invocation in `tests/`, per the project owner's acceptance
criterion ("可通过 API 完整创建一条...数据链").
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..application import commands, queries
from ..application.ports import ProductIntelligenceRepositoryPort
from ..domain.errors import ProductIntelligenceDomainError
from . import requests as req
from .dependencies import get_repository
from .responses import ProductConceptChainResponse

router = APIRouter(prefix="/product-intelligence", tags=["product-intelligence"])

_ERROR_STATUS = {
    "ProductIntelligenceValidationError": 400,
    "ProductIntelligenceForbiddenError": 403,
    "ProductIntelligenceNotFoundError": 404,
}


def _raise_http(exc: ProductIntelligenceDomainError) -> None:
    status = _ERROR_STATUS.get(type(exc).__name__, 400)
    raise HTTPException(status_code=status, detail=exc.code) from exc


@router.post("/market-signals")
async def create_market_signal(body: req.CreateMarketSignalRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_market_signal(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/customer-insights")
async def create_customer_insight(body: req.CreateCustomerInsightRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_customer_insight(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/opportunities")
async def create_opportunity(body: req.CreateOpportunityRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_opportunity(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/growth-problems")
async def create_growth_problem(body: req.CreateGrowthProblemRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_growth_problem(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/growth-hypotheses")
async def create_growth_hypothesis(body: req.CreateGrowthHypothesisRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_growth_hypothesis(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/growth-hypotheses/{hypothesis_id}/validate")
async def validate_growth_hypothesis(hypothesis_id: str, body: req.ValidateGrowthHypothesisRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.validate_growth_hypothesis(repo, hypothesis_id=hypothesis_id, human_actor=body.human_actor)
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/growth-strategies")
async def create_growth_strategy(body: req.CreateGrowthStrategyRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_growth_strategy(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.post("/product-concepts")
async def create_product_concept(body: req.CreateProductConceptRequest, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await commands.create_product_concept(repo, **body.model_dump())
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)


@router.get("/product-concepts/{product_concept_id}/chain", response_model=ProductConceptChainResponse)
async def get_product_concept_chain(product_concept_id: str, repo: ProductIntelligenceRepositoryPort = Depends(get_repository)):
    try:
        return await queries.get_product_concept_chain(repo, product_concept_id=product_concept_id)
    except ProductIntelligenceDomainError as exc:
        _raise_http(exc)
