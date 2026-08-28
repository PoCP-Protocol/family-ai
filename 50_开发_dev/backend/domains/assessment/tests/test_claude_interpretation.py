"""Unit tests for `ClaudeInterpretationAdapter` — mocked Anthropic client,
NO real API calls in this suite. Verifies: correct request shape (structured
output schema, system prompt), fail-closed on missing text block, fail-closed
when the model output fails boundary validation (schema alone isn't trusted
blindly — see module docstring), and the live-AI gating function.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from domains.assessment.domain.entities import GrowthHypothesisEvidence
from domains.assessment.domain.errors import AssessmentValidationError
from domains.assessment.infrastructure.claude_interpretation import (
    _DRAFT_OUTPUT_SCHEMA,
    ClaudeInterpretationAdapter,
    is_live_external_ai_authorized,
)


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
            {
                "hypothesis_ref": "sess-1:H1",
                "boundary": "hypothesis_not_fact",
                "construct_refs": ["PARENT_CHILD_COMMUNICATION"],
                "is_primary_contradiction": True,
                "contradiction_rank": 1,
            }
        ],
        "action_candidates": [{"action_ref": "PARENT_CHILD_COMMUNICATION_CONFLICT:SUPPORT_ACTION", "boundary": "recommendation_not_decision"}],
    }


class TestClaudeInterpretationAdapter:
    async def test_valid_model_output_produces_correct_draft_shape(self):
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client, model="claude-opus-4-8")

        result = await adapter.interpret("family-1", _evidence(), "DEEP_AI_INTERPRETATION")

        assert result["service_depth"] == "DEEP_AI_INTERPRETATION"
        assert result["interpretation"]["generator"] == "FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY"
        draft = result["interpretation"]["draft"]
        assert draft["boundary_labels"] == ["hypothesis_not_fact", "recommendation_not_decision"]
        assert draft["construct_signals"][0]["construct_ref"] == "PARENT_CHILD_COMMUNICATION"
        assert result["scorecard"]["model"] == "claude-opus-4-8"
        assert result["scorecard"]["usage"]["input_tokens"] == 100

    async def test_request_uses_structured_output_and_correct_model(self):
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client, model="claude-opus-4-8")

        await adapter.interpret("family-1", _evidence())

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-opus-4-8"
        assert "json_schema" in call_kwargs["output_config"]["format"]["type"]
        assert "reviewed whitelist" in call_kwargs["system"]

    async def test_system_prompt_includes_verified_knowledge_grounding(self):
        """PARENT_CHILD_COMMUNICATION 在 CONSTRUCT_KNOWLEDGE_MAP 里映射到 TH-001 —— 验证它的
        core_claim 真的进了 system prompt,不是知识库接进来了但内容没流到模型输入里。"""
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        await adapter.interpret("family-1", _evidence())

        system_prompt = mock_client.messages.create.call_args.kwargs["system"]
        assert "TH-001" in system_prompt
        assert "情绪教练式回应" in system_prompt  # TH-001 core_claim 的关键片段

    async def test_system_prompt_includes_device_use_context_grounding(self):
        """DEVICE_USE_CONTEXT 此前在 CONSTRUCT_KNOWLEDGE_MAP 里一直是空列表(知识库无对应卡片)。
        2026-08-29 补上 TH-010(家长媒体调节理论)后,验证它也真的进了 system prompt,
        不是加了映射但忘了重新生成 grounding JSON。"""
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        await adapter.interpret("family-1", _evidence())

        system_prompt = mock_client.messages.create.call_args.kwargs["system"]
        assert "TH-010" in system_prompt
        assert "DEVICE_USE_CONTEXT" in system_prompt

    async def test_grounding_source_is_sanitized_against_known_card_ids(self):
        """模型自报一个不在 CONSTRUCT_KNOWLEDGE_MAP 名单里的 grounding_source(编造的卡片id)
        —— 必须被清空,不能原样透传出去看起来像是有据可查。"""
        output = _valid_model_output()
        output["construct_signals"][0]["grounding_source"] = "TH-999-FABRICATED"
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        result = await adapter.interpret("family-1", _evidence())

        signal = result["interpretation"]["draft"]["construct_signals"][0]
        assert "grounding_source" not in signal

    async def test_grounding_source_passes_through_when_valid(self):
        """模型引用的 grounding_source 确实在该 construct_ref 的已知卡片名单里 —— 应原样保留。"""
        output = _valid_model_output()
        output["construct_signals"][0]["grounding_source"] = "TH-001"
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        result = await adapter.interpret("family-1", _evidence())

        signal = result["interpretation"]["draft"]["construct_signals"][0]
        assert signal["grounding_source"] == "TH-001"

    async def test_refusal_stop_reason_with_no_text_block_fails_closed(self):
        response = MagicMock()
        response.content = []  # no text block — e.g. pure refusal
        response.stop_reason = "refusal"
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=response)
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        with pytest.raises(AssessmentValidationError) as exc:
            await adapter.interpret("family-1", _evidence())
        assert "claude_interpretation_no_text_output" in exc.value.code
        assert "refusal" in exc.value.code

    async def test_boundary_violation_in_model_output_fails_closed_not_silently_substituted(self):
        """Even though the JSON schema constrains construct_ref via enum,
        this test proves the adapter does NOT trust the schema blindly —
        if a fabricated ref somehow got through (schema bug, future model
        behavior change), assert_interpretation_boundary still catches it
        and the adapter raises rather than silently returning a bad draft.
        """
        bad_output = _valid_model_output()
        bad_output["construct_signals"][0]["construct_ref"] = "PARENT_CHILD_COMMUNICATION"
        bad_output["hypotheses"][0]["boundary"] = "confirmed_fact"  # corrupt a boundary literal
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(bad_output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        with pytest.raises(AssessmentValidationError) as exc:
            await adapter.interpret("family-1", _evidence())
        assert exc.value.code == "hypothesis_missing_boundary"

    async def test_batch1_admitted_construct_refs_are_accepted(self):
        """2026-08-29 Batch 1 (governance/CONSTRUCT_ADMISSION_REGISTRY.yaml) admitted
        EMOTION_REGULATION_SUPPORT/PARENT_CAPACITY/SCHOOL_FAMILY_COLLABORATION —
        confirms the expanded whitelist actually accepts them, not just that the
        original 3 still work."""
        output = _valid_model_output()
        output["construct_signals"][0]["construct_ref"] = "EMOTION_REGULATION_SUPPORT"
        output["hypotheses"][0]["construct_refs"] = ["PARENT_CAPACITY"]
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        result = await adapter.interpret("family-1", _evidence())

        assert result["interpretation"]["draft"]["construct_signals"][0]["construct_ref"] == "EMOTION_REGULATION_SUPPORT"

    async def test_still_unadmitted_construct_ref_rejected_after_batch1_expansion(self):
        """Expanding the whitelist to 6 refs must not accidentally widen the
        enum/boundary check into accepting everything — an unreviewed HOLD
        construct like AI_LITERACY_FLUENCY (governance/CONSTRUCT_ADMISSION_REGISTRY.yaml)
        must still fail the JSON schema's enum, which raises a JSONDecodeError-adjacent
        provider-side rejection rather than a silent pass-through. We simulate the
        schema having been bypassed (e.g. a future model quirk) to prove the
        boundary-layer whitelist check is the real backstop, not just the enum."""
        output = _valid_model_output()
        output["construct_signals"][0]["construct_ref"] = "AI_LITERACY_FLUENCY"
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        with pytest.raises(AssessmentValidationError) as exc:
            await adapter.interpret("family-1", _evidence())
        assert "construct_ref_not_in_reviewed_registry" in exc.value.code

    async def test_too_many_primary_contradictions_in_model_output_fails_closed(self):
        """4 hypotheses all marked is_primary_contradiction=True should be
        rejected by the boundary re-validation, even though the JSON schema
        itself has no way to express "at most 3 items across the array have
        property X true" — this is exactly why the boundary check exists as
        a second layer, not just the schema.
        """
        bad_output = _valid_model_output()
        base_hypothesis = bad_output["hypotheses"][0]
        bad_output["hypotheses"] = [
            {**base_hypothesis, "hypothesis_ref": f"sess-1:H{i}", "contradiction_rank": i, "is_primary_contradiction": True}
            for i in range(1, 5)
        ]
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(bad_output))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        with pytest.raises(AssessmentValidationError) as exc:
            await adapter.interpret("family-1", _evidence())
        assert "too_many_primary_contradictions" in exc.value.code

    async def test_draft_schema_declares_primary_contradiction_fields(self):
        hypothesis_schema = _DRAFT_OUTPUT_SCHEMA["properties"]["hypotheses"]["items"]
        assert "is_primary_contradiction" in hypothesis_schema["properties"]
        assert hypothesis_schema["properties"]["is_primary_contradiction"]["type"] == "boolean"
        assert "contradiction_rank" in hypothesis_schema["properties"]
        assert "is_primary_contradiction" in hypothesis_schema["required"]
        assert "contradiction_rank" in hypothesis_schema["required"]

    async def test_system_prompt_instructs_primary_contradiction_judgment(self):
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_fake_response(_valid_model_output()))
        adapter = ClaudeInterpretationAdapter(client=mock_client)

        await adapter.interpret("family-1", _evidence())

        system_prompt = mock_client.messages.create.call_args.kwargs["system"]
        assert "primary contradiction" in system_prompt
        assert "1 to 3" in system_prompt


class TestLiveExternalAiGating:
    def test_disabled_by_default(self, monkeypatch):
        monkeypatch.delenv("FAMILY_MODEL_GATEWAY_MODE", raising=False)
        monkeypatch.delenv("FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI", raising=False)
        assert is_live_external_ai_authorized() is False

    def test_requires_both_env_vars(self, monkeypatch):
        monkeypatch.setenv("FAMILY_MODEL_GATEWAY_MODE", "live")
        monkeypatch.delenv("FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI", raising=False)
        assert is_live_external_ai_authorized() is False

        monkeypatch.delenv("FAMILY_MODEL_GATEWAY_MODE", raising=False)
        monkeypatch.setenv("FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI", "true")
        assert is_live_external_ai_authorized() is False

    def test_enabled_only_when_both_explicitly_set(self, monkeypatch):
        monkeypatch.setenv("FAMILY_MODEL_GATEWAY_MODE", "live")
        monkeypatch.setenv("FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI", "true")
        assert is_live_external_ai_authorized() is True
