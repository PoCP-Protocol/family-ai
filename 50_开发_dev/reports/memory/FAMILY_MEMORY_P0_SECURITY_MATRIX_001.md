# Family Memory P0 Security Matrix

## Boundary

Trusted child memory requires: `FAMILY + SUBJECT + ACTOR + PURPOSE + CONSENT`.

## Controls

| Risk | P0 Control | Evidence In This Slice | Residual Gap |
| --- | --- | --- | --- |
| same family, two children mixed | growth services persist and compare `subject_person_id`; principal context filters by subject | unit tests cover intervention/action subject mismatch | UI-01 Today read still lacks explicit subject selector |
| cross-family access | existing family existence and family-scoped queries retained | API typecheck and focused unit tests pass | broader HTTP E2E not run |
| missing subject on legacy rows | nullable migration, but services exclude or block null subject in trusted paths | intervention/action fail closed on missing stored subject | migration audit counts require real DB run |
| invalid subject reference | principal repository returns empty family context for non-UUID subjectRef | principal service spec remains green | dedicated HTTP negative test pending |
| withdrawn consent | existing consent loader remains purpose based and subject-aware | subject id is passed into consent lookup in growth priority tests | explicit withdrawn/expired consent integration test pending |
| priority/action mismatch | action completion compares stored action subject to resolver subject | action mismatch unit test added | DB-level cross-table equality constraint not added in P0 |
| intervention/action mismatch | intervention inserts actions with same subject; context reads by subject | intervention actions all assert same child subject | post-migration data consistency query pending |
| idempotent retry | existing idempotency behavior preserved | replay tests remain green | cross-subject replay HTTP test pending |
| provider/model key leakage | not in scope; no model gateway or mobile runtime changes in this slice | no provider integration added | real API key runtime tests remain outside P0 |

## P0 Verdict

The code path now fails closed for subject mismatch in the main write paths touched by this task. Real database migration, HTTP E2E, and explicit consent withdrawal tests remain required before treating the memory substrate as production complete.
