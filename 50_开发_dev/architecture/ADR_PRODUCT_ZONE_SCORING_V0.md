# ADR: Product Zone Scoring Model V0

```text
DOC_KIND        = ADR (Architecture Decision Record)
STATUS          = ACCEPTED — frozen contract for PR-002 (Three-Zone Strategy Engine V0)
DATE            = 2026-08-29
AUTHORIZED_BY   = project-owner (chief-architect PR-002 directive, "MASTER TASK FAMILY-AI-PRODUCT-OS-PR002")
SOURCE          = Read-only research agent output (Three-Zone Score Model theory review, session
                  2026-08-28), frozen by the Lead Agent per PR-002 Wave 0 before any production code
                  was written.
```

## 1. Decision

V0 freezes the following contract before any Agent (A–F) writes production code. Changing it after
Wave 0 requires a new ADR, not a code-review comment.

### 1.1 Subject type (V0 scope)

The only legal `subject_type` in V0 is **`PRODUCT_CONCEPT`** — i.e. `ProductZoneAssessment.subject_ref`
must reference a `domains/product_intelligence` `ProductConcept.id`. `ProductComponent`,
`ProductDefinition`, `AIUseCase`, and `Capability` are explicitly out of scope for V0 (chief-architect
directive: "V0 只评 ProductConcept，不顺手把 Component、AI Use Case、ProductDefinition 全部拉进来" —
those objects currently only have structural shells in `domains/product_intelligence`, not their own
authorized PR, so scoring them would create decisions with no corresponding governed object behind
them).

Research note (recorded for the future, not acted on in V0): the research agent recommended evaluating
at both a Product level and a cross-product Capability level, and explicitly recommended *against*
evaluating Component/AIUseCase individually (too fine-grained to drive an investment decision). V0's
`PRODUCT_CONCEPT`-only scope is narrower than that recommendation (no Capability-level assessment yet)
— this is a deliberate PR-002 scope cut, not a rejection of the research; a future PR may add
`CAPABILITY` as a second `subject_type` on the same object once `domains/product_intelligence` has a
real Capability object to reference.

### 1.2 Six dimensions — semantics frozen

All six dimensions are scored `0..100`. **Direction matters and is not uniform**:

| Dimension | Direction | Meaning at 100 |
|---|---|---|
| `customer_scarcity` | positive | Extremely scarce, hard-to-reach customer base |
| `replaceability` | **negative** | Extremely easy to replace with an alternative |
| `data_advantage` | positive | Extremely strong proprietary/hard-to-replicate data position |
| `network_effect` | positive | Extremely strong network effect (value grows superlinearly with users) |
| `learning_effect` | positive | Extremely strong learning/experience-curve improvement over use |
| `switching_cost` | positive | Extremely high cost for a customer to switch away |

`replaceability` is the only negative-direction dimension. Every place that consumes it for scoring must
use `inverse_replaceability = 100 - replaceability`, not `replaceability` directly. No page or command
may reinterpret what "100" means for any dimension — this table is the single source of truth.

### 1.3 Dimension independence — known non-independence, not treated as a bug to "fix" in V0

Per the research agent's findings, these dimension pairs are **not independent** and must not be
weighted as if they were:

- `data_advantage` and `learning_effect` are highly collinear (data accumulation and learning-effect
  improvement are usually two observations of the same causal chain).
- `network_effect` and `customer_scarcity` are causally linked in platform-type products (strong network
  effects tend to produce scarce, locked-in customer bases as a downstream effect, not two independent
  causes).
- `replaceability` and `switching_cost` measure substantially the same underlying property from two
  angles (low replaceability and high switching cost are close to the same fact restated).

**V0 decision**: do not attempt a factor-analysis/PCA-based de-correlation in this PR — that requires
real historical data this platform does not have yet. Instead, V0 uses the two-index structure in §2
specifically *because* it groups the collinear dimensions together rather than pretending all six are
orthogonal. The known non-independence is documented here so a future PR with real data can properly
validate or replace the two-index model, not silently forgotten.

## 2. Scoring model (deterministic, not an LLM black box)

```text
inverse_replaceability = 100 - replaceability

Differentiation Index = (w_cs * customer_scarcity + w_repl * inverse_replaceability) / (w_cs + w_repl)

Defensibility Index = (w_da*data_advantage + w_ne*network_effect + w_le*learning_effect + w_sc*switching_cost)
                       / (w_da + w_ne + w_le + w_sc)
```

where `w_*` are the per-dimension weights read from `ZonePolicyVersion.weights` (never hardcoded in the
engine). **Closure fix** (chief-architect review, 2026-08-29): `weights` previously existed on
`ZonePolicyVersion` and was checksummed but never actually read by the scoring engine — every policy
version produced identical scores regardless of `weights`. The engine now computes a **normalized
weighted average within each of the two independent groups** above:

- Differentiation group: `{customer_scarcity, replaceability}` — the `replaceability` weight applies to
  `inverse_replaceability`, per §1.2's direction rule, not to raw `replaceability`.
- Defensibility group: `{data_advantage, network_effect, learning_effect, switching_cost}`.

