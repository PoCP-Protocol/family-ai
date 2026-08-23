# Family Education Intelligence Model V0.1

## 1. Model Position

This document is the first structured model artifact for the Family Education Intelligence Model. It translates the industry-model plan into a working model map that can later become construct registries, assessment schemas, action catalogs, evaluation sets, and small-model training datasets.

This is a modeling artifact, not a direct write to core Family Ontology. It should guide product, assessment, AI, knowledge, and human-service design.

The model is designed for millions to tens of millions of families. It must support national-scale family education, AI-era family growth, multi-region deployment, multi-age coverage, multi-source evidence, human-service collaboration, and continuous model improvement.

## 2. Design North Star

Family Education Intelligence should become a scalable growth infrastructure for AI-era families.

Design goals:

- Serve families at very large scale while preserving family-level personalization.
- Support children from early childhood through adolescence and future youth stages.
- Cover ordinary family questions, learning support, health rhythm, emotional support, AI-era literacy, and complex service needs.
- Turn every product surface into structured learning for the model: assessment, report, action, review, human service, and outcome feedback.
- Allow new domains, new age stages, new regions, new school systems, new AI tools, and new service partners to plug into the model without rewriting the whole platform.
- Build a durable industry asset: domain ontology, construct registry, source registry, item bank, action catalog, evaluation set, and model training data.

## 3. Scalability Principles

| Principle | Meaning | Design implication |
| --- | --- | --- |
| Need-centered | The model starts from child, parent, and family needs | All assessment, action, and outcome schemas must link to need refs |
| Domain-pluggable | New domains can be added as modules | Academic, health, AI literacy, multimodal, regional education, and service modules use stable interfaces |
| Age-stage aware | Children at different ages require different interpretations | Every construct and item can declare life stage and school stage applicability |
| Multi-source evidence | Parent, child, school, health, product, and human-service signals coexist | Inputs must preserve source type, time window, consent, and evidence level |
| Human-AI collaborative | AI supports but does not replace family and service professionals | Model output feeds parent confirmation, educator review, and service workflows |
| Versioned and evaluable | Every domain, construct, item, action, and model output is versioned | Product releases can compare model quality over time |
| Componentized by default | Domains, assessments, memory, dialogue, multimodal, actions, services, and small models are independently registered components | Each component declares contract refs, dependencies, lifecycle status, evaluation gates, policies, and rollback strategy |
| Localization-ready | Family education differs by region, school system, culture, and resources | Registry items can carry region, curriculum, language, and service-context tags |
| Outcome-learning loop | The model improves from whether support was tried and useful | OutcomeSignal links back to needs, actions, constructs, and cohorts |

## 4. Extensible Model Architecture

```text
Family Education Domain Kernel
  - Family / Parent / Child / Relationship / LifeStage
  - Need / Construct / Signal / Evidence / Action / Outcome

Domain Modules
  - Academic K12
  - Physical Health
  - Psychosomatic Wellbeing
  - AI Literacy
  - Multimodal Literacy
  - Multiple Intelligences
  - Digital Life
  - Parenting and Relationship
  - Family System
  - Human Service

Extension Registries
  - Domain registry
  - Need registry
  - Construct registry
  - Source registry
  - Item bank registry
  - Action catalog
  - Evaluation set

AI Capability Layer
  - deterministic baseline
  - small classifiers and routers
  - retrieval over approved knowledge
  - structured explanation generation through Model Gateway
  - expert review and outcome feedback loop

Memory and Realtime Dialogue Layer
  - longitudinal family memory
  - child growth and parent learning timelines
  - realtime role-aware conversation
  - clarifying questions and follow-up prompts
  - memory update candidates through structured validation

Multimodal Understanding Layer
  - image, photo, audio, video, document, chart, code, and mixed artifacts
  - artifact provenance and consent
  - artifact-to-need and artifact-to-construct mapping
  - progress comparison across repeated artifacts

Product Surfaces
  - UI-02 intake
  - UI-03 interpretation
  - report
  - action plan
  - parent learning path
  - child practice path
  - school-family handoff
  - human-service workflow
```

Component runtime rule:

- The Family Education Domain Kernel is stable and small.
- Everything else must be a registered component: domain component, assessment component, action component, memory component, dialogue component, multimodal component, small-model component, knowledge component, human-service component, or localization component.
- Components communicate through stable registries and schemas, not by copying internal logic.
- Components can be added, upgraded, disabled, replaced, or localized without rewriting the whole model.
- The component contract is maintained in `model/family_model_component.registry.yaml`.

