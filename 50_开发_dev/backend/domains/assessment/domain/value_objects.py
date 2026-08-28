"""Value objects for the Assessment domain.

Ported from `packages/contracts/src/ui02-assessment.ts` (UI-02) and the UI-03
`Ui03GrowthHypothesis*` types in `packages/contracts/src/index.ts`. This module
has no FastAPI / SQLAlchemy / provider-SDK dependency — see
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

AssessmentResponseType = Literal["SINGLE_CHOICE", "TEXT", "BOOLEAN"]
Ui02AssessmentAvailability = Literal["AVAILABLE", "CONSENT_REQUIRED", "NO_SUBJECT", "POLICY_BLOCKED"]


class AssessmentSessionStatus(str, Enum):
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    EXITED = "EXITED"


class AssessmentToolBoundary(BaseModel):
    """Ported verbatim from Ui02AssessmentTool['boundary'] — every field is a
    fixed literal, not configurable. This is the fact-boundary contract for
    the assessment tool itself, independent of any AI interpretation layer.
    """

    truth_class: Literal["FAMILY_PERSPECTIVE"] = "FAMILY_PERSPECTIVE"
    not_a_score: Literal[True] = True
    not_a_diagnosis: Literal[True] = True
    no_eligibility_effect: Literal[True] = True
    withdrawable: Literal[True] = True
    training_use: Literal[False] = False


class AssessmentToolItem(BaseModel):
    item_ref: str
    response_type: AssessmentResponseType
    required: bool
    options: list[str] | None = None


class AssessmentTool(BaseModel):
    tool_ref: str
    version_no: int
    title: str
    purpose: str
    evidence_level: Literal["E1"] = "E1"
    schema_ref: str
    items: list[AssessmentToolItem]
    boundary: AssessmentToolBoundary = Field(default_factory=AssessmentToolBoundary)

    def find_item(self, item_ref: str) -> AssessmentToolItem | None:
        return next((item for item in self.items if item.item_ref == item_ref), None)


class AssessmentResponseValue(BaseModel):
    """A single response value — string, boolean, or (rare) numeric text."""

    value: str | bool


MutationReceiptAction = Literal["START_ASSESSMENT", "SAVE_ASSESSMENT_RESPONSE", "SUBMIT_ASSESSMENT"]
MUTATION_RECEIPT_BOUNDARY: Literal["FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS"] = (
    "FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS"
)

GrowthHypothesisDecisionType = Literal["CONFIRM", "DISMISS"]
HYPOTHESIS_FACT_BOUNDARY: Literal["HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS"] = "HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS"
GROWTH_INTENT_BOUNDARY: Literal["HUMAN_CONFIRMED_INTENT_NOT_OUTCOME"] = "HUMAN_CONFIRMED_INTENT_NOT_OUTCOME"

# Consent purposes required before the Growth main loop may run on a
# subject. Project owner decided (2026-08-28) to align the Assessment
# domain's consent gate with the Growth main loop's three-purpose set
# (previously Assessment checked only ASSESSMENT — a deliberately narrower
# gate in the NestJS source; the owner chose to tighten it to the full set).
# Kept as a domain-local constant (not imported from the Consent domain) per
# the four-layer domain-isolation rule; same value set as
# `consent.domain.value_objects.REQUIRED_GROWTH_CONSENT_PURPOSES`.
REQUIRED_GROWTH_CONSENT_PURPOSES: tuple[str, ...] = ("SERVICE", "ASSESSMENT", "GROWTH_TRACKING")
