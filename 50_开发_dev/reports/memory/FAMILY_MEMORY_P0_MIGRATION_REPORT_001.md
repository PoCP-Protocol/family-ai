# Family Memory P0 Migration Report

## Migration

File: `50_开发_dev/database/migrations/0045_family_memory_p0_subject_scope.sql`

## Additive Schema

- `growth_priorities.subject_person_id uuid NULL REFERENCES persons(person_id)`
- `intervention_episodes.subject_person_id uuid NULL REFERENCES persons(person_id)`
- `growth_actions.subject_person_id uuid NULL REFERENCES persons(person_id)`

Columns remain nullable to avoid unsafe inferred migration of legacy rows. Runtime services treat missing subject as untrusted for the new memory path.

## Backfill Policy

Only provable links are backfilled:

- priority: profile subject where the profile is a child profile
- intervention: priority subject
- action: priority subject, intervention subject, or journey-plan priority subject

The migration intentionally does not backfill from `assigned_to_person_id`, free-text actors, UI state, or family membership alone.

## Indexes And Constraints

- subject-aware active priority uniqueness: `(family_id, subject_person_id, onboarding_id)` where active and subject is not null
- subject-aware active intervention uniqueness: `(family_id, subject_person_id, onboarding_id)` where active and subject is not null
- read indexes for priority, intervention, and action subject lookups
- audit view: `family_memory_subject_scope_migration_audit`

## Runtime Count Query

After applying the migration, run:

```sql
select * from family_memory_subject_scope_migration_audit order by table_name;
```

## Current Run Result

- migration file authored: yes
- static editor diagnostics: no errors found
- real PostgreSQL migration execution: not run in this agent turn
- backfill counts: pending real DB execution
- ambiguous rows: pending real DB execution
