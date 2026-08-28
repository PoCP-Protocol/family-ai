"""Port of `assertInterpretationBoundary` / `assertNoForbiddenOutputFields`
(`packages/family-model/src/index.ts`). Fail-closed structural validation of
any AI-generated interpretation draft — applies identically whether the
draft came from `DeterministicInterpretationAdapter` or a real model call
(`ClaudeInterpretationAdapter`). Per migration plan section 10, this
guarantee must be preserved, not weakened, in the Python port.

Three layers, all must pass or this raises:
1. Field-name blacklist: no key anywhere in the output may match
   total_score/ranking/diagnosis (case-insensitive), recursively.
2. Structural boundary literals: every construct_signal/hypothesis/
   action_candidate must carry its fixed boundary literal
   (signal_not_diagnosis / hypothesis_not_fact / recommendation_not_decision).
3. Construct-ref whitelist: every construct_ref referenced anywhere must be
   in the reviewed registry — this is what stopped the 2026-08-26 incident
   where a model fabricated PARENT_CHILD_COMMUNICATION_QUALITY and
   COMMUNICATION_RESPECT_TURN_TAKING (neither ever passed human review).
"""
from __future__ import annotations

import re
from typing import Any

from .errors import AssessmentValidationError

_FORBIDDEN_FIELD_PATTERN = re.compile(r"(?:total_?score|ranking|diagnosis)", re.IGNORECASE)


def assert_no_forbidden_output_fields(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, sub_value in value.items():
            if key != "prohibited_outputs" and _FORBIDDEN_FIELD_PATTERN.search(str(key)):
                raise AssessmentValidationError(f"forbidden_output_field:{path}.{key}")
            assert_no_forbidden_output_fields(sub_value, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            assert_no_forbidden_output_fields(item, f"{path}[{index}]")


def assert_interpretation_boundary(draft: dict, legal_construct_refs: set[str]) -> dict:
    assert_no_forbidden_output_fields(draft)

    boundary_labels = draft.get("boundary_labels", [])
    if "hypothesis_not_fact" not in boundary_labels:
        raise AssessmentValidationError("missing_hypothesis_not_fact_boundary")
    if "recommendation_not_decision" not in boundary_labels:
        raise AssessmentValidationError("missing_recommendation_not_decision_boundary")

    for signal in draft.get("construct_signals", []):
        if signal.get("boundary") != "signal_not_diagnosis":
            raise AssessmentValidationError("construct_signal_missing_boundary")
        if signal.get("construct_ref") not in legal_construct_refs:
            raise AssessmentValidationError(f"construct_ref_not_in_reviewed_registry:{signal.get('construct_ref')}")

    for hypothesis in draft.get("hypotheses", []):
        if hypothesis.get("boundary") != "hypothesis_not_fact":
            raise AssessmentValidationError("hypothesis_missing_boundary")
        for construct_ref in hypothesis.get("construct_refs", []):
            if construct_ref not in legal_construct_refs:
                raise AssessmentValidationError(f"construct_ref_not_in_reviewed_registry:{construct_ref}")

    for action_candidate in draft.get("action_candidates", []):
        if action_candidate.get("boundary") != "recommendation_not_decision":
            raise AssessmentValidationError("action_candidate_missing_boundary")
        # action_ref itself has no whitelist check — port of the TS behavior
        # (recommended_action_map is not checked there either), not an
        # oversight introduced in this port.

    return draft
