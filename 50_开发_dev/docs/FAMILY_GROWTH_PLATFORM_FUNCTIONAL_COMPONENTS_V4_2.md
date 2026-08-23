# Family Growth Platform Functional Components V4.2

## 1. Purpose

This document defines the functional component map for Family Growth Platform V4.2.

The platform is built on the Family Education Large Model foundation. Components must be independently versioned, replaceable, testable, and composable.

## 2. Component Groups

```text
A. Model Foundation Components
B. Platform Service Components
C. Product Experience Components
D. Human Service Components
E. Governance and Evaluation Components
```

## 3. A. Model Foundation Components

| Component | Responsibility | Input | Output | Priority |
| --- | --- | --- | --- | --- |
| Domain Kernel | Stable Family/Parent/Child/Relationship/Need/Construct base | ontology refs, model registries | canonical refs and boundaries | P0 |
| Component Registry | Register model capabilities and dependencies | component definitions | component contract graph | P0 |
| Need Registry | Define child, parent, family needs | domain refs, research sources | need refs and applicability | P0 |
| Construct Registry | Define measurable family education constructs | domain refs, source refs | construct refs and signals | P0 |
| Source and Evidence Registry | Manage research, practice, and internal sources | source docs, evidence rules | source refs, evidence levels | P0 |
| Item Bank Registry | Define question banks and response schemas | construct refs | assessment items and branching | P1 |
| Action Catalog | Define support actions and review methods | need refs, construct refs | action candidates | P0 |
| Outcome Signal Schema | Define outcome review signals | action refs, need refs | outcome records and metrics | P0 |
| Memory Schema | Define family memory and conversation memory | signals, actions, dialogue | memory records/candidates | P0 |
| Multimodal Artifact Schema | Define image/photo/audio/video/document artifact signals | artifact metadata | artifact observations | P0 |
| Evaluation Scenario Set | Define expected labels and regression cases | scenario cards | eval reports | P1 |

## 4. B. Platform Service Components

| Component | Responsibility | Input | Output | Priority |
| --- | --- | --- | --- | --- |
| Assessment Service | Run family assessments from model contracts | item bank, family context | assessment session, response records | P0 |
| Interpretation Service | Convert responses and signals into structured hypotheses | responses, memory, constructs | need summary, support hypothesis | P0 |
| Dialogue Service | Run realtime role-aware conversations | dialogue turns, memory | clarifying question, structured response | P1 |
| Memory Service | Recall and update family memory candidates | signals, consent, source | memory profile, timeline | P1 |
| Multimodal Artifact Service | Capture artifact metadata and observations | artifact upload, provenance | artifact observation signals | P1 |
| Action Planning Service | Match needs to support actions | need summary, action catalog | action candidates | P0 |
| Outcome Review Service | Collect and analyze action feedback | action attempts, family feedback | outcome signals | P0 |
| Human Handoff Service | Prepare service handoff context | need summary, risk signals | handoff package | P1 |
| Model Gateway Service | Route authorized model calls | prompt contract, retrieval context | structured model output | P1, gated |
| Retrieval Service | Retrieve approved knowledge and action patterns | source registry, query | grounded context | P1 |
| Evaluation Service | Run component and model regression checks | scenario set, outputs | eval result | P1 |

## 5. C. Product Experience Components

| Component | User | Responsibility | Model dependency | Priority |
| --- | --- | --- | --- | --- |
| UI-02 Family Assessment | Parent | Intake and deep assessment | assessment component, need registry | P0 |
| UI-03 Growth Interpretation | Parent | Explain needs and hypotheses | interpretation, evidence, action catalog | P0 |
| Family Growth Timeline | Parent/family | Show memory, actions, outcomes over time | memory, outcome, event history | P1 |
| Realtime Family Assistant | Parent/child | Ongoing role-aware conversation | dialogue, memory, model gateway | P1, gated |
| Parent Growth Path | Parent | Parent learning and practice | parent needs, action catalog, outcome review | P1 |
| Child Growth Path | Child/parent | Learning, health, emotion, AI-era skill support | child needs, trajectory, multimodal artifacts | P1 |
| Family Action Plan | Family | Confirm and review small actions | action catalog, named action, outcome | P0 |
| School-Family Handoff | Parent/teacher | Translate school feedback into collaboration | K12 domain, document artifact, handoff | P1 |
| Multimodal Artifact Review | Parent/child | Review homework, report, drawing, video, project artifacts | artifact schema, construct mapping | P1 |
| Human Service Workspace | Reviewer/service role | Review cases and support handoff | human service component, audit, memory | P2 |

## 6. D. Human Service Components

| Component | Responsibility | Required boundary | Priority |
| --- | --- | --- | --- |
| Parent Educator Review | Review family education support context | human gate and audit | P1 |
| Teacher Collaboration Pack | Prepare school communication context | parent confirmation | P1 |
| Counselor Handoff Pack | Prepare emotional/relationship support context | high-risk human gate | P2 |
| Health Rhythm Handoff Pack | Prepare sleep, movement, nutrition, body signal context | no diagnosis; professional review | P2 |
| Social Support Resource Pack | Prepare community/service navigation context | consent and localization | P2 |
| Service Outcome Feedback | Capture whether human service helped | outcome schema | P2 |

## 7. E. Governance and Evaluation Components

| Component | Responsibility | Priority |
| --- | --- | --- |
| Consent Policy Component | Consent-aware memory, artifact, dialogue, and service flows | P0 |
| Human Gate Component | High-risk and professional scenarios route to humans | P0 |
| Audit Component | Important actions include actor, timestamp, source, correlation id | P0 |
| Schema Validation Component | AI and API structured outputs must validate | P0 |
| Component Compatibility Test | Component versions compose safely | P1 |
| Golden Scenario Evaluation | Expert-labeled cases validate need/action/risk outputs | P1 |
| Safety and Boundary Evaluation | No diagnosis, ranking, total score, or unapproved action | P0 |
| Outcome Quality Evaluation | Reviews whether actions are tried and useful | P1 |
| Localization Evaluation | Region/curriculum/service extensions tested separately | P2 |

## 8. Dependency Map

```text
Domain Kernel
  -> Need Registry
  -> Construct Registry
  -> Source Registry
  -> Action Catalog
  -> Outcome Schema
  -> Memory / Dialogue / Multimodal Schemas
  -> Assessment / Interpretation / Action / Outcome Services
  -> Product Experience Components
  -> Human Service Components
  -> Evaluation and Improvement
```

## 9. First P0 Build Set

The first implementation wave should focus on P0 components only:

1. Domain Kernel alignment through existing ontology refs.
2. Component Registry.
3. Need Registry.
4. Construct Registry.
5. Source and Evidence Registry.
6. Action Catalog.
7. Outcome Signal Schema.
8. Memory and Multimodal draft schemas.
9. Assessment Service contract alignment.
10. Interpretation Service structured output contract.
11. Action Planning Service candidate output.
12. Outcome Review Service.
13. UI-02 and UI-03 composition from model contracts.
14. Consent, Human Gate, Audit, Schema Validation.
15. Golden Scenario Evaluation seed.

## 10. Acceptance Criteria

A component is acceptable only if:

- it has a registered component ref;
- it declares owner and version;
- it declares input and output contracts;
- it declares dependencies;
- it declares policy and human-review boundaries;
- it has at least one validation or evaluation path;
- it does not directly mutate core ontology;
- it does not bypass Named Action for core state changes.