```text
Family Education Domain Kernel
        ↓
Component Registry and Runtime Contracts
        ↓
Composable Components
  - Domain components
  - Assessment components
  - Action components
  - Memory components
  - Dialogue components
  - Multimodal components
  - Small-model components
  - Knowledge components
  - Human-service components
  - Localization components
        ↓
Product and Service Composition
  - assessment journeys
  - realtime assistant
  - reports
  - action plans
  - learning paths
  - school-family handoff
  - professional service support
```

## 5. Expansion Dimensions

The model must be able to expand along these axes:

| Axis | Examples | Required model support |
| --- | --- | --- |
| Family scale | first 100 families, 10,000 pilot families, 1 million families, 10 million+ families | cohort tags, aggregate quality metrics, registry versioning, sampling review |
| Age stage | preschool, primary school, middle school, high school, transition to youth | life-stage applicability on needs, constructs, item banks, and actions |
| Education stage | K12 subjects, exam transitions, project learning, vocational exploration | curriculum/context tags and subject-specific extensions |
| Region and culture | city/rural, province, school type, language, local service resources | localization metadata and regional source registry |
| Need complexity | simple question, recurring conflict, multi-domain need, professional service need | stepped support intensity and human-service handoff context |
| Modality | text, image, audio, video, data, code, observation, report artifact | multimodal input type and artifact provenance |
| Memory | session context, longitudinal family profile, action history, outcome history, conversation summary, artifact memory | memory refs, retention policy, update candidate validation, consent-aware recall |
| Dialogue | parent question, child reflection, family discussion, school handoff, human-service exchange | role-aware sessions, realtime intent, clarifying question, structured summary |
| AI capability | rules, small model, RAG, LLM explanation, agent workflow | capability routing and evaluation gates |
| Service network | parent educator, counselor, teacher, doctor, social worker, community program | role-aware handoff and feedback labels |

## 6. Platform-Scale Data Flywheel

```text
Assessment / intake
  -> NeedSummary
  -> SupportHypothesis
  -> ActionCandidate / LearningPath / Handoff
  -> Parent / child / human review
  -> Action attempt
  -> OutcomeSignal
  -> Expert labeling and cohort analysis
  -> Registry improvement
  -> Item/action/model evaluation
  -> Next product version
```

The flywheel should improve four assets at the same time:

- Better need identification.
- Better action matching.
- Better parent-facing explanation.
- Better understanding of what support works for which families under which conditions.

## 7. Tooling and Harness Strategy

The model should absorb mature industry tools, but it should not outsource its domain intelligence to them.

Recommended tool roles:

| Tool category | Role in model building | Family-owned output |
| --- | --- | --- |
| Codex harness-style agent workflow | Automate model asset generation, regression checks, eval execution, and implementation tasks | approved registries, schemas, tests, and review reports |
| JSON Schema / OpenAPI / TypeScript | Make model inputs and outputs executable contracts | interpretation schema, API contracts, UI data types |
| LinkML or graph-modeling tools | Help organize ontology-like registries without directly rewriting core ontology | domain, need, construct, source, action, outcome registries |
| LLM eval frameworks | Score structured output, rubric alignment, safety recall, and explanation quality | Family evaluation suites and expert scenario cards |
| RAG frameworks | Retrieve approved source excerpts and action catalog entries | source-grounded explanation and action matching |
| Labeling tools | Collect expert labels for needs, constructs, actions, and outcomes | Family expert-labeled scenario dataset |
| Small-model libraries | Train classifiers, routers, rerankers, and action matchers | Family small-model checkpoints and offline metrics |

Decision:

- Use Codex harness as the engineering and evaluation harness.
- Use mature schema, retrieval, labeling, evaluation, and model-training tools where they accelerate the pipeline.
- Keep Family's domain registry, need taxonomy, construct definitions, action catalog, evidence rules, and scenario dataset as first-party assets.
- Start simple with YAML registries and deterministic tests, then introduce specialized tools when registry size, labeling volume, or evaluation complexity requires them.

## 8. Core Modeling Question

The model should answer:

> What does this child need, what does this parent need, what does this family need, and what support should be considered next?

Every domain, construct, item bank, model output, action, and outcome review should eventually connect back to this question.

## 9. Top-Level Model Objects

