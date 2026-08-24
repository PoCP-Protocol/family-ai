# Family Growth Subject Ownership Matrix

## Rule

`family_id` scopes access. `subject_person_id` owns child memory. A growth memory object is trusted only when both are present and consistent with the resolved subject.

## Matrix

| Object | Subject Owner | Previous State | P0 State | Fail-Closed Rule |
| --- | --- | --- | --- | --- |
| GrowthProfile | `growth_profiles.subject_person_id` | Already explicit for child profiles | Used as provenance for provable backfill and resolver checks | missing subject cannot prove downstream ownership |
| GrowthPriority | `growth_priorities.subject_person_id` | Family/onboarding scoped only | explicit nullable column, inserted from resolver, active uniqueness per family + subject + onboarding | active priority must match resolved child subject |
| InterventionEpisode | `intervention_episodes.subject_person_id` | family/onboarding/priority scoped only | explicit nullable column, inserted from active priority/resolver subject | start blocks when active priority subject is missing or mismatched |
| GrowthAction | `growth_actions.subject_person_id` | family/action/priority scoped only | explicit nullable column, inserted from intervention subject, returned in DTOs | completion/task transitions block when stored subject is missing or mismatched |
| Principal Context | request `subjectRef` as UUID person id | family context could read family-wide growth rows | priorities/interventions/actions filtered by `family_id + subject_person_id` | invalid `subjectRef` returns empty context |
| Family Context | child subject person id | no dedicated resolver found in branch | principal repository supplies subject-scoped family context slice | ambiguous legacy rows are excluded |

## Explicit Non-Goals

- no inferred owner from `assigned_to_person_id`
- no Semantic Memory Store
- no pgvector or embedding memory
- no graph database introduction
- no UI redesign
- no microservice split
