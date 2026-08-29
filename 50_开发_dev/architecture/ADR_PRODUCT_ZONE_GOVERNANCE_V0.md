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
PR-002R UPDATE  = 2026-08-29 chief-architect closure ruling on PR #37 (canonical-model
                  cleanup, Portfolio semantics, Active Policy uniqueness). §0, §3.1, §5.1, and
                  §7 below are new, frozen sections added by this closure pass; the §4
                  double-sign passage has one reaffirmation paragraph appended; all other
                  sections/content are unchanged from the original PR-002 ADR text.
```

## 0. Canonical model — one `ProductZoneAssessment`, not two

**Frozen ruling (PR-002R, chief-architect review of PR #37):** `domain/zone_entities.py::
ProductZoneAssessment` is the **one and only** canonical `ProductZoneAssessment` for the
Product Intelligence domain. It is the ADR-accurate type described throughout this document
and the companion Scoring ADR, backed by the `product_intelligence_zone_assessments_v0` table
(`0059_product_zone_engine_v0.sql`).

A second, pre-ADR placeholder class of the same name previously existed in
`domain/entities.py` (created in PR-001, before this ADR was frozen). It was never referenced
by any application-layer command, route, or real caller — only by the port/fake/SQLAlchemy
repository plumbing that defined it — and it scored/classified nothing per this ADR's rules.
PR-002R deleted that placeholder class from the code and dropped its corresponding table
(`product_intelligence_zone_assessments`) via `0060_product_zone_engine_canonical_cleanup.sql`.
There is no longer a second `ProductZoneAssessment` anywhere in this repository. Any future
code, test, or migration that needs to reference "the" `ProductZoneAssessment` type means
`domain/zone_entities.py::ProductZoneAssessment` — full stop, no disambiguation required.

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

### 3.1 Active Policy uniqueness — frozen ruling (PR-002R)

**At most one `ZonePolicyVersion` with `status == "ACTIVE"` may exist for a given `policy_id` at
any point in time.** This is enforced twice, deliberately redundant rather than relying on either
layer alone:

- **Application layer (fail-closed read)**: `load_active_zone_policy_version` groups candidate
  rows by `policy_id` and raises rather than returning a result if more than one `ACTIVE` row is
  found for the same `policy_id`. It must never silently pick "the first match" when the
  underlying data is inconsistent — a data-layer violation of this invariant is treated as a
  hard error, not degraded gracefully.
- **Database layer (structural prevention)**: a partial unique index,
  `uq_zone_policy_active_per_id` on `product_intelligence_zone_policy_versions (policy_id) WHERE
  status = 'ACTIVE'` (added by `0060_product_zone_engine_canonical_cleanup.sql`), makes it
  structurally impossible for two rows sharing a `policy_id` to both be written as `ACTIVE`.
  Unlimited `DRAFT`/`RETIRED` rows per `policy_id` remain allowed (normal version history).

The database index is the primary defense (it prevents the bad state from ever being written);
the application-layer fail-closed check is defense-in-depth for any backend/environment not yet
migrated to that index, or a direct DB write that bypassed it. Scoped to `(policy_id)`, not
global — this ADR does not (yet) require "only one ACTIVE policy in the entire table across all
`policy_id` lineages"; that would be a separate, stronger rule left to a future ADR if a
chief-architect ruling asks for it.

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

**Reaffirmed unchanged by PR-002R**: the canonical-model/Portfolio/Active-Policy closure work in this
PR-002R pass did not touch review-policy semantics, and this ruling is restated here, still current,
so that no reader mistakes the silence on this topic elsewhere in the closure diff for a reversal.
V0 ships with single-reviewer review for **all** tiers (`unique_requires_reviewers: 1` in the fixture
policy) — dual-sign remains a supported, versioned `review_policy` capability, not an enabled default,
and not a UNIQUE-specific hardcoded rule.

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

### 5.1 Portfolio bucket mapping — frozen ruling (PR-002R), no double-counting, no gaps

**Frozen ruling**: the six `ZoneAssessmentStatus` values map onto exactly six Portfolio summary
buckets, one status to one bucket, with no assessment ever counted twice and none silently dropped:

| `status` | Portfolio bucket | Notes |
|---|---|---|
| `DRAFT` | `unreviewed_count` | Not yet scored; no `recommended_zone` reliably available. |
| `SCORED` | `unreviewed_count` | Has a `recommended_zone`, but not yet through Human Review. |
| `UNDER_REVIEW` | `unreviewed_count` | Pending review; still not `commodity`/`advantage`/`unique`. |
| `APPROVED` | `commodity_count` / `advantage_count` / `unique_count` (exactly one, by `approved_zone`) | The **only** status that can populate the three zone-specific buckets — per §2, a Portfolio-level zone bucket reflects a human-approved decision, not a bare `recommended_zone`. |
| `REJECTED` | `rejected_count` | **Own bucket, independent of `unreviewed_count`.** Superseding prior draft/informal language: a rejected assessment already went through review and was declined — it is not "still pending review" and must not inflate `unreviewed_count`. It also never sets `approved_zone`, so it cannot leak into `commodity`/`advantage`/`unique_count` either. |
| `RETIRED` | `retired_count` | **Own bucket, excluded from every "currently active" bucket** — `commodity_count`, `advantage_count`, `unique_count`, **and** `unreviewed_count`. A `RETIRED` assessment was `APPROVED` at some point in its history (§5's state machine only allows `APPROVED → RETIRED`) but is no longer a live portfolio position; treating it as still-unreviewed or still-approved-into-a-zone would both misrepresent the current portfolio. |

Invariant (must hold for every Portfolio summary, tested as a hard assertion, not just a
convention): `commodity_count + advantage_count + unique_count + unreviewed_count + rejected_count +
retired_count == total_count == len(assessments)` — every assessment lands in exactly one bucket,
never zero, never more than one. This closes prior draft language that risked folding `REJECTED`
into `unreviewed_count` (an assessment that has already been decided is not "unreviewed") — that
folding is explicitly rejected by this ruling.

## 6. AI boundary for V0

`live_model_call_authorized = false` for this PR (per `governance/AUTHORIZATION_REGISTRY.yaml`
`PRODUCT_ZONE_ENGINE_V0_PR002` entry — see Agent F). `assessment_origin` may be `HUMAN | RULE |
AI_PROPOSAL` as a data field, and a mocked `AI_PROPOSAL` origin may be used in contract tests, but no
command or route in this PR calls a real model provider. Real AI-generated zone proposals are explicitly
deferred to a future AI Use Case Registry PR.

## 7. Cross-tenant subject-reference guard — DB trigger is defense-in-depth, not the primary fix

`0059_product_zone_engine_v0.sql` adds a Postgres-only `PL/pgSQL` trigger
(`trg_zone_assessment_subject_tenant_guard` /
`product_intelligence_zone_assessment_subject_tenant_guard()`) on
`product_intelligence_zone_assessments_v0` that rejects any INSERT/UPDATE whose `subject_ref` points
at a `ProductConcept` row belonging to a different `tenant_scope` than the assessment's own
`tenant_scope`. This closes, at the database layer, the same gap `application/zone_commands.py`
already documents on `create_zone_assessment`: a plain foreign key proves `subject_ref` references a
*real* `ProductConcept`, but not that it belongs to *this assessment's own tenant*.

**This trigger is a backstop, not the primary fix.** The primary fix is the application-layer call in
`application/zone_commands.py::create_zone_assessment`, which calls the repository's tenant-scoped
`load_product_concept(product_concept_id, context.tenant_scope)` before ever constructing the
assessment — an application-layer cross-tenant reference is rejected before a row is ever written, not
caught after the fact by the database. The trigger exists for defense-in-depth (e.g. a direct DB write,
or a future code path that bypasses `create_zone_assessment`), and because it is Postgres-only, the
SQLite-backed pytest suite in this PR does not exercise it — it can only be verified against a real
Postgres instance, which is Agent D's real-Postgres/adversarial-verification scope for this closure
pass, not something this ADR itself certifies as tested.
