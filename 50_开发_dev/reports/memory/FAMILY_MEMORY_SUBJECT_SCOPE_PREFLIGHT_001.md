# FAMILY-MEMORY-P0-SUBJECT-SCOPE-001 Preflight

## Scope

Principle: Family != Subject. This slice establishes explicit subject ownership for child growth memory before any Semantic Memory, vector memory, or long-term context expansion.

## Branch Baseline

- base branch: `origin/architecture/family-ai-v4-1-convergence-001`
- base sha: `ea2cffeaa7dabbaa7537871078188c9020ae2312`
- work branch: `feat/family-memory-p0-subject-scope-001`
- work start sha: `ea2cffeaa7dabbaa7537871078188c9020ae2312`

## Related Remote SHAs Considered

- `origin/main`: `a68329123f7943bb299c655e1c093120d0b9475a`
- `origin/feat/receipt-assignment-batch-metrics`: `7dfbf6e40c0486995e37ecb5c3ea7b830ee60476`
- `origin/architecture/family-ai-v4-1-convergence-001`: `ea2cffeaa7dabbaa7537871078188c9020ae2312`
- `origin/plan/family-34ui-intelligence-backbone-001`: `89f466f0e3a8bd79c7de228818843a2d6b1c4ce9`

## Files In Scope

- `50_开发_dev/database/migrations/0045_family_memory_p0_subject_scope.sql`
- `50_开发_dev/packages/contracts/src/index.ts`
- `50_开发_dev/apps/api/src/modules/family/growth-priority.service.ts`
- `50_开发_dev/apps/api/src/modules/family/intervention.service.ts`
- `50_开发_dev/apps/api/src/modules/family/growth-action.service.ts`
- `50_开发_dev/apps/api/src/modules/principal/principal.repository.ts`
- focused unit specs for the same services
- `50_开发_dev/apps/api/src/modules/family/test-fixtures/ui01-ui09-synthetic.fixture.ts`

## Schema Difference

- Added nullable `subject_person_id` to `growth_priorities`, `intervention_episodes`, and `growth_actions`.
- Backfill is provable-only:
  - priority from `growth_profiles.subject_person_id` where `subject_type = 'CHILD'`
  - episode from already-scoped priority
  - action from priority, episode, or journey-plan-linked priority
- Legacy ambiguous rows remain `NULL` and are excluded from trusted memory reads/writes.
- Added subject-aware active uniqueness for priority and intervention.
- Added `family_memory_subject_scope_migration_audit` for row counts and ambiguous rows.

## Context Resolver State

No `FamilyContextResolverService` file exists in the current workspace branch. This slice therefore narrows the existing Principal repository family context queries rather than introducing a new resolver abstraction.

## Principal Context Difference

`principal.repository.ts` now treats non-UUID `subjectRef` as fail-closed empty context and filters priorities, interventions, and actions by `family_id + subject_person_id`.

## Growth Action Difference

Growth actions now carry `subject_person_id` in DTOs, service rows, today queries, completion queries, update returns, and subject mismatch checks. Legacy rows without subject are excluded from trusted action reads.

## Existing Tests Before This Slice

Focused tests existed for GrowthPriority, Intervention, GrowthAction, and Principal services. They were updated to model explicit subject rows and negative subject mismatch behavior.

## Migration State

Migration is authored but not applied to a real PostgreSQL instance in this run. Runtime backfill counts must be read from `family_memory_subject_scope_migration_audit` after deployment.

## 34UI Baseline State

This slice does not change canonical 34UI scope. UI-35 deletion and 34UI baseline remain inherited from `origin/architecture/family-ai-v4-1-convergence-001`.
