# Family Intelligence OS Harness Boundary V0.1

```text
DOC_KIND = ARCHITECTURE_CONTRACT
STATUS   = G1-A_BOUNDARY_ONLY
SCOPE    = FR-0 Harness Boundary
```

## 1. Target Position

Family AI is not `Codex Harness + family education model`.

The target system is:

```text
Family Domain Core
+ Family Intelligence Runtime
+ Codex Agent Runtime
+ Family Professional Model
+ Intervention Knowledge Engine
+ Human Action & Service Engine
= Family Intelligence OS
```

Codex App Server is an executive runtime behind the Family API. It is never a client-facing endpoint and never owns Family business truth.

```text
Family Experience
→ Family Experience API
→ Family Intelligence Runtime
→ FamilyHarnessAdapter
→ Codex App Server JSON-RPC
```

## 2. Three Brains

```text
Domain Brain       = PostgreSQL + NestJS Domain Services + Named Actions
Professional Brain = Family Model Stack + Intervention Library + Evidence + Safety
Executive Brain    = Codex Harness Thread / Turn / Tool / Skill / Approval / Resume
```

Only the Domain Brain records canonical truth.

## 3. Permanent Invariants

```text
AI_READS_CONTEXT
AI_PROPOSES
HUMAN_OR_POLICY_DECIDES
NAMED_ACTION_EXECUTES
DOMAIN_CORE_RECORDS
NO_AGENT_DIRECT_DATABASE_WRITE
AI_CANNOT_WRITE_CORE_ONTOLOGY
PROPOSAL_NOT_DECISION
```

## 4. Allowed Harness Tools

Harness tools are Family domain tools, not raw infrastructure tools.

```text
get_family_context          READ_ONLY
get_family_now              READ_ONLY
get_growth_episode          READ_ONLY
search_interventions        READ_ONLY
get_intervention            READ_ONLY
get_family_perspectives     READ_ONLY
get_recent_actions          READ_ONLY
propose_growth_action       PROPOSAL_ONLY
request_human_review        HUMAN_REVIEW_ONLY
create_support_case_draft   PROPOSAL_ONLY
get_service_options         READ_ONLY
```

Forbidden tool shapes:

```text
execute_sql
update_table
write_growth_profile
write_family_context
mutate_core_ontology
generic_patch_core_object
```

## 5. FR-0 Implementation Rule

G1-A authorizes only the boundary contract and adapter skeleton.

It does not authorize:

```text
DB schema change
Codex App Server production enablement
client direct Codex access
AI direct canonical mutation
new autonomous business agent fleet
```

The first executable package for this boundary is `@family/harness`.

## 6. Required Order

Before production Harness exposure:

```text
Multi-Child Subject Isolation
→ FamilyNow projection
→ FamilyHarnessAdapter
→ Family Professional Model routing
→ Proposal confirmation
→ Named Action bridge
→ Audit / Eval / Human Gate
```