| Object | Meaning | Example fields |
| --- | --- | --- |
| `ChildNeed` | A concrete growth, learning, health, emotional, social, or future-skill need of the child | need_ref, domain_ref, stage, signal_refs, urgency, support_goal |
| `ParentNeed` | A concrete support, understanding, method, emotional, collaboration, or decision need of the parent | need_ref, scene_ref, parent_role, support_type, desired_help |
| `FamilyNeed` | A shared family-system need around rhythm, trust, communication, routines, school collaboration, or service support | need_ref, family_scene, involved_roles, shared_goal |
| `GrowthSignal` | An observed or reported signal from parent, child, school, health, activity, or product behavior | signal_ref, source_type, time_window, confidence, evidence_ref |
| `Construct` | A reusable family education concept that can be assessed, observed, supported, and evaluated | construct_ref, domain_ref, definition, observable_signals, product_use |
| `SupportHypothesis` | A structured interpretation of needs and signals for support planning | hypothesis_ref, need_refs, signal_refs, rationale, confidence |
| `SupportAction` | A small parent, child, family, school, or human-service action linked to needs | action_ref, need_ref, owner_role, duration, review_method |
| `OutcomeSignal` | A later signal showing whether the need was better met or the action was useful | outcome_ref, action_ref, need_ref, observed_change, respondent |
| `TheorySource` | A theory, method, practice, or framework used to organize constructs and actions | source_ref, source_type, constructs_supported, extraction_status |
| `EvidenceSource` | A source used to support or compare a model claim | source_ref, evidence_level, claim_scope, citation_ref |
| `FamilyMemoryProfile` | Longitudinal family memory across needs, actions, outcomes, conversations, artifacts, and human review | family_ref, active_need_refs, action_memory_refs, outcome_memory_refs, conversation_summary_refs |
| `DialogueSession` | A realtime role-aware exchange with parent, child, teacher, or human-service participant | session_ref, participant_roles, intent_refs, active_need_refs, memory_update_candidate_refs |
| `DialogueTurn` | One structured conversation turn that can produce signals, questions, or memory candidates | turn_ref, speaker_role, input_modality, artifact_refs, extracted_signal_refs |
| `MultimodalArtifact` | A text, image, photo, audio, video, document, chart, code, or mixed artifact used as contextual signal | artifact_ref, artifact_type, source_context, provenance_ref, consent_ref |
| `MemoryUpdateCandidate` | A proposed memory update derived from assessment, conversation, action review, or artifact interpretation | candidate_ref, target_memory_ref, source_ref, proposed_change, validation_status |

## 9.1 AI-Era Gap Analysis

The reverse-analysis document `FAMILY_EDUCATION_AI_ERA_MODEL_GAP_ANALYSIS.md` identifies nine capability gaps that must be filled before the model can be considered an AI-era family education large model:

- longitudinal family memory;
- realtime dialogue and exchange;
- multimodal perception and artifact understanding;
- developmental trajectory modeling;
- learning and cognitive diagnosis without ranking;
- family-system dynamics modeling;
- human-service collaboration intelligence;
- evaluation, simulation, and intervention learning;
- governance, localization, and ecosystem extensibility.

These are not optional product features. They are model capability layers that must be represented in registries, schemas, evaluation sets, and downstream implementation tasks.

## 9.2 Memory and Realtime Dialogue Boundary

Memory and realtime dialogue must obey the same Family boundaries as assessment and intervention:

- memory is not a fact store by default; it preserves source, role, time window, confidence, and evidence level;
- conversation output is not a decision; it can produce a `SupportHypothesis`, `ClarifyingQuestion`, `ActionCandidate`, or `MemoryUpdateCandidate`;
- core state updates still require Named Action or approved event flows;
- high-risk or professional-service scenarios require Human Gate;
- child-created multimodal artifacts must be used for support planning and growth reflection, not ranking.

## 10. Domain System

