"""Verifies Override #6 item 3 / project-owner instruction 03 rule 4:
AI-generated hypotheses are created DRAFT and no path except an explicit
human-actor call can mark them VALIDATED.
"""
from __future__ import annotations

import pytest

from ..application import commands
from ..domain.errors import ProductIntelligenceValidationError


@pytest.mark.asyncio
async def test_ai_generated_hypothesis_starts_as_draft(fake_repo):
    signal = await commands.create_market_signal(fake_repo, raw_text="x", created_by="r1", tenant_scope="t1")
    insight = await commands.create_customer_insight(fake_repo, signal_id=signal.id, statement="i", created_by="r1", tenant_scope="t1")
    opportunity = await commands.create_opportunity(fake_repo, insight_id=insight.id, statement="o", created_by="r1", tenant_scope="t1")
    problem = await commands.create_growth_problem(fake_repo, opportunity_id=opportunity.id, symptom="p", created_by="r1", tenant_scope="t1")

    hypothesis = await commands.create_growth_hypothesis(
        fake_repo, problem_id=problem.id, statement="h", created_by="ai:growth.hypothesis.generate",
        tenant_scope="t1", generated_by="ai:growth.hypothesis.generate",
    )
    assert hypothesis.status == "DRAFT"


@pytest.mark.asyncio
async def test_ai_actor_cannot_validate_hypothesis(fake_repo):
    signal = await commands.create_market_signal(fake_repo, raw_text="x", created_by="r1", tenant_scope="t1")
    insight = await commands.create_customer_insight(fake_repo, signal_id=signal.id, statement="i", created_by="r1", tenant_scope="t1")
    opportunity = await commands.create_opportunity(fake_repo, insight_id=insight.id, statement="o", created_by="r1", tenant_scope="t1")
    problem = await commands.create_growth_problem(fake_repo, opportunity_id=opportunity.id, symptom="p", created_by="r1", tenant_scope="t1")
    hypothesis = await commands.create_growth_hypothesis(
        fake_repo, problem_id=problem.id, statement="h", created_by="r1", tenant_scope="t1",
    )

    with pytest.raises(ProductIntelligenceValidationError):
        await commands.validate_growth_hypothesis(fake_repo, hypothesis_id=hypothesis.id, human_actor="ai:some-agent")


@pytest.mark.asyncio
async def test_human_actor_can_validate_hypothesis(fake_repo):
    signal = await commands.create_market_signal(fake_repo, raw_text="x", created_by="r1", tenant_scope="t1")
    insight = await commands.create_customer_insight(fake_repo, signal_id=signal.id, statement="i", created_by="r1", tenant_scope="t1")
    opportunity = await commands.create_opportunity(fake_repo, insight_id=insight.id, statement="o", created_by="r1", tenant_scope="t1")
    problem = await commands.create_growth_problem(fake_repo, opportunity_id=opportunity.id, symptom="p", created_by="r1", tenant_scope="t1")
    hypothesis = await commands.create_growth_hypothesis(
        fake_repo, problem_id=problem.id, statement="h", created_by="r1", tenant_scope="t1",
    )

    validated = await commands.validate_growth_hypothesis(fake_repo, hypothesis_id=hypothesis.id, human_actor="human-reviewer-1")
    assert validated.status == "VALIDATED"
