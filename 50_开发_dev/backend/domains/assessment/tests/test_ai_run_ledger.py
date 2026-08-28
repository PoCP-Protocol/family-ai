"""Unit tests for the AI Run Ledger — verifies both interpretation adapters
write an `AiRunRecord` for every outcome (success, boundary_violation,
provider_error, and the deterministic-fallback path), using
`FakeAiRunLedger` (no DB). See `domain/ai_run.py` and
`AI_RUN_LEDGER_NOTES.md` for design rationale.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from domains.assessment.domain.entities import GrowthHypothesisEvidence
from domains.assessment.domain.errors import AssessmentValidationError
from domains.assessment.infrastructure.claude_interpretation import ClaudeInterpretationAdapter
from domains.assessment.infrastructure.deterministic_interpretation import DeterministicInterpretationAdapter
from domains.assessment.infrastructure.fake_ai_run_ledger import FakeAiRunLedger


def _evidence() -> GrowthHypothesisEvidence:
    return GrowthHypothesisEvidence(
        assessment_session_id="sess-1",
        subject_person_id="child-1",
        subject_display_name="小明",
        submitted_at=None,
        tool_ref="FAMILY_SUPPORT_NEEDS",
        tool_version=1,
        assessment_response_id="resp-1",
        focus_ref="COMMUNICATION",
        assessment_evidence_id="ev-1",
        need_type_ref="PARENT_CHILD_COMMUNICATION_CONFLICT",
        need_type_version=1,
        title="亲子沟通支持",
        description="先从倾听开始",
        required_capability_keys=["CAP_PARENT_COACHING"],
        response_set=[{"item_ref": "FOCUS", "response_type": "SINGLE_CHOICE", "response_value": "COMMUNICATION"}],
    )


def _fake_response(model_output: dict, stop_reason: str = "end_turn") -> MagicMock:
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = json.dumps(model_output)
    response = MagicMock()
    response.content = [text_block]
    response.stop_reason = stop_reason
    response.usage.input_tokens = 100
    response.usage.output_tokens = 50
    return response


def _valid_model_output() -> dict:
    return {
        "need_summary": [{"need_ref": "PARENT_CHILD_COMMUNICATION_CONFLICT"}],
        "construct_signals": [{"construct_ref": "PARENT_CHILD_COMMUNICATION", "boundary": "signal_not_diagnosis"}],
        "hypotheses": [
            {"hypothesis_ref": "sess-1:H1", "boundary": "hypothesis_not_fact", "construct_refs": ["PARENT_CHILD_COMMUNICATION"]}
        ],
        "action_candidates": [{"action_ref": "PARENT_CHILD_COMMUNICATION_CONFLICT:SUPPORT_ACTION", "boundary": "recommendation_not_decision"}],
    }


class TestDeterministicAdapterLedger:
    async def test_fallback_path_still_leaves_an_audit_trail(self):
        """Even with zero external calls, the ledger must record that this
        session's draft came from the deterministic fallback, not a live
        model — the whole point of migration plan §9's AI Run Ledger item.
        """
        ledger = FakeAiRunLedger()
        adapter = DeterministicInterpretationAdapter(ai_run_ledger=ledger)

        await adapter.interpret("family-1", _evidence())

        assert len(ledger.records) == 1
        record = ledger.records[0]
        assert record.generator == "deterministic"
        assert record.model_name is None
        assert record.outcome == "success"
        assert record.assessment_session_id == "sess-1"
        assert record.completed_at >= record.started_at

    async def test_ledger_is_optional_and_backward_compatible(self):
        """Existing call sites that construct with no ledger must keep working."""
        adapter = DeterministicInterpretationAdapter()
        result = await adapter.interpret("family-1", _evidence())
        assert result["interpretation"]["generator"] == "FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC"


class TestClaudeAdapterLedger:
    async def test_success_records_one_record_with_usage(self):
        ledger = FakeAiRunLedger()
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client, model="claude-opus-4-8", ai_run_ledger=ledger)

        await adapter.interpret("family-1", _evidence())

        assert len(ledger.records) == 1
        record = ledger.records[0]
        assert record.generator == "gateway"
        assert record.model_name == "claude-opus-4-8"
        assert record.outcome == "success"
        assert record.input_tokens == 100
        assert record.output_tokens == 50

    async def test_boundary_violation_records_boundary_violation_outcome(self):
        ledger = FakeAiRunLedger()
        bad_output = _valid_model_output()
        bad_output["hypotheses"][0]["boundary"] = "confirmed_fact"  # corrupt a boundary literal
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(bad_output))
        adapter = ClaudeInterpretationAdapter(client=mock_client, ai_run_ledger=ledger)

        with pytest.raises(AssessmentValidationError):
            await adapter.interpret("family-1", _evidence())

        assert len(ledger.records) == 1
        record = ledger.records[0]
        assert record.outcome == "boundary_violation"
        assert record.error_detail == "hypothesis_missing_boundary"

    async def test_refusal_with_no_text_block_records_provider_error(self):
        ledger = FakeAiRunLedger()
        response = MagicMock()
        response.content = []
        response.stop_reason = "refusal"
        response.usage.input_tokens = 10
        response.usage.output_tokens = 0
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=response)
        adapter = ClaudeInterpretationAdapter(client=mock_client, ai_run_ledger=ledger)

        with pytest.raises(AssessmentValidationError):
            await adapter.interpret("family-1", _evidence())

        assert len(ledger.records) == 1
        record = ledger.records[0]
        assert record.outcome == "provider_error"
        assert "refusal" in record.error_detail

    async def test_provider_transport_failure_records_provider_error_and_reraises(self):
        ledger = FakeAiRunLedger()
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(side_effect=RuntimeError("connection reset"))
        adapter = ClaudeInterpretationAdapter(client=mock_client, ai_run_ledger=ledger)

        with pytest.raises(RuntimeError):
            await adapter.interpret("family-1", _evidence())

        assert len(ledger.records) == 1
        record = ledger.records[0]
        assert record.outcome == "provider_error"
        assert "connection reset" in record.error_detail

    async def test_ledger_is_optional_and_backward_compatible(self):
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client)
        result = await adapter.interpret("family-1", _evidence())
        assert result["interpretation"]["generator"] == "FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY"
