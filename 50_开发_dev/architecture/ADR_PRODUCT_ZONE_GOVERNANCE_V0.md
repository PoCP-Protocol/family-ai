# ADR: Product Zone Assessment Governance V0

```text
DOC_KIND        = ADR (Architecture Decision Record)
STATUS          = ACCEPTED — frozen contract for PR-002 (Three-Zone Strategy Engine V0)
DATE            = 2026-08-29
AUTHORIZED_BY   = project-owner (chief-architect PR-002 directive)
SOURCE          = Read-only research agent output (ProductZoneAssessment design-question review,
                  session 2026-08-28), frozen by the Lead Agent per PR-002 Wave 0.
RELATION        = Companion to ADR_PRODUCT_ZONE_SCORING_V0.md (dimension/formula contract);
                  this ADR covers lifecycle, review, and evidence-gating.
```

## 1. Evidence is a hard gate, reusing the existing evidence system

Every `DimensionAssessment` must carry: `dimension`, `score`, `rationale`, `evidence_refs`
(non-empty list), `evidence_strength`, `assessed_by`, `assessed_at`. A dimension score with an empty
`evidence_refs` list is a schema-level validation error, not a soft warning.

**No second evidence system is created.** `evidence_refs` point at the existing
`domains/product_intelligence.domain.entities.Evidence` object (and, transitively, at
`MarketSignal`/`CustomerInsight` records already in that domain) — the same evidence graph the
Signal→ProductConcept chain already uses.

Rule (chief-architect directive, restated as a hard gate): **`NO EVIDENCE → NOT REVIEWABLE`.** An
assessment may be scored (state `SCORED`) with a `recommended_zone` computed, but it cannot enter
`UNDER_REVIEW`/`APPROVED` unless every dimension it used has at least one evidence reference.

## 2. Classification vs. scores — three scores kept, `zone` is a derived label, not an exclusive category

Per the research recommendation (and matching the scoring-model ADR): `commodity_score`,
`advantage_score`, `unique_score` (all three derived from the Differentiation/Defensibility indices —
see scoring ADR §2) are stored independently on every assessment, and are **not mutually exclusive**.
`recommended_zone`/`approved_zone` are single-value fields derived from those three scores via the
frozen classification rule, used for portfolio-level reporting and Human Gate decisions — but the
underlying three scores remain visible so a reviewer can see e.g. "commodity foundation with a genuine
unique layer on top" rather than being forced into one bucket.

**`recommended_zone` and `approved_zone` are two distinct fields, never one field silently overwritten
by the other.** `recommended_zone` is the deterministic classification-rule output (§2 of the scoring
ADR) at scoring time. `approved_zone` is the outcome of Human Review (§4 below) and may differ from
`recommended_zone`; if it does, `override_reason` is a required field, not optional metadata.

## 3. `ZonePolicyVersion` — the mechanism for "recompute, don't rewrite history"

```text
ZonePolicyVersion:
  policy_id
  version
  dimension_definitions   # the direction table in scoring ADR §1.2, versioned
  weights                  # equal-weight in V0 (PROVISIONAL_POLICY_V0), versioned so a future
                           # policy can change weighting without touching this version's records
  thresholds               # UNIQUE=75 / COMMODITY cutoffs=40/40 / floor=50, from scoring ADR §2.1
  classification_rules     # the floor-gated rule itself, as data, not hardcoded in application code
  review_policy             # single-reviewer vs. dual-reviewer requirement — see §4
  effective_from
  status                    # DRAFT | ACTIVE | RETIRED
  checksum                  # deterministic hash of the above, so "same policy version" is verifiable
```

Every `ProductZoneAssessment` records which `zone_policy_version` produced its `recommended_zone`.
**Changing the policy creates a new `ZonePolicyVersion` and re-scores going forward; it never mutates
the `recommended_zone`/scores already stored on a historical assessment.** Same dimension inputs +
same evidence + same policy version must produce the same `recommended_zone` and the same canonical
calculation hash — this is a testable invariant (Agent E), not just a design aspiration.

