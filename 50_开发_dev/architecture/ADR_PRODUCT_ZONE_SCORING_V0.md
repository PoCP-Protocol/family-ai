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

Differentiation Index = (customer_scarcity + inverse_replaceability) / 2

Defensibility Index = (data_advantage + network_effect + learning_effect + switching_cost) / 4
```

Both indices are simple, equal-weighted averages in V0 — **not** because equal weighting is known to be
correct, but because no real historical data exists yet to justify any other weighting scheme (per the
project-owner's standing rule against inventing business parameters without evidence — see
`CLAUDE.md` §4 and prior PR-001R decisions). This is recorded as `PROVISIONAL_POLICY_V0` in
`ZonePolicyVersion` (see ADR-Governance §2), not as a scientifically validated formula.

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
