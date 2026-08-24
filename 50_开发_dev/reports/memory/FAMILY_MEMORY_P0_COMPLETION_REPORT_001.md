# FAMILY-MEMORY-P0-SUBJECT-SCOPE-001 Completion Report

## Identity

- task: `FAMILY-MEMORY-P0-SUBJECT-SCOPE-001`
- principle: first make memory ownership correct, then decide what the system remembers
- base branch: `origin/architecture/family-ai-v4-1-convergence-001`
- base sha: `ea2cffeaa7dabbaa7537871078188c9020ae2312`
- work branch: `feat/family-memory-p0-subject-scope-001`
- starting head sha: `ea2cffeaa7dabbaa7537871078188c9020ae2312`
- final head sha: the git commit carrying this report

## Branch Inputs Considered

- main delta considered: `a68329123f7943bb299c655e1c093120d0b9475a`
- receipt assignment branch considered: `7dfbf6e40c0486995e37ecb5c3ea7b830ee60476`
- architecture branch considered: `ea2cffeaa7dabbaa7537871078188c9020ae2312`
- plan branch audit considered: `89f466f0e3a8bd79c7de228818843a2d6b1c4ce9`

## What Changed

- schema changed: yes, additive subject columns and audit view
- contracts changed: yes, GrowthPriorityDto, InterventionEpisodeDto, and GrowthActionDto expose `subject_person_id`
- services changed: yes, GrowthPriority, Intervention, GrowthAction, and Principal repository
- tests changed: yes, focused unit fakes and negative subject mismatch cases
- reports changed: yes, P0 memory report pack created

## Behavioral Result

| Check | Result |
| --- | --- |
| multi-child isolation | partial pass: unit mismatch tests cover Intervention and GrowthAction fail-closed behavior |
| consent withdrawal | pending explicit integration/E2E test |
| cross-family result | existing family-scoped queries preserved; dedicated E2E pending |
| idempotency result | focused replay tests pass |
| ambiguous legacy row | migration audit view created; real row count pending DB run |
| principal family context | subject-scoped query implemented; invalid non-UUID subject returns empty context |

## Validations Run

- `pnpm --dir d:\family-ai\50_开发_dev --filter @family/contracts build`: passed earlier in this slice
- `pnpm --dir d:\family-ai\50_开发_dev --filter @family/api typecheck`: passed earlier in this slice
- `pnpm --dir d:\family-ai\50_开发_dev --filter @family/api test -- growth-priority.service.spec.ts intervention.service.spec.ts growth-action.service.spec.ts principal.service.spec.ts`: passed, 41 tests

## Known Remaining Gaps

- migration was not executed against real PostgreSQL in this turn; backfill counts and ambiguous row counts are pending
- HTTP E2E and Principal E2E negative tests are pending
- UI-01 Today read excludes null-subject legacy rows but still does not require an explicit subject selector; this must be resolved before multi-child Today UX can be called complete
- no DB-level cross-table equality constraint was added between action/intervention/priority subject ids; service-level fail-closed checks cover the main write paths for this P0 slice

## Verdict

PASS for this focused P0 code slice with explicit residual gaps recorded. Not production-complete for the full long-term memory substrate until DB execution and E2E gates are added.
