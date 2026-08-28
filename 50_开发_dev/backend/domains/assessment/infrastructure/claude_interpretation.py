"""Real Claude API interpretation adapter — the live path
`generateGatewayDraft` occupies in the TypeScript `family-model` package,
now calling the Anthropic API directly instead of going through
`@family/ai-gateway`'s multi-provider abstraction (that package is not
ported yet; this adapter is Claude-specific by design, per project
direction to use the Anthropic SDK for Family's AI Runtime).

FAIL-CLOSED, NOT FAIL-OPEN: unlike the TS `family-assessment-model.provider.ts`
weak point flagged in `architecture/GENERATIVE_AI_SYSTEM_ASSESSMENT_2026-08-28.md`
section 1.3 ("real gateway call failure silently falls back to deterministic
version... not strict fail-closed"), this adapter does NOT catch a provider
failure and silently substitute the deterministic draft. If the live call or
boundary validation fails, `interpret()` raises — the caller (application
layer) sees an error, not a quietly-downgraded draft. Whether to fall back to
`DeterministicInterpretationAdapter` at a HIGHER layer (e.g. a wrapping
"fail-closed-with-explicit-ai_state" decorator) is a deliberate composition
choice for the caller, not something silently baked into this adapter.

Default-off: this adapter is never constructed unless the caller explicitly
wires it (see `apps/family_api/dependencies.py`), which itself only happens
under explicit env configuration — G1-A's mock/fail-closed default
(`governance/AUTHORIZATION_REGISTRY.yaml`) is unchanged. No code path in this
file runs unless a human has explicitly turned on live external AI for this
process.

AI Run Ledger: an optional `AiRunLedgerPort` may be injected (constructor
arg, defaulted to `None`). When present, `interpret()` writes exactly one
`AiRunRecord` per call, on every path — provider call failure
(`outcome="provider_error"`), missing text block / refusal (also
`"provider_error"`), boundary-validation failure
(`outcome="boundary_violation"`), or a clean success — before re-raising or
returning. This is the audit trail migration plan §9's "AI Run Ledger" item
requires; see `domain/ai_run.py` for the record shape and
`infrastructure/ai_run_ledger.py` for why a ledger *write* failure does not
itself fail this call.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone

import anthropic

from ..domain.ai_run import AiRunRecord
from ..domain.entities import GrowthHypothesisEvidence
from ..domain.errors import AssessmentValidationError
from ..domain.interpretation_boundary import assert_interpretation_boundary
from ..application.ports import AiRunLedgerPort, AssessmentInterpretationPort

_LEGAL_CONSTRUCT_REFS = {
    "PARENT_CHILD_COMMUNICATION",
    "HOMEWORK_PROCESS",
    "DEVICE_USE_CONTEXT",
}

_DRAFT_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "need_summary": {
            "type": "array",
            "items": {"type": "object", "properties": {"need_ref": {"type": "string"}}, "required": ["need_ref"], "additionalProperties": False},
        },
        "construct_signals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "construct_ref": {"type": "string", "enum": sorted(_LEGAL_CONSTRUCT_REFS)},
                    "boundary": {"type": "string", "const": "signal_not_diagnosis"},
                },
                "required": ["construct_ref", "boundary"],
                "additionalProperties": False,
            },
        },
        "hypotheses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "hypothesis_ref": {"type": "string"},
                    "boundary": {"type": "string", "const": "hypothesis_not_fact"},
                    "construct_refs": {"type": "array", "items": {"type": "string", "enum": sorted(_LEGAL_CONSTRUCT_REFS)}},
                    # Primary-contradiction marking — the minimal field-level increment
                    # architecture/FAMILY_COMMERCIAL_VALUE_STRATEGY_V2.md section 8.3/8.4
                    # calls for (problem -> primary_contradiction -> plan), added onto the
                    # existing hypothesis item rather than a new top-level object.
                    "is_primary_contradiction": {"type": "boolean"},
                    "contradiction_rank": {"type": ["integer", "null"], "minimum": 1},
                },
                "required": ["hypothesis_ref", "boundary", "construct_refs", "is_primary_contradiction", "contradiction_rank"],
                "additionalProperties": False,
            },
        },
        "action_candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action_ref": {"type": "string"},
                    "boundary": {"type": "string", "const": "recommendation_not_decision"},
                },
                "required": ["action_ref", "boundary"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["need_summary", "construct_signals", "hypotheses", "action_candidates"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = (
    "You interpret family assessment evidence into a structured support-direction draft. "
    "This is NOT a diagnosis, NOT a score, and NOT a ranking — you may only propose hypotheses "
    "(explicitly not-fact) and action candidates (explicitly not-decisions). "
    "construct_ref values you use MUST come only from this reviewed whitelist: "
    f"{sorted(_LEGAL_CONSTRUCT_REFS)}. Do not invent new construct_ref values under any circumstance — "
    "a prior incident involved a model fabricating unreviewed construct names, which is exactly what "
    "this whitelist exists to prevent. Every construct_signal must have boundary='signal_not_diagnosis'. "
    "Every hypothesis must have boundary='hypothesis_not_fact'. Every action_candidate must have "
    "boundary='recommendation_not_decision'. Never include any field resembling a total score, a "
    "ranking, or a diagnosis label. "
    "Among the hypotheses you output, judge which ones represent the primary contradiction — the "
    "1 to 3 hypotheses that, if addressed, would most unblock progress right now — and set "
    "is_primary_contradiction=true on ONLY those (at most 3, never more). Set contradiction_rank "
    "to 1, 2, 3... in priority order (1 = most urgent) on the ones you marked true, and set "
    "contradiction_rank=null on every hypothesis you did NOT mark as a primary contradiction. All "
    "remaining hypotheses are secondary and must have is_primary_contradiction=false. This "
    "judgment is itself a hypothesis about priority, not a fact — it does not change the "
    "hypothesis_not_fact boundary."
)


class ClaudeInterpretationAdapter(AssessmentInterpretationPort):
    """Live Claude API path. Constructed only when explicitly wired — see
    module docstring. Uses `output_config.format` (structured outputs) per
    the Claude API skill's documented pattern, not manual JSON-in-text
    parsing, so malformed output is a provider-side 400 rather than a
    client-side parse failure to silently swallow.
    """

    def __init__(
        self,
        client: anthropic.AsyncAnthropic | None = None,
        model: str = "claude-opus-4-8",
        ai_run_ledger: AiRunLedgerPort | None = None,
    ):
        self._client = client or anthropic.AsyncAnthropic()
        self._model = model
        # Optional, defaulted — existing call sites (tests, current
        # dependencies.py wiring) keep working unchanged; the ledger
        # dependency is additive, not breaking.
        self._ai_run_ledger = ai_run_ledger

    async def _record_run(
        self,
        evidence: GrowthHypothesisEvidence,
        service_depth: str,
        started_at: datetime,
        outcome: str,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        error_detail: str | None = None,
    ) -> None:
        if self._ai_run_ledger is None:
            return
        await self._ai_run_ledger.record(
            AiRunRecord(
                run_id=str(uuid.uuid4()),
                assessment_session_id=evidence.assessment_session_id,
                service_depth=service_depth,
                generator="gateway",
                model_name=self._model,
                started_at=started_at,
                completed_at=datetime.now(timezone.utc),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                outcome=outcome,
                error_detail=error_detail,
            )
        )

    async def interpret(
        self, family_id: str, evidence: GrowthHypothesisEvidence, service_depth: str = "DEEP_AI_INTERPRETATION"
    ) -> dict:
        started_at = datetime.now(timezone.utc)
        user_input = {
            "family_context_ref": f"FAMILY:{family_id}",
            "assessment_session_id": evidence.assessment_session_id,
            "need_type_ref": evidence.need_type_ref,
            "need_type_title": evidence.title,
            "need_type_description": evidence.description,
            "response_set": evidence.response_set,
        }

        try:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=4096,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(user_input, ensure_ascii=False)}],
                output_config={"format": {"type": "json_schema", "schema": _DRAFT_OUTPUT_SCHEMA}},
            )
        except Exception as exc:  # noqa: BLE001 — record the provider failure, then re-raise unchanged.
            await self._record_run(evidence, service_depth, started_at, outcome="provider_error", error_detail=str(exc)[:256])
            raise

        text_block = next((block for block in response.content if block.type == "text"), None)
        if text_block is None:
            # No text block at all (e.g. stop_reason == "refusal") — fail closed, do not guess.
            await self._record_run(
                evidence,
                service_depth,
                started_at,
                outcome="provider_error",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                error_detail=f"no_text_output:{response.stop_reason}"[:256],
            )
            raise AssessmentValidationError(f"claude_interpretation_no_text_output:{response.stop_reason}")

        model_output = json.loads(text_block.text)

        draft = {
            "model_component_ref": "FAMILY_ASSESSMENT_V0_COMPONENT",
            "assessment_ref": evidence.assessment_session_id,
            "boundary_labels": ["hypothesis_not_fact", "recommendation_not_decision"],
            "need_summary": model_output["need_summary"],
            "construct_signals": model_output["construct_signals"],
            "hypotheses": model_output["hypotheses"],
            "action_candidates": model_output["action_candidates"],
            "human_gate": {"required": False, "reason_refs": []},
            "prohibited_outputs": [],
        }

        # Fail-closed boundary re-validation — the JSON schema already
        # constrains the shape, but this is the SAME check
        # DeterministicInterpretationAdapter's output would need to pass if
        # it were re-validated, and it's cheap insurance against a schema
        # bug or a future model that ignores output_config in some edge case.
        try:
            assert_interpretation_boundary(draft, _LEGAL_CONSTRUCT_REFS)
        except AssessmentValidationError as exc:
            await self._record_run(
                evidence,
                service_depth,
                started_at,
                outcome="boundary_violation",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                error_detail=exc.code[:256],
            )
            raise

        await self._record_run(
            evidence,
            service_depth,
            started_at,
            outcome="success",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

        return {
            "subsystem_ref": "FAMILY_ASSESSMENT_AI_SUBSYSTEM",
            "subsystem_version": "0.1.0",
            "service_depth": service_depth,
            "interpretation": {
                "backend_capability_ref": "FAMILY_ASSESSMENT_AI_CAPABILITY",
                "ai_use_case": "ASSESSMENT_INTERPRETATION",
                "generator": "FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY",
                "assessment_ref": evidence.assessment_session_id,
                "draft": draft,
            },
            "scorecard": {
                "generator": "FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY",
                "model": self._model,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
            },
        }


def is_live_external_ai_authorized() -> bool:
    """Port of the G1-A gating check — mirrors the TS gateway's
    `FAMILY_MODEL_GATEWAY_MODE` + `FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI` env
    combination requirement (see `architecture/GENERATIVE_AI_SYSTEM_ASSESSMENT_2026-08-28.md`
    section 1.1). Both must be explicitly set — there is no default that
    turns this on.
    """
    return (
        os.environ.get("FAMILY_MODEL_GATEWAY_MODE") == "live"
        and os.environ.get("FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI", "").lower() == "true"
    )
