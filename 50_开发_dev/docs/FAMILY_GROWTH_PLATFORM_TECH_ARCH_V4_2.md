# Family Growth Platform Technical Architecture V4.2

## 1. Scope

This architecture resets the technical design for Family Growth Platform with the Family Education Large Model as the foundation.

It is an architecture and contract baseline. It does not authorize new runtime expansion, database schema changes, live external AI calls, or direct core ontology changes. Those require separate approved tasks and gates.

## 2. Architecture Thesis

Family Growth Platform should be a modular monolith first, model-foundation-first platform.

The system should not scatter AI logic across product screens. Product surfaces should call stable application services that compose model components, run schema validation, enforce policy, and emit named events/actions.

## 3. Target Architecture

```text
Experience Layer
  - Mobile / Web UI
  - Assessment UI
  - Realtime Assistant UI
  - Reports / Timeline / Action Review
  - Human Service Workspace
        ↓
Application Service Layer
  - AssessmentService
  - DialogueService
  - MemoryService
  - MultimodalArtifactService
  - ActionPlanningService
  - OutcomeReviewService
  - HumanServiceHandoffService
        ↓
Growth OS Layer
  - Family Core
  - Parent / Child / Relationship
  - LifeStage / Need / GrowthPriority
  - Named Actions
  - Events / Audit / Consent / Policy
        ↓
Family Education Large Model Foundation
  - Domain Kernel
  - Component Registry
  - Need Registry
  - Construct Registry
  - Source Registry
  - Memory and Conversation Schema
  - Multimodal Artifact Schema
  - Action Catalog
  - Outcome Signal Schema
  - Evaluation Suites
        ↓
AI Capability Layer
  - deterministic rules
  - small model routers and classifiers
  - retrieval over approved knowledge
  - Model Gateway
  - structured output validator
  - safety and human gate
        ↓
Data and Evaluation Layer
  - PostgreSQL operational data
  - registry assets
  - event/audit logs
  - memory records
  - artifact metadata
  - eval scenario cards
  - outcome metrics
```

## 4. Component Runtime

The model foundation uses a component runtime pattern.

A component is a versioned capability with declared input contracts, output contracts, dependencies, policy boundaries, evaluation gates, and lifecycle status.

Component categories:

- domain component;
- assessment component;
- action component;
- memory component;
- dialogue component;
- multimodal component;
- small-model component;
- knowledge component;
- human-service component;
- localization component.

Runtime composition flow:

```text
Product request
  -> Application service
  -> Resolve component set
  -> Load registry/schema contracts
  -> Collect family context and consent
  -> Run deterministic extraction or retrieval
  -> Route through Model Gateway if authorized
  -> Validate structured output
  -> Apply policy and human gate
  -> Produce candidate, event, or named action request
  -> Record audit and evaluation trace
```

## 5. Model Gateway Boundary

All generative model calls must go through Model Gateway.

The gateway is responsible for:

- provider abstraction;
- model routing;
- prompt/template versioning;
- approved knowledge retrieval input;
- structured output requirement;
- refusal/fallback behavior;
- trace and audit;
- cost and latency limits;
- live provider authorization checks.

Current boundary:

- Real external model calls remain not authorized unless a separate gate approves them.
- V4.2 design can specify gateway contracts and eval requirements.
- Implementation must default to deterministic or mock pathways unless authorization changes.

## 6. Memory Architecture

Memory is a model capability, not a loose chat-history table.

Memory scopes:

- session memory;
- family longitudinal memory;
- child growth timeline;
- parent learning timeline;
- assessment memory;
- action memory;
- outcome memory;
- conversation summary memory;
- multimodal artifact memory;
- human review memory;
- source/evidence memory.

Memory write flow:

```text
Assessment / dialogue / artifact / action review
  -> Extract candidate memory signal
  -> Validate against memory schema
  -> Attach source, role, time window, confidence, consent
  -> Apply policy and human gate when required
  -> Persist as memory candidate or approved memory record
  -> Link to need, construct, action, outcome, and artifact refs
```