| Domain ref | Domain | What the model captures |
| --- | --- | --- |
| `CHILD_NEEDS` | Child needs | Physical, emotional, relationship, learning, identity, social, digital, and future-skill needs |
| `PARENT_NEEDS` | Parent needs | Understanding, method, emotional support, collaboration, decision support, feedback |
| `FAMILY_SHARED_NEEDS` | Family shared needs | Common goals, routines, reduced conflict, trust, school alignment, growth records |
| `PHYSICAL_HEALTH` | Physical health | Growth, sleep, movement, nutrition, eyesight, posture, puberty, energy, recovery |
| `PSYCHOSOMATIC_WELLBEING` | Psychosomatic wellbeing | Stress body signals, fatigue, sleep disruption, appetite change, emotion-body recovery |
| `DEVELOPMENTAL_FOUNDATIONS` | Child development foundations | Developmental psychology, educational psychology, learning science, family systems, SEL |
| `ACADEMIC_K12` | Academic and K12 learning | Subjects, homework, exams, learning strategy, motivation, feedback, pressure, school-family collaboration |
| `AI_LITERACY` | AI literacy | AI concepts, AI tool use, prompt/task design, verification, data privacy, ethics, human-AI collaboration |
| `MULTIMODAL_LITERACY` | Multimodal literacy | Text, image, audio, video, data, code, presentation, creative production, cross-modal translation |
| `MULTIPLE_INTELLIGENCES` | Multiple intelligences | Linguistic, logical-mathematical, spatial, bodily, musical, interpersonal, intrapersonal, naturalistic strengths |
| `DERMATOGLYPHICS_PRACTICE` | Dermatoglyphics theory and practice | Fingerprint/palm-pattern concepts, report claims, consultation process, parent expectation, service pattern |
| `PARENTING` | Parenting model | Beliefs, response style, involvement, consistency, boundaries, encouragement, repair |
| `RELATIONSHIP` | Family relationship | Trust, communication, conflict cycle, repair, affection, shared meaning |
| `FAMILY_SYSTEM` | Family system | Structure, roles, routines, resources, stressors, sibling/grandparent context |
| `DIGITAL_LIFE` | Digital life | Device use, media content, games, short video, online safety, privacy, sleep, family rules |
| `VALUES_CHARACTER` | Values and character | Responsibility, integrity, empathy, perseverance, contribution, citizenship, life purpose |
| `SOCIAL_COMPETENCE` | Social competence | Peer relationship, collaboration, boundaries, leadership, conflict handling, community participation |
| `HUMAN_SERVICE` | Human service network | Educators, counselors, doctors, social workers, community programs, service follow-up |

## 11. Need Taxonomy V0.1

### 11.1 ChildNeed

| Need ref | Need family | Signals to model |
| --- | --- | --- |
| `CHILD_PHYSICAL_HEALTH_NEED` | Physical health | poor sleep, low energy, limited movement, eyesight strain, posture fatigue, puberty confusion |
| `CHILD_EMOTIONAL_SUPPORT_NEED` | Emotional support | frustration, irritability, withdrawal, fear of failure, difficulty recovering after conflict |
| `CHILD_RELATIONSHIP_NEED` | Relationship | low trust, unwillingness to talk, repeated conflict, lack of repair, feeling misunderstood |
| `CHILD_LEARNING_SUPPORT_NEED` | Learning | homework delay, subject gap, low strategy, weak feedback use, low self-efficacy |
| `CHILD_IDENTITY_STRENGTH_NEED` | Identity and strengths | unclear strengths, low confidence, lack of voice, excessive comparison, weak future imagination |
| `CHILD_SOCIAL_NEED` | Social | peer conflict, isolation, boundary problems, collaboration difficulty, social anxiety signals |
| `CHILD_DIGITAL_AI_NEED` | Digital and AI-era growth | device conflict, passive media use, AI misuse, weak verification, privacy confusion |

### 11.2 ParentNeed

| Need ref | Need family | Signals to model |
| --- | --- | --- |
| `PARENT_UNDERSTANDING_NEED` | Understanding | cannot read child signals, disagreement about cause, confusing school feedback |
| `PARENT_METHOD_NEED` | Method | does not know what to say, how to set rules, how to help homework, how to review action |
| `PARENT_EMOTIONAL_SUPPORT_NEED` | Parent support | anxiety, anger, guilt, burnout, comparison pressure, helplessness |
| `PARENT_LEARNING_NEED` | Parent learning | wants knowledge about development, psychology, AI-era learning, communication, health |
| `PARENT_COLLABORATION_NEED` | Collaboration | needs teacher communication, spouse alignment, grandparent alignment, service navigation |
| `PARENT_DECISION_NEED` | Decision support | needs to choose priority, learning support, activity, intervention, or professional resource |
| `PARENT_FEEDBACK_NEED` | Feedback | wants to know whether an action worked and what to adjust next |

### 11.3 FamilyNeed

