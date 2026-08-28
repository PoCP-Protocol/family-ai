"""Portfolio Zone View — read-model over `ProductZoneAssessment` for a
tenant's whole product portfolio. `architecture/ADR_PRODUCT_ZONE_GOVERNANCE_V0.md`
§4 ("Re-review cadence") assigns the `PENDING_RE_REVIEW` derived flag to
"Agent D/Portfolio-query scope" explicitly — that flag is computed here, not
persisted (see `domain/zone_value_objects.py` `ZoneAssessmentQueryFlag`
docstring for why it is a query-time annotation, not a status value).

Chief-architect directive (relayed in this Agent's task brief, restated here
so a future reader does not have to dig it out of a chat log): "portfolio
query uses `approved_zone`, not unreviewed recommendation" — the three
zone-distribution counts in `PortfolioZoneSummary` are keyed off
`approved_zone` exclusively. An assessment that has been `SCORED` (has a
`recommended_zone`) but never reached `APPROVED` contributes to
`unreviewed_count` only; its `recommended_zone` is visible on the
per-row `PortfolioZoneRow` for a reviewer's benefit, but is never folded
into `commodity_count`/`advantage_count`/`unique_count`. Counting an
unapproved recommendation as if it were a governed classification would let
an AI-proposed or not-yet-human-reviewed score silently drive portfolio-level
reporting — exactly the kind of ungoverned number this ADR pair's Human
Review gate (§4) exists to prevent.

No financial/revenue/profit metric is computed anywhere in this module —
per this Agent's task brief and the ADR's V0 scope, this domain has no
reliable commercial-financial data source wired in yet, and inventing one
(even as a mock) would manufacture a fake operating metric. `PortfolioZoneRow`/
`PortfolioZoneSummary` intentionally carry zero revenue/margin-shaped fields.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from ..domain.zone_entities import ProductZoneAssessment
from ..domain.zone_value_objects import ZONE_DIMENSION_NAMES, ApprovedZone, RecommendedZone, ZoneAssessmentStatus
from .context import ActorContext
from .zone_query_ports import ZonePortfolioQueryPort

# ADR-Governance §4: "an implicit 6-month validity window ... shorter than a
# generic annual cycle". No calendar-month API is used deliberately — 6
# *calendar* months is itself ambiguous (28-31 day months, leap years), and
# the ADR text only ever says "6-month"/"6 months" as an approximation, not
# a day-precise legal deadline. `180 days` is this module's chosen concrete
# approximation of "6 months"; it is NOT a precise calendar-6-months
# calculation (e.g. Feb 28 + 6 calendar months = Aug 28, which is 181 or 182
# days depending on the year) — flagged here plainly per the task brief's
# own instruction to "写清楚这是近似值不是精确日历月".
RE_REVIEW_WINDOW = timedelta(days=180)


@dataclass(frozen=True)
class PortfolioZoneRow:
    """One row of the Portfolio Zone View — one `ProductZoneAssessment`,
    projected to the fields a portfolio-level reviewer needs without having
    to open the full entity. `product_concept_ref` is `subject_ref` renamed
    for readability at this read-model's call sites (V0's only legal
    `subject_type` is `PRODUCT_CONCEPT` — see `zone_entities.py`
    `_subject_type_is_v0_fixed` — so "product concept ref" is an accurate,
    not just convenient, name here)."""

    assessment_id: str
    product_concept_ref: str
    approved_zone: ApprovedZone | None
    recommended_zone: RecommendedZone
    dimension_scores: dict[str, float]
    differentiation_index: float
    defensibility_index: float
    zone_policy_version_id: str
    evidence_coverage: float
    """Fraction (0.0-1.0) of the six frozen dimensions
    (`zone_value_objects.ZONE_DIMENSION_NAMES`) whose `DimensionAssessment`
    has a non-empty `evidence_refs` list. Not a boolean: the ADR-Governance
    §1 hard gate already forces `evidence_refs` non-empty at the
    `DimensionAssessment` schema level (see `zone_entities.py`
    `_evidence_refs_non_empty`), so for any assessment that has actually
    been scored via the real `score_zone_assessment` command this will
    always read `1.0`. It is computed as a fraction rather than hardcoded
    to `1.0`/collapsed to a bool anyway, for two reasons: (1) defense in
    depth — this read-model should not silently assume every row it is ever
    handed came through that one command path (e.g. a future ingestion path,
    or a still-`DRAFT` row with placeholder dimension rows that happen to
    carry a non-empty-but-placeholder ref — see `zone_commands.py`'s own
    documented caveat about the `"pending_initial_assessment"` placeholder
    ref string); (2) a fraction is strictly more informative to a reviewer
    than a bool with no loss of information (`== 1.0` recovers the bool)."""
    review_status: ZoneAssessmentStatus
    is_pending_re_review: bool
    """`True` iff `approved_zone is not None and reviewed_at is not None`
    and `now - reviewed_at > RE_REVIEW_WINDOW` (180 days, see module
    docstring). Mirrors `ZoneAssessmentQueryFlag` ("PENDING_RE_REVIEW") from
    `domain/zone_value_objects.py` as a computed field on this read-model,
    per that module's explicit assignment of the computation to
    "Agent D/Portfolio-query scope"."""


@dataclass(frozen=True)
class PortfolioZoneSummary:
    """Tenant-wide zone distribution. Counts are mutually exclusive and sum
    to the total number of assessments in the portfolio:
    `commodity_count + advantage_count + unique_count + unreviewed_count ==
    len(rows)`. See module docstring for why the three zone counts are keyed
    off `approved_zone`, never `recommended_zone`."""

    commodity_count: int = 0
    advantage_count: int = 0
    unique_count: int = 0
    unreviewed_count: int = 0
    """Every assessment with `approved_zone is None` — this includes
    `DRAFT`, `SCORED` (has a `recommended_zone` but no human approval yet),
    `UNDER_REVIEW`, and `REJECTED` assessments alike. `REJECTED` is counted
    here rather than excluded outright: a rejected assessment's
    `approved_zone` is still `None` (rejection does not set it — see
    `zone_entities.py`/`zone_commands.py`; only `APPROVED` sets
    `approved_zone`), so by the stated counting rule ("no approved_zone ->
    unreviewed") it falls into this bucket. If the chief architect wants
    `REJECTED` broken out as its own bucket instead of folded into
    `unreviewed_count`, that is the one open question this Agent is flagging
    rather than deciding unilaterally — see this PR's completion report.
    """
    pending_re_review_count: int = 0
    """Not part of the four-way partition above (a `PENDING_RE_REVIEW`
    assessment is still `APPROVED` and already counted in one of the three
    zone buckets) — a separate, overlapping count surfaced because
    ADR-Governance §4 explicitly wants staleness "visible... not silently
    treated as still-current" at the portfolio level, not just on the
    single-row view."""
    total_count: int = 0


def _evidence_coverage(assessment: ProductZoneAssessment) -> float:
    covered = sum(1 for d in assessment.dimension_assessments if d.evidence_refs)
    total = len(ZONE_DIMENSION_NAMES)
    return covered / total if total else 0.0


def _is_pending_re_review(assessment: ProductZoneAssessment, *, now: datetime) -> bool:
    if assessment.approved_zone is None or assessment.reviewed_at is None:
        return False
    return (now - assessment.reviewed_at) > RE_REVIEW_WINDOW


def _to_row(assessment: ProductZoneAssessment, *, now: datetime) -> PortfolioZoneRow:
    return PortfolioZoneRow(
        assessment_id=assessment.id,
        product_concept_ref=assessment.subject_ref,
        approved_zone=assessment.approved_zone,
        recommended_zone=assessment.recommended_zone,
        dimension_scores=assessment.dimension_score_map(),
        differentiation_index=assessment.differentiation_index,
        defensibility_index=assessment.defensibility_index,
        zone_policy_version_id=assessment.zone_policy_version_id,
        evidence_coverage=_evidence_coverage(assessment),
        review_status=assessment.status,
        is_pending_re_review=_is_pending_re_review(assessment, now=now),
    )


async def get_portfolio_zone_view(
    port: ZonePortfolioQueryPort, context: ActorContext, *, now: datetime,
) -> list[PortfolioZoneRow]:
    """`now` is caller-supplied (never `datetime.now()` internally) so the
    180-day re-review boundary is deterministically testable — per this
    Agent's task brief instruction to keep this function free of
    non-reproducible wall-clock calls."""
    assessments = await port.list_zone_assessments(context.tenant_scope)
    return [_to_row(a, now=now) for a in assessments]


async def get_portfolio_zone_summary(
    port: ZonePortfolioQueryPort, context: ActorContext, *, now: datetime,
) -> PortfolioZoneSummary:
    assessments = await port.list_zone_assessments(context.tenant_scope)

    commodity_count = 0
    advantage_count = 0
    unique_count = 0
    unreviewed_count = 0
    pending_re_review_count = 0

    for assessment in assessments:
        if assessment.approved_zone is None:
            unreviewed_count += 1
        elif assessment.approved_zone == "COMMODITY":
            commodity_count += 1
        elif assessment.approved_zone == "ADVANTAGE":
            advantage_count += 1
        elif assessment.approved_zone == "UNIQUE":
            unique_count += 1

        if _is_pending_re_review(assessment, now=now):
            pending_re_review_count += 1

    return PortfolioZoneSummary(
        commodity_count=commodity_count,
        advantage_count=advantage_count,
        unique_count=unique_count,
        unreviewed_count=unreviewed_count,
        pending_re_review_count=pending_re_review_count,
        total_count=len(assessments),
    )
