# Family Membership OS V2 Baseline

status: PROPOSED_FOR_DOMAIN_APPROVAL
version: 0.1.0
scope: membership domain, UI semantics, future commerce/service contracts
related_task: FAMILY-AI-V5-RUNTIME-FOUNDATION-001

## Decision

Family retains membership tiers, but only as **relationship-depth tiers**. The first version has exactly three tiers:

```text
M0_FREE    家庭会员
M1_GROWTH  成长会员
M2_ANNUAL  年度会员
```

This is not a VIP price ladder and not a family/child growth score.

## Four Separate Axes

| Axis | Values | Question answered |
|---|---|---|
| Membership Tier | M0/M1/M2 | What long-term service relationship exists? |
| Growth Stage | ONBOARDING/FIRST_VALUE/ACTIVE_GROWTH/REVIEW/RENEWAL_WINDOW | Where is the current journey? |
| Loyalty Points | Account/Ledger/Rule/Redemption | What eligible participation assets exist? |
| Community Role | Growth Partner/Sharing Ambassador/City Initiator | What contribution role exists? |

The axes may be displayed together, but must not be converted into one another.

## Tier Definitions

### M0 — 家庭会员

Entry: family account and basic relationship establishment.

Value: basic assessment, selected AI/content, community browsing, private growth record.

### M1 — 成长会员

Entry: activated 21-day or 90-day growth product, or another explicitly approved effective relationship.

Value: growth plan, AI companion, growth records, selected activities/content, points acceleration.

### M2 — 年度会员

Entry: successfully activated Annual Family Growth Membership.

Value: 365-day relationship, four growth cycles, Family Steward, expert/activity benefits, annual family report, member service.

## Product Mapping

```text
Account creation       → M0
Salon/event purchase   → M0 + Event Entitlement
21-day/90-day product  → M0 → M1 after activation policy
Annual membership      → M1 → M2 after Commerce activation
Expert consultation    → current tier + Consultation Entitlement
```

An entitlement purchase alone does not necessarily change the tier.

## Transition Invariants

1. A tier change must have a deterministic `activation_source_type` and `activation_source_ref`.
2. A tier change must be auditable and idempotent.
3. AI may recommend an upgrade, but cannot grant or mutate the tier.
4. Points cannot directly purchase or force a tier.
5. A referral draft cannot qualify a tier transition.
6. A community role cannot imply a tier.
7. A tier cannot imply a child/family ability, safety level, or ranking.
8. Renewal creates a new `MembershipPeriod`; it must not rewrite historical periods.

## Required Future Domain Objects

```text
MembershipTierDefinition
MembershipSubscription
MembershipPeriod
MembershipActivationSource
MembershipTierTransition
BenefitDefinition
BenefitGrant
BenefitReservation
BenefitLedger
```

The existing `Plan → Subscription → Grant → Ledger` kernel is retained. V2 grows the lifecycle and commercial semantics above it.

## UI Contract

Allowed:

```text
年度会员 M2
成长阶段：第二周期 · 稳定行动期
成长积分：1,280
社区身份：成长伙伴
```

Forbidden:

```text
有订阅 → Lv.3
没订阅 → Lv.1
固定 LV3 成长达人
固定 1280 积分
固定等级进度条
```

UI-06 is the family account center. UI-18 is the membership and growth-entitlement center. UI-30 is the annual companion cockpit. These pages must not each invent a different membership meaning.

## Production Boundary

Current membership implementation remains fixture-only:

```text
environment = DEV / TEST
fixture_only = true
external_effect = false
source_system = TEST_NOOP_ADAPTER
```

Production activation is a separate approved wave:

```text
Order
→ PaymentSucceeded
→ MembershipActivation
→ MembershipPeriod
→ BenefitGrant
→ Growth Journey
```

No production billing, automatic renewal, notification, or real points redemption is implied by this baseline.

## Success Measures

The first validation set should measure:

- M0 → M1 activated growth relationship rate
- M1 → M2 annual conversion rate
- Time to first value
- 30-day active family rate
- Growth cycle participation
- Benefit utilization and service completion
- Review completion
- Annual renewal readiness and renewal rate
- Qualified referral rate

Revenue alone is not sufficient evidence of Membership OS success.