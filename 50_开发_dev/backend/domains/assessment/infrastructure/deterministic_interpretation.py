"""Default (mock/fail-closed) interpretation adapter — port of the
`interpretDeterministically` fallback path in `family-model`'s
`FamilyEducationModelRuntime`. Per G1-A's binding default
(`governance/AUTHORIZATION_REGISTRY.yaml`, `.env.example` mock/fail-closed),
this is what runs when no live provider is configured: deterministic,
rule-based, no external call. A real `AiRuntimeInterpretationAdapter` that
calls the Python AI Runtime process is a later step in this task — the
migration plan's own acceptance criterion #9 ("provider failure fails
closed, explicitly") means this fallback path must exist and be correct
before a live path is added, not after.

Boundary labels (`hypothesis_not_fact`, `recommendation_not_decision`,
`signal_not_diagnosis`) and the construct-ref whitelist rule are the same
fail-closed guarantees `assertInterpretationBoundary` enforces in the
TypeScript version — see migration plan section 10.
"""
from __future__ import annotations

from ..application.ports import AssessmentInterpretationPort
from ..domain.entities import GrowthHypothesisEvidence

_LEGAL_CONSTRUCT_REFS = {
    "PARENT_CHILD_COMMUNICATION",
    "HOMEWORK_PROCESS",
    "DEVICE_USE_CONTEXT",
}

_FOCUS_TO_CONSTRUCT = {
    "COMMUNICATION": "PARENT_CHILD_COMMUNICATION",
    "HOMEWORK": "HOMEWORK_PROCESS",
    "SCREEN_TIME": "DEVICE_USE_CONTEXT",
}


class DeterministicInterpretationAdapter(AssessmentInterpretationPort):
    """No external call. Produces a structurally valid interpretation draft
    from the evidence alone — same shape a real AI Runtime response would
    have, so the application layer (`_map_hypothesis`) doesn't need to know
    which adapter is behind the port.
    """

    async def interpret(
        self, family_id: str, evidence: GrowthHypothesisEvidence, service_depth: str = "DEEP_AI_INTERPRETATION"
    ) -> dict:
        construct_ref = _FOCUS_TO_CONSTRUCT.get(evidence.focus_ref)
        construct_signals = []
        if construct_ref in _LEGAL_CONSTRUCT_REFS:
            construct_signals = [
                {
                    "construct_ref": construct_ref,
                    "boundary": "signal_not_diagnosis",
                }
            ]

        hypothesis_ref = f"{evidence.assessment_session_id}:H1"
        draft = {
            "model_component_ref": "FAMILY_ASSESSMENT_V0_COMPONENT",
            "assessment_ref": evidence.assessment_session_id,
            "boundary_labels": ["hypothesis_not_fact", "recommendation_not_decision"],
            "need_summary": [{"need_ref": evidence.need_type_ref}],
            "construct_signals": construct_signals,
            "hypotheses": [
                {
                    "hypothesis_ref": hypothesis_ref,
                    "boundary": "hypothesis_not_fact",
                    "construct_refs": [construct_ref] if construct_ref else [],
                }
            ],
            "action_candidates": [
                {
                    "action_ref": f"{evidence.need_type_ref}:SUPPORT_ACTION",
                    "boundary": "recommendation_not_decision",
                }
            ],
            "human_gate": {"required": False, "reason_refs": []},
            "prohibited_outputs": [],
        }
        return {
            "subsystem_ref": "FAMILY_ASSESSMENT_AI_SUBSYSTEM",
            "subsystem_version": "0.1.0",
            "service_depth": service_depth,
            "interpretation": {
                "backend_capability_ref": "FAMILY_ASSESSMENT_AI_CAPABILITY",
                "ai_use_case": "ASSESSMENT_INTERPRETATION",
                "generator": "FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC",
                "assessment_ref": evidence.assessment_session_id,
                "draft": draft,
            },
            "scorecard": {"generator": "FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC"},
        }