Each group's weighted average divides by **that group's own weight sum**, not a global sum across all
six dimensions — this makes the formula scale-invariant within a group (doubling every weight in a
group leaves that group's index unchanged) and keeps the two groups normalized independently: changing
the relative weight between `customer_scarcity` and `replaceability` changes `Differentiation Index` but
has no effect on `Defensibility Index`, and vice versa. This matches §1.3's framing of the two-index
structure as a deliberate grouping of collinear dimensions, not one global six-way weighted sum.

`ZonePolicyVersion.weights` must contain all six dimension keys with values `>= 0` (fail-closed —
`ProductIntelligenceValidationError` — otherwise); a group whose weights sum to exactly `0` is also
fail-closed (division-by-zero guard) rather than silently producing a `NaN`/undefined index.

V0's default/fixture policy (`PROVISIONAL_POLICY_V0`) sets every weight to `1.0`, which — after
normalization — reduces exactly to the original equal-weighted `/2` and `/4` averages. This is **not**
because equal weighting is known to be correct, but because no real historical data exists yet to
justify any other weighting scheme (per the project-owner's standing rule against inventing business
parameters without evidence — see `CLAUDE.md` §4 and prior PR-001R decisions). This is recorded as
`PROVISIONAL_POLICY_V0` in `ZonePolicyVersion` (see ADR-Governance §2), not as a scientifically
validated formula; only a *non-default* policy (different relative weights) changes scoring output
from V0's original all-equal-weighting behavior.

### 2.0.1 Scoring-algorithm version — traceable, not implicit

`ZonePolicyVersion.scoring_algorithm_version` (default `"ZONE_SCORING_V0"`) records which version of the
scoring engine (`compute_differentiation_index` / `compute_defensibility_index` / `compute_three_scores` /
`classify_zone` as a bundle) a policy version's results were computed under. `score_assessment` checks
this value against an engine-side allowlist (`zone_scoring_engine._SUPPORTED_ALGORITHM_VERSIONS`) and
fails closed (`ProductIntelligenceValidationError`) if it does not recognize it. This exists so a future
`ZONE_SCORING_V1` engine cannot silently reinterpret an old `ZONE_SCORING_V0` policy (or vice versa)
under a formula it was never validated against — the ADR's own framing that anything influencing the
result must be "either policy data or a traceable algorithm version" previously had no traceable version
identifier at all. Included in `ZonePolicyVersion.compute_checksum()` alongside `weights`/`thresholds`.

### 2.1 Zone classification — thresholds + a floor gate, not pure weighted-sum

Per the research recommendation against pure linear weighted-sum classification (a product can look
"unique" on average while being trivially replaceable on one critical pillar), V0 uses:

```text
UNIQUE      IF  Defensibility Index >= 75
            AND every one of {data_advantage, network_effect, learning_effect, switching_cost} >= 50
            (floor gate — a high average cannot compensate for one collapsed pillar)

COMMODITY   IF  Differentiation Index < 40  AND  Defensibility Index < 40

ADVANTAGE   otherwise
```

The floor-gate threshold (`50`) and the UNIQUE/COMMODITY cut points (`75`/`40`/`40`) are
`PROVISIONAL_POLICY_V0` fixture values, not empirically calibrated — they exist so the classification
pipeline is testable end-to-end. They are versioned via `ZonePolicyVersion` precisely so they can be
revised without rewriting history (see ADR-Governance §3).

### 2.2 Three scores: non-gated `unique_score` penalty factor — versioned, not hardcoded

`compute_three_scores` sets `unique_score = Defensibility Index` when the assessment classifies as
UNIQUE, else `unique_score = Defensibility Index * penalty_factor` (a product that is defensible on
average yet failed the floor gate should not show as high a `unique_score` as one that actually cleared
the gate). **Closure fix**: this `penalty_factor` was previously a hardcoded `0.5` literal inside the
engine, invisible to policy versioning/checksums despite materially affecting `unique_score` for every
non-UNIQUE assessment. It now lives in `ZonePolicyVersion.thresholds["non_gated_unique_penalty_factor"]`
(defaulting to `0.5` if the key is absent, preserving V0's original behavior) — kept inside the existing
`thresholds` dict rather than a new top-level field so no database migration is required (`thresholds`
is already a JSON/JSONB column). Because it lives in `thresholds`, it is automatically covered by
`compute_checksum()`, so changing the penalty factor across policy versions changes the checksum like
any other threshold.

## 3. Evidence types per dimension (for `DimensionAssessment.evidence_refs`, not enforced by schema in V0 beyond "at least one ref required")

| Dimension | Expected evidence type |
|---|---|
| `customer_scarcity` | Target-segment penetration/market-share data, TAM scarcity, CAC trend |
| `replaceability` | Competitor/alternative count, feature-overlap analysis, price-elasticity signal |
| `data_advantage` | Data scale/exclusivity, refresh cadence, estimated replication cost/time for a competitor |
| `network_effect` | MAU/DAU superlinearity vs. user count, cross-side dependency strength |
| `learning_effect` | Outcome-improvement curve vs. usage duration, experience-curve cost decline |
| `switching_cost` | Historical churn rate, migration cost/time study, contract lock-in terms |

All evidence must be historical/behavioral or third-party-verifiable data, not a product manager's
unaided judgment — this mirrors the `Perspective≠Fact` / evidence-tier rules already governing this
repository (`20_知识_knowledge/byresearch/evidence.py`); this ADR does not create a second evidence
system, it reuses the existing `domains/product_intelligence` `Evidence` object and `evidence_refs`
pattern (see ADR-Governance §1).