| Need ref | Need family | Signals to model |
| --- | --- | --- |
| `FAMILY_RHYTHM_NEED` | Rhythm | unstable sleep/homework/mealtime rhythm, repeated rushed routines |
| `FAMILY_COMMUNICATION_NEED` | Communication | repeated arguments, low listening, unclear agreements, poor repair |
| `FAMILY_LEARNING_ENVIRONMENT_NEED` | Learning environment | noisy learning context, inconsistent rules, unclear parent role, weak resource match |
| `FAMILY_SCHOOL_ALIGNMENT_NEED` | School-family alignment | teacher feedback not translated into family action, school-family disagreement |
| `FAMILY_SUPPORT_NETWORK_NEED` | Support network | family lacks expert, peer, community, or service resources |
| `FAMILY_GROWTH_RECORD_NEED` | Growth record | family cannot see progress, effort, pattern, or next step over time |

## 12. Construct Registry Seed

| Construct ref | Domain ref | Definition | First product use |
| --- | --- | --- | --- |
| `ACADEMIC_DEVELOPMENT` | `ACADEMIC_K12` | How the child learns in school contexts and turns feedback into progress | academic support plan |
| `SUBJECT_LEARNING_PROFILE` | `ACADEMIC_K12` | Subject-specific strengths, gaps, confidence, interest, and misconceptions | K12 learning support |
| `HOMEWORK_PROCESS` | `ACADEMIC_K12` | How homework starts, continues, receives help, and gets reviewed | UI-02/03 learning path |
| `LEARNING_STRATEGY_METACOGNITION` | `ACADEMIC_K12` | Planning, review, error correction, self-checking, transfer, and reflection | study-method action matching |
| `PHYSICAL_HEALTH_RHYTHM` | `PHYSICAL_HEALTH` | Sleep, movement, nutrition, eyesight, posture, energy, and recovery rhythm | health habit action design |
| `PSYCHOSOMATIC_STRESS_SIGNAL` | `PSYCHOSOMATIC_WELLBEING` | Body signals that appear with stress, fatigue, learning pressure, or conflict | wellbeing intake |
| `DEVELOPMENTAL_STAGE_TASK` | `DEVELOPMENTAL_FOUNDATIONS` | Age-stage developmental tasks in cognition, emotion, autonomy, identity, and social life | assessment branching |
| `EDUCATIONAL_PSYCHOLOGY_MECHANISM` | `DEVELOPMENTAL_FOUNDATIONS` | Motivation, attribution, self-efficacy, feedback, transfer, and learning environment mechanisms | action rationale |
| `AI_LITERACY_FLUENCY` | `AI_LITERACY` | Ability to use AI tools for learning, creating, checking, and reflecting | AI-era learning guidance |
| `MULTIMODAL_CREATION` | `MULTIMODAL_LITERACY` | Ability to express and create across text, image, audio, video, data, code, and presentation | project learning |
| `MULTIPLE_INTELLIGENCE_PROFILE` | `MULTIPLE_INTELLIGENCES` | Observed strengths across eight intelligence lenses and real scenes | strength discovery |
| `DERMATOGLYPHICS_PRACTICE_SIGNAL` | `DERMATOGLYPHICS_PRACTICE` | Dermatoglyphics report, consultation claim, and parent expectation as practice input | source registry and comparison |
| `PARENT_CHILD_COMMUNICATION` | `RELATIONSHIP` | Trust, listening, expression, conflict cycle, and repair quality | communication support |
| `DEVICE_USE_CONTEXT` | `DIGITAL_LIFE` | Device impact on sleep, learning, rules, conflict, and family routines | media-plan action matching |
| `PARENT_CAPACITY` | `PARENTING` | Parent stress, time, emotional bandwidth, and consistency capacity | support intensity routing |
| `FAMILY_ROUTINE` | `FAMILY_SYSTEM` | Stable rhythms, agreements, rituals, and review mechanisms | family action planning |
| `SCHOOL_FAMILY_COLLABORATION` | `HUMAN_SERVICE` | Alignment among school, teacher, parent, and child support | school-family handoff |

## 13. Input Model

| Input family | Examples | Stored as |
| --- | --- | --- |
| Parent perspective | parent answers, concerns, goals, observations | `Perspective` / assessment response |
| Child perspective | child self-report, preference, goal, reflection | `Perspective` / child voice record |
| Academic evidence | score, homework, teacher comment, project, attendance | `EvidenceSource` / academic evidence |
| Health evidence | sleep record, exercise record, health visit note, eyesight note | `EvidenceSource` / health evidence |
| Product behavior | completion, skip, selected focus, action feedback | event / outcome signal |
| Human review | educator/counselor/teacher labels and notes | human review label |
| External practice report | dermatoglyphics report, tutoring report, school report, assessment report | source artifact / practice signal |
| Knowledge source | theory, research, program, guideline, practice case | theory/evidence registry |