## 4. Human Review — permission gate and the "double-sign for UNIQUE" question

Extends the PR-001R Permission Pattern (`ActorContext.permissions`) with a new permission:
`product_intelligence.zone.review`.

**Frozen rule**: `approved_zone` can only be set by an actor with `actor_type == "HUMAN"` **and**
`"product_intelligence.zone.review" in permissions`. `AI` and `SYSTEM` actors are forbidden from
approving regardless of any permission string they might carry — identical structure to
`GrowthHypothesis.mark_validated`'s actor-type check in PR-001R.

**Double-sign for UNIQUE, explicitly**: the research agent's answer to "who should review" recommended
dual sign-off (product lead + strategy lead) as a **general** policy for zone review, not a rule
specifically scoped to the UNIQUE tier only. This ADR records that distinction honestly rather than
retrofitting the research to match a narrower question: **the evidence gathered does not specifically
and narrowly support "double-sign only for UNIQUE, single-sign for ADVANTAGE/COMMODITY."** Per the
chief-architect's fallback instruction ("如果证据不足，则先保留 Policy Contract 与测试 fixture，不自行创造经营规则"),
V0 therefore:

- Defines `ZonePolicyVersion.review_policy` as a versioned, configurable field (e.g.
  `{"unique_requires_reviewers": 1}` in the V0 fixture policy — i.e. single-reviewer for all tiers by
  default).
- Builds the domain/application code to **support** a policy value requiring N distinct human reviewers
  (so `two distinct HUMAN reviewers` for UNIQUE is a one-line policy change away, per the
  chief-architect's contingency), with a test fixture proving the mechanism works.
- Does **not** hardcode "UNIQUE always needs two reviewers" as a business rule in this PR, because the
  research doesn't specifically establish that threshold — this is left to a future policy update once
  real review-quality data exists, consistent with the same "don't invent unvalidated business
  parameters" principle as the scoring thresholds in the companion ADR.

**What a reviewer must see**: not just the six scores — a reviewer must be able to open every
`evidence_refs` entry an assessment's scoring relied on. A review action taken without dereferencing
evidence is not something the schema can force, but the API/UI contract (out of scope for this backend
PR) must not make it possible to approve without the evidence being fetched and rendered somewhere in
the review flow. Recorded here so the eventual frontend PR inherits this requirement.

**Re-review cadence**: per the research recommendation, `APPROVED` assessments carry an implicit 6-month
validity window (shorter than a generic annual cycle, because AI-capability and competitive-landscape
shifts in this market are currently fast). On expiry, status does **not** silently auto-invalidate;
schema/query layer marks it `PENDING_RE_REVIEW` so a stale-but-still-referenced approval is visible as
stale, not silently treated as still-current. (V0 implements the state and the query-visible flag;
whether anything auto-triggers on the 6-month boundary is Agent D/Portfolio scope, not a hard requirement
for this ADR.)

## 5. Lifecycle — frozen state machine

```text
DRAFT → SCORED → UNDER_REVIEW → APPROVED
                       ↓
                   REJECTED

APPROVED → RETIRED
```

`DRAFT → APPROVED` directly is illegal (must pass through `SCORED`/`UNDER_REVIEW`). AI/SYSTEM actors
cannot cause any transition into `APPROVED`. Every transition increments `version` and records
`actor_id` / `actor_type` / `timestamp` / `reason` / `trace_id` — same audit-trail shape as
`GrowthHypothesis.mark_validated` in PR-001R, applied consistently rather than invented fresh for this
object.

## 6. AI boundary for V0

`live_model_call_authorized = false` for this PR (per `governance/AUTHORIZATION_REGISTRY.yaml`
`PRODUCT_ZONE_ENGINE_V0_PR002` entry — see Agent F). `assessment_origin` may be `HUMAN | RULE |
AI_PROPOSAL` as a data field, and a mocked `AI_PROPOSAL` origin may be used in contract tests, but no
command or route in this PR calls a real model provider. Real AI-generated zone proposals are explicitly
deferred to a future AI Use Case Registry PR.
