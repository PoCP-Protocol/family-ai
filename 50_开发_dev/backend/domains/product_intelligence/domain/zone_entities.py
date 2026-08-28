"""Product Zone (Three-Zone Strategy Engine) entities.

Frozen contract source: `architecture/ADR_PRODUCT_ZONE_SCORING_V0.md` and
`architecture/ADR_PRODUCT_ZONE_GOVERNANCE_V0.md`. See `zone_value_objects.py`
module docstring for the same caveat: this is a Wave-0-frozen contract, not a
draft.

This module has no FastAPI/SQLAlchemy dependency — same four-layer rule as
`entities.py` in this domain. It intentionally does not replace or subclass
the placeholder `ProductZoneAssessment` in `entities.py` (that class predates
this ADR pair and is out of this Agent's file ownership per the PR-002 task
split — Agent C/infrastructure decides how/whether to retire it when wiring
persistence); this module defines the ADR-accurate version under its own
name so downstream (application/infrastructure) code has one unambiguous
import to move to.

Scoring math (index/score computation, zone classification) intentionally
does NOT live here — see `zone_scoring_engine.py`. Entities only hold data
and validate structural invariants (shape, non-emptiness, required
cross-field consistency); they do not compute derived numbers themselves,
per the task brief ("computed by the scoring engine, not by the constructor").
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator, model_validator

from .entities import _CommonFields
from .errors import ProductIntelligenceValidationError
from .zone_value_objects import (
    ZONE_DIMENSION_NAMES,
    AssessmentOrigin,
    ApprovedZone,
    RecommendedZone,
    ZoneAssessmentStatus,
    ZoneDimensionName,
)


def _require_non_empty_str(value: str, field_name: str) -> str:
    if not value or not value.strip():
        raise ProductIntelligenceValidationError(f"{field_name}_must_not_be_empty")
    return value


class DimensionAssessment(BaseModel):
    """One scored dimension out of the six frozen in ADR-Scoring §1.2.

    `evidence_refs` non-emptiness is a hard schema-level gate per
    ADR-Governance §1 ("A dimension score with an empty `evidence_refs` list
    is a schema-level validation error, not a soft warning") — enforced here
    via `field_validator`, not deferred to the scoring engine or application
    layer.
    """

    dimension: ZoneDimensionName
    score: float = Field(ge=0.0, le=100.0)
    rationale: str
    evidence_refs: list[str]
    evidence_strength: float = Field(default=0.5, ge=0.0, le=1.0)
    """ADR-Scoring §3 leaves the exact representation to this PR
    ("expected evidence type" table, no schema mandate beyond "at least one
    ref required"). V0 chooses a normalized `[0, 1]` float — 0 = weakest
    plausible evidence, 1 = strongest (e.g. third-party-verified longitudinal
    data) — rather than a free-form string, so a future policy/weights change
    (ADR-Governance §3 `weights`) has a numeric field to key off of without a
    schema migration. Default `0.5` (neutral/unstated) is a placeholder, not
    a claim about typical evidence quality.
    """
    assessed_by: str
    assessed_at: datetime

    @field_validator("rationale")
    @classmethod
    def _rationale_non_empty(cls, value: str) -> str:
        return _require_non_empty_str(value, "rationale")

    @field_validator("assessed_by")
    @classmethod
    def _assessed_by_non_empty(cls, value: str) -> str:
        return _require_non_empty_str(value, "assessed_by")

    @field_validator("evidence_refs")
    @classmethod
    def _evidence_refs_non_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ProductIntelligenceValidationError("dimension_assessment_requires_evidence_refs")
        return value

    @field_validator("assessed_at")
    @classmethod
    def _assessed_at_is_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ProductIntelligenceValidationError("assessed_at_must_be_timezone_aware")
        return value


class ZonePolicyVersion(BaseModel):
    """ADR-Governance §3 — "the mechanism for recompute, don't rewrite
    history". Every field listed there is represented verbatim; `checksum`
    is a deterministic sha256 over the policy-defining fields (excludes
    `policy_id`/`effective_from`/`status`, which are identity/lifecycle
    metadata about the version, not part of what is being hashed — two
    policy versions with identical rules but different `policy_id`/
    `effective_from` would otherwise get different checksums for no
    substantive reason).
    """

    policy_id: str
    version: int = Field(ge=1)
    dimension_definitions: dict[str, str]
    """Direction table from ADR-Scoring §1.2, versioned as data — e.g.
    `{"customer_scarcity": "positive", "replaceability": "negative", ...}`.
    """
    weights: dict[str, float]
    """ADR-Scoring §2: equal-weight in V0 (`PROVISIONAL_POLICY_V0`), but kept
    as policy data (not hardcoded in the scoring engine) so a future policy
    can change weighting without touching historical assessments' stored
    results (ADR-Governance §3)."""
    thresholds: dict[str, float]
    """ADR-Scoring §2.1 fixture values, e.g.
    `{"unique_defensibility_min": 75.0, "unique_floor_gate_min": 50.0,
    "commodity_differentiation_max": 40.0, "commodity_defensibility_max": 40.0}`.
    `zone_scoring_engine.classify_zone` reads these keys — see that module's
    docstring for the exact key names it expects."""
    classification_rules: str
    """The floor-gated classification rule, recorded as data (a human-
    readable rule description/DSL string) alongside the executable
    implementation in `zone_scoring_engine.classify_zone`, per
    ADR-Governance §3 ("the floor-gated rule itself, as data, not hardcoded
    in application code"). V0 does not build a rule-interpreter — the
    executable behavior is `classify_zone`; this field is the audit-trail
    description of that behavior for a given policy version, so a reviewer
    can read what a version *claims* to do without reading Python."""
    review_policy: dict[str, int]
    """ADR-Governance §4, e.g. `{"unique_requires_reviewers": 1}` in the V0
    fixture (single-reviewer default for every tier — the ADR is explicit
    that the research does not establish a UNIQUE-only double-sign rule, so
    V0 ships the mechanism as configurable policy data, not a hardcoded
    business rule)."""
    effective_from: datetime
    status: str = Field(default="DRAFT")
    """`DRAFT | ACTIVE | RETIRED` per ADR-Governance §3. Kept as a plain
    `str` (not a `Literal`) here deliberately: policy lifecycle is a distinct,
    much simpler state machine from `ZoneAssessmentStatus` and this PR does
    not need to over-formalize it; validated to be one of the three values
    below so a typo is still caught."""
    checksum: str | None = None
    """Populated by `compute_checksum()` if left `None` at construction —
    see `model_validator` below. Exposed as a field (not a computed
    `@property`) so it can be persisted verbatim and compared later without
    recomputation, per ADR-Governance §3's "so 'same policy version' is
    verifiable"."""

    @field_validator("status")
    @classmethod
    def _status_is_legal(cls, value: str) -> str:
        if value not in {"DRAFT", "ACTIVE", "RETIRED"}:
            raise ProductIntelligenceValidationError("zone_policy_version_status_illegal")
        return value

    @field_validator("policy_id")
    @classmethod
    def _policy_id_non_empty(cls, value: str) -> str:
        return _require_non_empty_str(value, "policy_id")

    def compute_checksum(self) -> str:
        """Deterministic sha256 over the policy-defining fields, JSON-encoded
        with sorted keys so field/dict-key ordering never changes the hash.
        Excludes `checksum` itself (obviously), `policy_id`, `effective_from`,
        and `status` — see class docstring for why those are excluded.
        """
        payload = {
            "version": self.version,
            "dimension_definitions": self.dimension_definitions,
            "weights": self.weights,
            "thresholds": self.thresholds,
            "classification_rules": self.classification_rules,
            "review_policy": self.review_policy,
        }
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @model_validator(mode="after")
    def _fill_checksum_if_missing(self) -> "ZonePolicyVersion":
        if self.checksum is None:
            object.__setattr__(self, "checksum", self.compute_checksum())
        return self


class ProductZoneAssessment(_CommonFields):
    """ADR-Scoring + ADR-Governance's `ProductZoneAssessment`. Distinct from
    (and not a replacement for) the placeholder class of the same short name
    still defined in `entities.py` — see this module's docstring.
    """

    status: ZoneAssessmentStatus = "DRAFT"
    subject_type: str = "PRODUCT_CONCEPT"
    subject_ref: str
    zone_policy_version_id: str
    dimension_assessments: list[DimensionAssessment]
    differentiation_index: float
    defensibility_index: float
    commodity_score: float
    advantage_score: float
    unique_score: float
    recommended_zone: RecommendedZone
    approved_zone: ApprovedZone | None = None
    override_reason: str | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    review_reason: str | None = None
    assessment_origin: AssessmentOrigin = "RULE"

    @field_validator("subject_type")
    @classmethod
    def _subject_type_is_v0_fixed(cls, value: str) -> str:
        # ADR-Scoring §1.1: the only legal subject_type in V0 is
        # PRODUCT_CONCEPT. Component/ProductDefinition/AIUseCase/Capability
        # are explicitly out of scope for this PR.
        if value != "PRODUCT_CONCEPT":
            raise ProductIntelligenceValidationError("zone_assessment_subject_type_must_be_product_concept")
        return value

    @field_validator("subject_ref", "zone_policy_version_id")
    @classmethod
    def _refs_non_empty(cls, value: str, info) -> str:
        return _require_non_empty_str(value, info.field_name)

    @field_validator("dimension_assessments")
    @classmethod
    def _dimension_assessments_cover_all_six_exactly_once(
        cls, value: list[DimensionAssessment], info
    ) -> list[DimensionAssessment]:
        # Integration fix (PR-002, flagged by Agent B's "Cross-Agent interface
        # note" in application/zone_commands.py): a DRAFT assessment has not
        # been scored yet — ADR-Governance frames DRAFT as "not yet scored" —
        # so it may legitimately have zero dimension_assessments. Forcing six
        # placeholder rows (the original workaround) meant a fake, always-
        # non-empty evidence_refs=["pending_initial_assessment"] value could
        # satisfy the "no evidence -> not reviewable" gate elsewhere by
        # accident. From SCORED onward, the exactly-six-unique rule is
        # unconditional, same as before.
        status = info.data.get("status")
        if status == "DRAFT" and len(value) == 0:
            return value
        if len(value) != 6:
            raise ProductIntelligenceValidationError("zone_assessment_requires_exactly_six_dimension_assessments")
        seen = [d.dimension for d in value]
        if len(set(seen)) != 6 or set(seen) != ZONE_DIMENSION_NAMES:
            raise ProductIntelligenceValidationError("zone_assessment_dimension_assessments_must_cover_all_six_uniquely")
        return value

    @model_validator(mode="after")
    def _override_reason_required_when_approved_zone_diverges(self) -> "ProductZoneAssessment":
        if self.approved_zone is not None and self.approved_zone != self.recommended_zone and not self.override_reason:
            raise ProductIntelligenceValidationError("zone_assessment_override_requires_override_reason")
        return self

    def dimension_score_map(self) -> dict[str, float]:
        """Convenience accessor used by callers (e.g. the scoring engine's
        caller, or a future review UI) that need `{dimension: score}` rather
        than the full `DimensionAssessment` objects. Pure, no side effects.
        """
        return {d.dimension: d.score for d in self.dimension_assessments}

    def transition_to(
        self,
        *,
        new_status: ZoneAssessmentStatus,
        actor_id: str,
        reason: str | None = None,
    ) -> "ProductZoneAssessment":
        """Apply a lifecycle transition per ADR-Governance §5, returning a new
        (version-bumped) instance. This method only enforces the *shape* of
        the transition (legal from/to per
        `zone_value_objects.ZONE_ASSESSMENT_STATUS_TRANSITIONS`,
        evidence-gate for entering `UNDER_REVIEW`/`APPROVED`, and the
        `approved_zone`/`override_reason` pairing). It deliberately does NOT
        check `actor_type`/permissions (`product_intelligence.zone.review`)
        — that is the application layer's (Agent B's) responsibility, per
        this Agent's task-brief scope ("you only manage the legality of the
        state transition, not who has authority to invoke it").
        """
        from .zone_value_objects import is_legal_zone_status_transition

        if not is_legal_zone_status_transition(self.status, new_status):
            raise ProductIntelligenceValidationError("zone_assessment_illegal_status_transition")

        if new_status in ("UNDER_REVIEW", "APPROVED"):
            # ADR-Governance §1: "NO EVIDENCE -> NOT REVIEWABLE". An
            # unscored DRAFT (0 dimension_assessments, per the integration
            # fix above) must never reach here either — `any()` over an
            # empty list is vacuously False, so the length check is
            # required in addition to the per-dimension evidence check, not
            # redundant with it.
            if len(self.dimension_assessments) != 6 or any(not d.evidence_refs for d in self.dimension_assessments):
                raise ProductIntelligenceValidationError("zone_assessment_missing_evidence_not_reviewable")

        now = datetime.now(timezone.utc)
        update: dict[str, object] = {
            "status": new_status,
            "updated_at": now,
            "version": self.version + 1,
        }
        if new_status in ("APPROVED", "REJECTED"):
            update["reviewed_by"] = actor_id
            update["reviewed_at"] = now
            update["review_reason"] = reason
        return self.model_copy(update=update)