## 14. Output Model

| Output | Meaning | Example |
| --- | --- | --- |
| `NeedSummary` | Structured summary of child, parent, and family needs | child learning support need + parent method need |
| `SupportHypothesis` | Why these needs may be appearing together | homework conflict may involve strategy gap, parent anxiety, and sleep rhythm |
| `ActionCandidate` | Candidate small action linked to a need | 7-day homework start ritual |
| `ParentLearningPath` | Parent knowledge path linked to current need | adolescent autonomy + feedback language |
| `ChildPracticePath` | Child practice path linked to current need | error-correction routine + self-check form |
| `FamilyRoutinePlan` | Shared routine or agreement | sleep/homework/device rhythm review |
| `SchoolFamilyHandoff` | Structured points for teacher communication | subject gap, observed effort, requested feedback |
| `HumanServiceReferralContext` | Context package for human support | family need, signals, tried actions, outcome feedback |
| `OutcomeReview` | Follow-up on whether the need was better met | tried/useful/completed/adjusted |

## 15. Modeling Flow V0.1

```text
Family context
  -> ChildNeed / ParentNeed / FamilyNeed identification
  -> Domain and construct mapping
  -> Signal and evidence linking
  -> SupportHypothesis
  -> ActionCandidate / LearningPath / Handoff
  -> Human confirmation or human-service review where required by product policy
  -> Named Action or structured event
  -> OutcomeReview
  -> Construct, item, action, and model improvement
```

## 16. First Modeling Deliverables

1. `NeedTaxonomyV0.1`: child, parent, family needs.
2. `ConstructRegistryV0.1`: construct refs, definitions, domains, observable signals, product uses.
3. `SourceRegistryV0.1`: education, psychology, health, K12, AI literacy, multimodal, multiple intelligences, dermatoglyphics, parenting, family-system sources.
4. `AssessmentItemBankV0.1`: item refs linked to constructs and needs.
5. `SupportActionCatalogV0.1`: parent/child/family/school/human-service actions linked to needs.
6. `InterpretationSchemaV0.1`: structured model output for UI-03 and later reports.
7. `EvaluationSetV0.1`: examples for need identification, action matching, explanation quality, and outcome review.

## 17. Next Schema Candidates

These should be drafted next as YAML or JSON schema under the appropriate approved spec area:

- `family_education_domain.registry.yaml`
- `family_education_need.registry.yaml`
- `family_education_construct.registry.yaml`
- `family_education_source.registry.yaml`
- `family_assessment_interpretation.schema.yaml`
- `family_support_action.catalog.yaml`
- `family_outcome_signal.schema.yaml`

## 18. Initial Product Mapping

| Product surface | Model role |
| --- | --- |
| UI-02 | Intake for parent perspective, selected focus, and first need signals |
| UI-03 | Need summary, support hypothesis, explanation, first action candidate |
| Reports | Longer growth interpretation, evidence map, parent learning path, family plan |
| Action menu | Need-linked small actions and routines |
| Human service | Review, label, refine, and support complex cases |
| Small model | Need classification, construct mapping, action matching, explanation drafting |
| Knowledge layer | Theory/evidence/practice source registry and extraction workflow |

## 19. Roadmap to Tens of Millions of Families

| Phase | Scale target | Model focus | Key asset to build |
| --- | --- | --- | --- |
| M0 | internal and expert review | stable domain and need taxonomy | model doc, registry drafts, expert scenario cards |
| M1 | first 100 families | UI-02/UI-03 intake and interpretation | assessment item bank, deterministic baseline, review workflow |
| M2 | 1,000-10,000 families | repeated action and outcome loop | action catalog, outcome signal schema, cohort dashboard |
| M3 | 100,000 families | small-model routing and action matching | labeled dataset, offline eval set, model gateway integration |
| M4 | 1 million families | regional, age-stage, and school-context expansion | localization registry, service network integration, human review sampling |
| M5 | 10 million+ families | national-scale family education intelligence | continuous evaluation, partner ecosystem, multi-model orchestration |

## 20. Model Modularity Requirements

Every new module should declare:

- `domain_ref`
- `need_refs`
- `construct_refs`
- `supported_life_stages`
- `supported_school_stages`
- `input_sources`
- `output_types`
- `action_refs`
- `outcome_refs`
- `source_refs`
- `evaluation_metrics`
- `localization_tags`
- `service_roles`

This keeps the model extensible as Family adds new subjects, regions, AI tools, health scenarios, service partners, and research sources.