Rules:

- Memory is not automatically fact.
- Memory must preserve respondent role and source type.
- Memory updates do not directly mutate core ontology.
- Core state changes require named actions.

## 7. Realtime Dialogue Architecture

Realtime dialogue should be implemented as a structured conversation service.

Conversation flow:

```text
Dialogue turn
  -> speaker role and modality detection
  -> intent extraction
  -> relevant memory retrieval
  -> need and construct candidate mapping
  -> missing information detection
  -> clarifying question or structured response
  -> candidate action / handoff / review plan
  -> memory update candidate
  -> audit and evaluation trace
```

Supported roles:

- parent;
- child;
- family group;
- teacher;
- parent educator;
- counselor;
- health professional;
- social worker;
- platform reviewer.

## 8. Multimodal Architecture

Multimodal support must treat artifacts as provenance-preserved signals.

Supported artifact types:

- text;
- image;
- photo;
- audio;
- video;
- document;
- chart;
- code;
- mixed.

Artifact flow:

```text
Artifact submit
  -> consent and source check
  -> metadata capture
  -> deterministic extraction or model-assisted observation
  -> artifact observation schema
  -> link to need/construct candidates
  -> optional human review
  -> memory and outcome linkage
```

Rules:

- Artifact observations are signals, not facts.
- Child artifacts cannot be used for ranking.
- Diagnostic interpretation requires human review.
- Generated artifacts must be marked separately.

## 9. Data Architecture

Data categories:

| Category | Examples | Storage direction |
| --- | --- | --- |
| Core state | family, parent, child, relationship, consent | existing Growth OS schemas and named actions |
| Model assets | registries, schemas, catalogs, eval sets | versioned repository assets first |
| Operational signals | assessment responses, dialogue turns, action reviews | application tables after approved tasks |
| Memory | family memory, child timeline, action/outcome memory | memory service schema after approved task |
| Artifact metadata | source, consent, type, storage ref, observations | artifact service schema after approved task |
| AI traces | prompt version, model route, structured output, validation | trace store or audit-compatible logs |
| Evaluation | scenario cards, expected labels, regression results | repository assets and CI reports |

## 10. Evaluation Architecture

Every component must define evaluation gates before production rollout.

Evaluation layers:

- schema validation;
- deterministic unit tests;
- component contract tests;
- golden scenario cards;
- safety and boundary tests;
- human-review agreement;
- outcome signal quality;
- cohort monitoring;
- regression tests across model versions.

Minimum metrics:

- need identification quality;
- construct mapping quality;
- action matching usefulness;
- explanation readability;
- safety recall;
- human gate correctness;
- outcome review completion;
- component compatibility.

## 11. Security, Consent, and Human Gate

The architecture must preserve the existing Family principles:

- no family total score;
- no child ranking;
- no direct diagnosis;
- no direct core ontology write from free text;
- no generic core patch API;
- named actions only for core state;
- consent-aware memory and artifact processing;
- human gate for high-risk scenarios;
- audit for important actions.

## 12. Implementation Boundaries

Allowed by this architecture document:

- create design documents;
- create draft registries and schemas;
- define component contracts;
- define evaluation strategy;
- prepare task decomposition.

Not authorized by this architecture document alone:

- DB schema changes;
- live external AI calls;
- production model provider integration;
- new high-risk automated decisions;
- public API breaking changes;
- direct core ontology mutations;
- broad product runtime expansion.

## 13. First Technical Milestones

1. Freeze V4.2 blueprint and architecture docs.
2. Freeze component registry contract.
3. Add model asset validation tests.
4. Create first evaluation scenario cards.
5. Convert UI-02 assessment to consume model component contracts.
6. Add deterministic memory/dialogue mock path.
7. Add multimodal artifact metadata prototype.
8. Add outcome review loop for assessment/action candidates.
