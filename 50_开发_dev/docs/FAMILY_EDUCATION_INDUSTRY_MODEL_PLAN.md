# Family Education Industry Model Plan

## 1. Strategic Position

Family should not only build a family assessment feature. It should build a Family Education Industry Model: a reusable domain model for understanding family education, parent-child growth, intervention design, outcome tracking, and AI-assisted family support.

This model should be designed for millions to tens of millions of families. It must be forward-looking for the AI era and extensible enough to support new age stages, K12 scenarios, AI tools, health and wellbeing needs, regional education contexts, service partners, and future family growth products.

The industry model is the platform asset. UI-02 assessment, UI-03 growth hypothesis, small models, agents, reports, and human-service workflows are downstream applications of this model.

Core value:

> Turn scattered family education experience, research evidence, program methods, and platform behavior data into a structured, evaluable, reusable Family Education intelligence system.

Scale value:

> Turn every supported family journey into privacy-aware, outcome-aware, expert-reviewable learning that improves the platform's ability to understand needs and match support at national scale.

## 2. What This Model Is

The Family Education Industry Model is not a single LLM. It is a layered domain intelligence system:

It must also be componentized by default. A domain, assessment, memory, dialogue, multimodal, action, small-model, knowledge, human-service, or localization capability should be registered as a versioned component with explicit contracts, dependencies, evaluation gates, policy boundaries, and rollback strategy.

1. Domain ontology
   - Defines Family, Parent, Child, Relationship, LifeStage, GrowthProfile, GrowthPriority, Intervention, Action, Event, Milestone, Outcome, Evidence, Perspective, and Consent.

2. Construct model
   - Defines measurable family education constructs such as learning habits, emotion regulation, parent-child communication, device-use governance, self-regulation, parental stress, family routines, school-family collaboration, and relationship repair.

3. Assessment model
   - Converts constructs into versioned question banks, response schemas, branching rules, interpretation hypotheses, safety gates, and feedback loops.

4. Intervention model
   - Maps support needs to low-risk family actions, parent learning content, parent-child activities, educator guidance, and human-service escalation.

5. Outcome model
   - Tracks whether suggested actions were tried, useful, completed, repeated, rejected, or associated with observed changes.

6. Memory and realtime dialogue layer
        - Preserves longitudinal family memory, child growth timeline, parent learning timeline, conversation summaries, artifact memory, action memory, and outcome memory. Supports realtime parent, child, teacher, and human-service dialogue with structured extraction, clarifying questions, and memory update candidates.

7. Multimodal understanding layer
        - Understands text, image, photo, audio, video, document, chart, code, and mixed artifacts as provenance-preserved family education signals. Maps artifacts to needs, constructs, actions, and outcome reviews without ranking the child.

8. Small-model layer
   - Learns structured classification, routing, retrieval, action matching, and explanation drafting from approved data.

9. Generative model layer
   - Uses Model Gateway to produce parent-facing explanations and plans, then passes Schema Validation, Policy/Safety, Human Gate, and Named Action boundaries.

## 3. What This Model Is Not

- Not a child ranking model.
- Not a family total score model.
- Not a clinical diagnosis model.
- Not an automatic parenting authority.
- Not an LLM that directly writes core ontology.
- Not a world model before causal episode and outcome foundations exist.
- Not copied wording or proprietary scoring from existing commercial scales.

## 4. Industry Model Layers

```text
Global Research + Practice Sources
        ↓
Evidence and Practice Pattern Registry
        ↓
Family Education Ontology
        ↓
Construct and Assessment Memory
        ↓
Versioned Tools and Question Banks
        ↓
Longitudinal Memory and Realtime Dialogue
        ↓
Multimodal Artifact Understanding
        ↓
Small Models for Classification / Routing / Matching
        ↓
Model Gateway for Explanation and Planning
        ↓
Policy / Safety / Human Gate
        ↓
Named Actions and Growth OS
        ↓
Outcome Feedback and Model Improvement
```

### 4.1 Build-vs-adopt strategy

The reverse gap analysis is maintained in `docs/FAMILY_EDUCATION_AI_ERA_MODEL_GAP_ANALYSIS.md`. It concludes that the model must not be treated as a questionnaire or chatbot. It must become a memory-bearing, realtime, multimodal, evaluated, service-connected family growth intelligence system.

The component contract is maintained in `docs/model/family_model_component.registry.yaml`. This registry is the first draft of how the model grows without becoming a monolith.

Family should use "bring-in and transform" rather than build everything from scratch. Mature open-source tools and industry practices should be absorbed as infrastructure, evaluation methods, development workflow, labeling workflow, retrieval stack, and baseline modeling methods. The Family Education Industry Model itself should remain Family-owned: its domain registry, need taxonomy, construct registry, item bank, action catalog, evidence rules, evaluation labels, and outcome definitions must be maintained as first-party assets.

### 4.1.1 Component expansion rule

New capabilities must enter the model as components, not scattered implementation branches.

Each component must declare:

- component ref and version;
- component kind and owner;
- input and output contract refs;
- dependency refs;
- domain, need, construct, action, outcome, memory, or artifact refs it touches;
- evaluation gates;
- policy and human-review boundaries;
- lifecycle status and rollback strategy.

The first component kinds are:

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

This lets Family add future modules such as regional K12 curriculum, AI tool coaching, adolescent mental wellbeing, parent educator service packs, or school report interpretation without rewriting the whole platform.

Adoption rule:

| Layer | Use mature tools | Family-owned asset |
| --- | --- | --- |
| Agent engineering | Codex harness, task runners, workflow automation, CI helpers | Family task protocols, review gates, model-building backlog |
| Evaluation harness | promptfoo, OpenAI Evals style patterns, DeepEval, Ragas, custom test runners | Family evaluation rubrics, scenario cards, safety gates, outcome metrics |
| Knowledge/RAG | LlamaIndex, LangChain, Haystack, vector databases, PostgreSQL retrieval | Family source registry, extraction templates, evidence grades, citation policy |
| Ontology/schema | LinkML, JSON Schema, OpenAPI, RDF/OWL tools, graph-modeling tools | Family domain refs, need refs, construct refs, action refs, outcome refs |
| Labeling/data ops | Label Studio, Argilla, DVC/LakeFS style dataset versioning | expert-labeled family scenario dataset and annotation guide |
| Small models | Hugging Face Transformers, sentence-transformers, scikit-learn/LightGBM baselines, LoRA tooling | need classifier, construct mapper, action matcher, explanation evaluator |
| Observability | OpenTelemetry, Langfuse/LangSmith style traces, event analytics | Family AI trace schema, consent-aware feedback, family outcome loop |
| Product UI/API | existing Family apps, OpenAPI, typed contracts, component libraries | UI-02/UI-03 journeys, parent reports, action plans, human-service workflows |

### 4.2 Codex harness position

Codex harness-style open-source projects are useful for building the engineering system around the model:

- converting model documents into registry files;
- generating schema candidates from approved model assets;
- running repeatable evaluation suites;
- checking whether model outputs obey structured contracts;
- producing test cases from expert scenario cards;
- automating review loops for prompts, tools, and agents;
- supporting reproducible small-model training and regression checks.

Codex harness should not be treated as the Family Education Industry Model itself. It is a development and evaluation harness. The domain intelligence must come from Family's own source registry, expert review, evidence rules, assessment results, action outcomes, and human-service feedback.

### 4.3 Mature external practices to absorb

Family should absorb mature practices in four directions:

1. Psychometrics and assessment design
        - short observable items, respondent roles, time windows, impact items, follow-up logic, repeated measurement, item quality review.

2. Education and learning-science systems
        - mastery learning, retrieval practice, formative feedback, metacognition, project-based learning, subject-specific learning profiles.

3. AI product engineering
        - structured output, schema validation, retrieval with citations, eval-first prompts, model routing, trace logging, human review sampling.

4. Data and model operations
        - dataset versioning, label guidelines, benchmark suites, offline/online evaluation, drift monitoring, cohort analysis, outcome feedback.

### 4.4 What must not be outsourced

These cannot be imported as generic tools:

- the Chinese family education domain model;
- the child-parent-family need taxonomy;
- the mapping from needs to support actions;
- the interpretation language parents can trust;
- the evidence grading and source-use policy;
- the human-service handoff standard;
- the outcome definitions for family growth;
- the long-term expert-labeled scenario dataset.

This is the platform moat. Tools can accelerate it, but they cannot replace it.

### 4.5 Recommended first tooling stack

The first implementation should stay practical:

| Need | Recommended starting point | Why |
| --- | --- | --- |
| Registry format | YAML plus JSON Schema validation | readable by experts and machines |
| Schema contracts | JSON Schema and TypeScript types | aligns with existing web/API stack |
| Evaluation | Vitest for deterministic checks, promptfoo or equivalent later | starts inside current repo, can expand to LLM evaluation |
| Knowledge storage | PostgreSQL first, vector retrieval later | avoids premature infrastructure complexity |
| Labeling | CSV/YAML scenario cards first, Label Studio/Argilla later | lets experts start labeling before building a labeling platform |
| Small-model baseline | rules + classical classifier first, sentence-transformer reranker later | creates a measurable baseline before fine-tuning |
| Agent workflow | Codex harness-style task/eval automation | good fit for registry generation, regression tests, and model improvement loops |

## 5. Full Domain Scope

The Family Education Industry Model must cover the full family education field, not only parent-child communication or a short assessment. In the AI era, family education includes academic development, K12 learning support, AI literacy, multimodal literacy, physical health, psychosomatic wellbeing, digital life, emotional development, values, relationship growth, and family-school-society collaboration.

The model should answer real needs, not only classify abstract constructs. The child's needs, the parent's needs, and the family's shared needs are the demand center of the model.

The first structured model artifact is `docs/FAMILY_EDUCATION_INTELLIGENCE_MODEL_V0_1.md`.

The first product entry can still focus on 12-15-year-old families and three high-value scenarios:

- Parent-child communication conflict.
- Learning autonomy and procrastination.
- Device use and family rule conflict.

These are entry scenarios, not the root domain. The root domain remains Family Growth across Child Growth, Parent Second Growth, Relationship Growth, and Learning Growth.

### 5.1 Domain map

| Domain | Scope | Why it belongs in family education |
| --- | --- | --- |
| Child growth | Body, emotion, cognition, character, identity, autonomy, peer relationship, developmental stage | Family is the first context where growth patterns are noticed and supported |
| Parent second growth | Parenting beliefs, emotional capacity, learning ability, reflection, consistency | Parent growth changes the environment children grow inside |
| Parent-child relationship | Trust, attachment, communication, conflict, repair, shared meaning | Relationship quality determines whether guidance can be received |
| Child needs | Safety, health, belonging, autonomy, competence, respect, learning support, emotional support, future development | The model exists to identify and respond to the child's concrete growth needs |
| Parent needs | Understanding the child, reducing anxiety, knowing what to do, communicating better, coordinating school support, finding reliable resources | The platform must support parents as learners, caregivers, decision makers, and collaborators |
| Family shared needs | Stable rhythm, reduced conflict, common goals, mutual trust, shared routines, support network | Family education is a system-level practice, not a one-person correction project |
| Academic and K12 learning | School subjects, homework, exams, learning process, motivation, strategies, teacher feedback | Academic life is one of the central daily scenes of Chinese family education |
| Educational and psychological foundations | Child development, learning science, motivation, cognition, behavior, emotion, family systems | Gives the model a professional theory base beyond experience summaries |
| Multiple intelligences | Linguistic, logical-mathematical, spatial, bodily-kinesthetic, musical, interpersonal, intrapersonal, naturalistic strengths | Helps families observe diverse development pathways beyond exam performance |
| Dermatoglyphics theory and practice | Fingerprint/palm-pattern assessment practices, consultation workflows, report formats, family usage scenes | Captures a common family-education practice category for evidence review, ontology mapping, and product comparison |
| AI literacy and future skills | AI knowledge, AI tool use, computational thinking, data literacy, prompt literacy, ethics | Families must help children become capable AI-era learners, not only consumers of tools |
| Multimodal literacy | Reading, writing, speaking, image, audio, video, code, data, embodied expression | AI-era learning and creation are increasingly multimodal, not only text or test paper based |
| Digital life and media governance | Device use, games, short video, social media, sleep, privacy, online safety | Digital behavior affects learning, emotion, relationships, and risk exposure |
| Physical health | Growth, sleep, exercise, nutrition, eyesight, posture, puberty, energy, recovery, health habits | Physical health is the foundation for learning, emotion, and long-term development |
| Psychosomatic wellbeing | Emotion, stress, body signals, fatigue, sleep disruption, somatic complaints, resilience, help-seeking | Many family education problems appear through both body and mind |
| Emotional and mental wellbeing | Emotion regulation, stress, resilience, help-seeking, risk signals | Family education must support wellbeing while respecting clinical boundaries |
| Character and values | Responsibility, integrity, empathy, perseverance, civic sense, contribution | Families transmit values through routines, modeling, decisions, and repair |
| Life habits and health | Sleep, exercise, nutrition, hygiene, time rhythm, family routines | Learning and emotion depend on basic life systems |
| Social competence | Peer interaction, collaboration, boundaries, conflict handling, communication | Children grow in social systems beyond the home |
| Family system and environment | Structure, roles, routines, resources, stressors, sibling/grandparent context | Child behavior is shaped by the whole family ecology |
| School-family collaboration | Teacher communication, school expectations, feedback loops, support plans | Many learning and behavior issues require aligned school-family action |
| Human service and professional network | Educators, counselors, doctors, social workers, community programs | AI should route to humans when expertise, safety, or accountability is needed |

### 5.2 Needs model

Family's model should begin with need understanding. A family education product is valuable only when it can answer: what does the child need, what does the parent need, what does this family need now, and what support is appropriate next.

Child needs:

- Physical needs: sleep, movement, nutrition, growth, safety, sensory comfort, illness recovery, puberty support, and daily energy.
- Emotional needs: being seen, understood, accepted, soothed, encouraged, and helped to recover after frustration.
- Relationship needs: secure connection, respectful communication, autonomy with connection, conflict repair, and stable affection.
- Learning needs: clear goals, achievable challenge, feedback, strategy, practice, help-seeking, and a sense of competence.
- Identity needs: self-understanding, strengths discovery, belonging, values, voice, and future imagination.
- Social needs: friendship, peer belonging, boundary setting, collaboration, and conflict handling.
- Digital and AI-era needs: healthy technology rhythm, safe AI use, creative tool use, media judgment, and privacy awareness.

Parent needs:

- Understanding needs: see the child's stage, signals, strengths, pressure, and context more clearly.
- Method needs: know what to say, what to do, when to pause, how to set rules, and how to review progress.
- Emotional support needs: reduce anxiety, guilt, helplessness, anger, comparison pressure, and parent burnout.
- Learning needs: learn child development, education psychology, communication, digital life, AI-era literacy, and family-system thinking.
- Collaboration needs: communicate with teachers, grandparents, spouse, counselors, and service providers.
- Decision needs: choose priorities, learning support, activities, interventions, and service resources.
- Feedback needs: know whether an action helped, whether conflict decreased, whether learning improved, and what to adjust next.

Family shared needs:

- Shared understanding of the current issue.
- A small number of agreed priorities.
- Stable routines and family agreements.
- Lower conflict intensity and better repair.
- More constructive learning environment.
- Coordinated school-family support.
- Long-term growth records that show effort, change, and next steps.

Product directions:

- Build `ChildNeed`, `ParentNeed`, and `FamilyNeed` as first-class construct families.
- Every assessment output should answer at least one concrete need.
- Every recommended action should declare which need it serves.
- Every outcome review should ask whether the need was better met.

### 5.3 Academic and K12 model

Academic development must be a first-class domain, but it must not collapse into score worship. Family should model how the child learns, how the family supports learning, and how school feedback is converted into constructive action.

Sub-constructs:

- Academic evidence: grades, homework records, exam feedback, teacher comments, attendance, assignments, projects, and portfolio work.
- Subject learning profile: strengths, gaps, interest, confidence, misconceptions, and subject-specific learning habits.
- Homework process: start difficulty, procrastination, persistence, help-seeking, parent involvement, conflict points, and completion quality.
- Learning motivation: intrinsic interest, goal clarity, self-efficacy, future orientation, avoidance, fear of failure, and comparison pressure.
- Learning strategy: planning, note-taking, retrieval practice, error correction, review cycle, metacognition, and transfer.
- Exam and feedback cycle: preparation, performance reflection, error analysis, emotional recovery, and next-step planning.
- Parent academic support: expectation setting, companionship, tutoring boundary, encouragement, supervision style, and non-shaming feedback.
- School-family collaboration: teacher communication, learning plan alignment, support requests, and shared review of progress.
- Academic pressure and wellbeing: stress, sleep impact, conflict escalation, anxiety signals, and Human Gate conditions.

Product directions:

- Academic support plan by subject, stage, and learning scene.
- Homework routine and parent involvement guidance.
- Exam feedback reflection and next-step planning.
- Teacher communication preparation and school-family review.
- Portfolio-style growth records that connect effort, strategy, feedback, and outcome.

### 5.4 AI literacy model

AI literacy is now part of family education because children will learn, create, search, communicate, and make decisions with AI systems. The model should help families build agency, judgment, safety, and creativity around AI.

Sub-constructs:

- AI concept knowledge: what AI can and cannot do, model limits, hallucination, bias, data dependence, and uncertainty.
- AI tool fluency: using AI for explanation, practice, brainstorming, coding, translation, research, feedback, and creation.
- Prompt and task design: asking clear questions, decomposing tasks, giving context, checking outputs, and iterating.
- AI-assisted learning strategy: using AI as tutor, coach, simulator, critic, and practice partner without outsourcing thinking.
- Verification literacy: source checking, fact checking, citation awareness, evidence quality, and uncertainty marking.
- Data and privacy literacy: personal information boundaries, consent, minors' data, account safety, and sharing rules.
- AI ethics and responsibility: plagiarism, fairness, attribution, manipulation, overdependence, and respectful use.
- Human-AI collaboration: deciding what AI does, what the child does, what the parent does, and when a teacher or expert is needed.

Product directions:

- Family AI-use agreement by age and learning scene.
- AI-assisted homework reflection workflow.
- Prompt practice tasks for reading, writing, coding, project inquiry, and review.
- Verification checklist for children and parents.
- Family co-learning path for AI tools and future skills.

### 5.5 Multimodal literacy model

Multimodal literacy is a key AI-era literacy. Children should be able to understand and create meaning across text, image, audio, video, data, code, diagrams, gestures, and real-world observation.

Sub-constructs:

- Text literacy: reading comprehension, writing structure, argument, summary, and reflection.
- Visual literacy: interpreting images, charts, maps, diagrams, design, and visual evidence.
- Audio and speech literacy: listening, oral expression, presentation, debate, storytelling, and tone awareness.
- Video and media literacy: understanding editing, framing, narrative, credibility, persuasion, and attention design.
- Data literacy: tables, charts, patterns, uncertainty, measurement, correlation, and basic evidence reasoning.
- Code and computational expression: algorithms, simple automation, debugging mindset, and computational problem solving.
- Creative production: turning ideas into multimodal artifacts such as reports, videos, posters, prototypes, and presentations.
- Cross-modal translation: converting text to diagram, data to story, observation to record, and concept to artifact.

Product directions:

- Multimodal creation projects for K12 topics.
- Text-to-diagram, data-to-story, image-to-explanation, and video-to-reflection tasks.
- Family presentation, storytelling, debate, and portfolio activities.
- AI-assisted creation workflow with parent-child review.

### 5.6 Multiple intelligences model

Multiple intelligences should be included as a child-growth and learning-observation lens. It helps Family avoid reducing a child to grades alone and gives parents more language to notice strengths, interests, and growth opportunities.

Sub-constructs:

- Linguistic intelligence: reading, writing, storytelling, explanation, vocabulary, argument, and narrative understanding.
- Logical-mathematical intelligence: reasoning, pattern recognition, quantitative thinking, problem decomposition, and proof-like explanation.
- Spatial intelligence: visual thinking, mental rotation, diagramming, design, map reading, geometry, and image-based reasoning.
- Bodily-kinesthetic intelligence: movement coordination, hands-on making, sports learning, craft, experiment, and embodied practice.
- Musical intelligence: rhythm, tone, auditory pattern, musical memory, expression, and composition.
- Interpersonal intelligence: empathy, collaboration, leadership, negotiation, peer support, and social judgment.
- Intrapersonal intelligence: self-awareness, goal setting, emotion reflection, self-motivation, and identity exploration.
- Naturalistic intelligence: observation of nature, classification, ecological awareness, outdoor inquiry, and environmental responsibility.

Product directions:

- Strength observation records from family, school, activities, and child self-report.
- Interest-to-learning pathway recommendations.
- Project-based learning tasks that combine multiple intelligences.
- Parent conversation prompts for discovering non-score strengths.
- Portfolio artifacts that record capability expression across scenes.

### 5.7 Dermatoglyphics theory and practice module

Dermatoglyphics and related fingerprint/palm-pattern practices should be represented as a research-and-practice module in the industry model because they appear in family education consulting, talent-discovery services, and parent decision contexts. The model should understand their concepts, service flows, reports, claims, user motivations, and market practices so Family can compare, classify, and respond professionally.

Sub-constructs:

- Practice taxonomy: fingerprint collection, pattern classification, report generation, consultation, parent interpretation, and follow-up service.
- Claim taxonomy: learning style, talent tendency, personality tendency, brain preference, attention, memory, communication, and career tendency claims.
- Parent motivation: seeking certainty, understanding the child, reducing anxiety, choosing training paths, or making education investment decisions.
- Report structure: measured item, interpretation text, suggested development area, training advice, and family action advice.
- Evidence review object: what claims are asserted, what evidence is cited, what data is collected, what conclusion is made, and how it influences family decisions.
- Product comparison object: pricing, service process, age range, output format, consultant role, follow-up mechanism, and risk communication style.

Product directions:

- Add dermatoglyphics to the source registry as a distinct practice category.
- Build a structured extraction template for dermatoglyphics reports and consultation flows.
- Compare dermatoglyphics-derived claims with Family's observation, assessment, school feedback, and outcome data.
- Use it as one input to understand family beliefs and expectations when parents already bring such reports into consultation.
- Support evidence-aware parent education content about talent discovery, observation, and long-term growth planning.

### 5.8 Child development foundations

The model should include education, psychology, and child-development foundations as the professional base for all assessment and intervention design.

Sub-constructs:

- Developmental psychology: age-stage development, adolescence, identity, autonomy, peer influence, moral development, and parent separation-individuation.
- Educational psychology: motivation, self-efficacy, attribution, goal orientation, feedback, mindset, deliberate practice, transfer, and classroom-family interaction.
- Learning science: memory, attention, retrieval practice, spacing, interleaving, cognitive load, metacognition, and formative assessment.
- Cognitive development: executive function, working memory, planning, abstraction, reasoning, language, and problem solving.
- Social-emotional learning: self-awareness, self-management, social awareness, relationship skills, and responsible decision-making.
- Family systems theory: roles, rules, boundaries, communication patterns, triangulation, sibling/grandparent dynamics, and system stress.
- Attachment and relationship science: security, trust, responsiveness, repair, emotional availability, and relational safety.
- Behavior science: antecedent-behavior-consequence patterns, reinforcement, habit loops, environmental design, and behavior shaping.
- Positive psychology: strengths, resilience, meaning, gratitude, hope, engagement, and wellbeing.
- Cultural and ecological context: school culture, community resources, family socioeconomic context, migration, regional education norms, and intergenerational beliefs.

Product directions:

- Build a theory registry that links constructs, item banks, action catalogs, and evaluation labels.
- Map each parent-facing action to at least one educational or psychological mechanism.
- Use age-stage templates for K12 and adolescence.
- Build parent learning paths around development, learning science, communication, emotion, digital life, and AI-era growth.

### 5.9 Physical health and psychosomatic wellbeing model

Children's physical health and psychosomatic wellbeing must be part of the family education model because learning, emotion, behavior, motivation, and family conflict often sit on top of sleep, movement, nutrition, development, fatigue, and stress.

Sub-constructs:

- Growth and development: height, weight, puberty stage, body changes, developmental timing, self-image, and parent-child communication about growth.
- Sleep and recovery: bedtime rhythm, sleep duration, sleep quality, morning energy, weekend rhythm, naps, screen influence, and exam-period recovery.
- Exercise and movement: daily activity, sports interest, motor confidence, outdoor time, sedentary time, body coordination, and family exercise routine.
- Nutrition and eating rhythm: breakfast, meal regularity, picky eating, hydration, energy stability, family meals, and food-related conflict.
- Eyesight and posture: reading distance, screen posture, outdoor time, eye-rest habits, desk setup, and long-study body load.
- Physical safety and self-care: injury prevention, hygiene, illness management, medication routine when applicable, and age-appropriate self-care.
- Stress body signals: headache, stomachache, fatigue, chest tightness, sleep disruption, appetite changes, and exam/body stress expression.
- Psychosomatic regulation: breathing, relaxation, body awareness, movement breaks, emotional labeling, and recovery routines.
- Health-service collaboration: parent observation, school health feedback, medical visit records, and follow-up reminders.

Product directions:

- Add physical health and psychosomatic wellbeing to assessment intake and growth records.
- Link learning issues with sleep, movement, nutrition, and stress context when appropriate.
- Build family routine actions for sleep, exercise, meal rhythm, eye protection, and recovery.
- Create parent-child conversation prompts for puberty, body changes, stress, and health habits.
- Support evidence records from parent observation, child self-report, school feedback, and professional health records when available.

### 5.10 Full model content checklist

The Family Education Industry Model should therefore contain these content systems:

1. Family ontology: people, roles, relationships, events, consent, actions, outcomes, evidence, and perspectives.
2. Needs model: child needs, parent needs, family shared needs, support matching, and need-outcome review.
3. Child development model: physical, cognitive, emotional, social, moral, identity, autonomy, and future skills.
4. Physical health model: growth, sleep, movement, nutrition, eyesight, posture, puberty, safety, and recovery.
5. Psychosomatic wellbeing model: stress, body signals, emotion-body interaction, resilience, and help-seeking.
6. Academic/K12 model: subjects, homework, exams, strategy, motivation, feedback, pressure, and school-family collaboration.
7. AI-era literacy model: AI knowledge, AI tools, prompt/task design, verification, privacy, ethics, and human-AI collaboration.
8. Multimodal literacy model: text, image, audio, video, data, code, presentation, creation, and cross-modal translation.
9. Multiple intelligences model: eight intelligence lenses and project/portfolio expression paths.
10. Dermatoglyphics practice model: theory terms, report patterns, consultation practices, parent expectations, and evidence-review mapping.
11. Parenting model: parenting beliefs, response style, involvement, consistency, boundaries, encouragement, and repair.
12. Family relationship model: communication, conflict, trust, rituals, shared meaning, and relationship recovery.
13. Family system model: structure, resources, stressors, routines, roles, sibling/grandparent context, and environmental supports.
14. Digital life model: device use, media content, games, short video, online safety, privacy, sleep, and family rules.
15. Mental wellbeing model: stress, emotion regulation, resilience, help-seeking, risk signals, and service referral pathways.
16. Values and character model: responsibility, integrity, empathy, perseverance, contribution, citizenship, and life purpose.
17. Health and life rhythm model: sleep, exercise, diet, physical development, routine stability, and recovery.
18. Social competence model: peer relationships, collaboration, boundaries, leadership, conflict handling, and community participation.
19. Intervention model: parent learning, family practice, child practice, school collaboration, human service, and outcome review.
20. Evaluation model: item quality, hypothesis quality, action usefulness, parent readability, child experience, human review, and outcome signal.
21. Knowledge and evidence model: source registry, theory registry, practice registry, evidence grading, extraction templates, and update workflow.

## 6. Core Constructs V1

| Construct | Meaning | Primary product use |
| --- | --- | --- |
| Academic development | How the child learns in school contexts, responds to homework/exams, and converts feedback into progress | academic support plan, UI-02/03 learning hypotheses, school-family handoff |
| Subject learning profile | Subject-specific strengths, gaps, confidence, interest, and misconceptions | K12 learning support, tutoring boundary, teacher communication |
| Child need | Concrete child needs across health, emotion, learning, relationship, identity, social life, digital life, and future skills | intake interpretation, support matching, outcome review |
| Parent need | Parent needs for understanding, methods, emotional support, collaboration, decision support, and feedback | parent learning path, service routing, product personalization |
| Family shared need | Shared family needs for rhythm, agreement, trust, lower conflict, school coordination, and growth record | family action planning, review meeting, human-service handoff |
| Physical health | Growth, sleep, movement, nutrition, eyesight, posture, puberty, safety, and recovery | health habit actions, learning readiness context, family routine design |
| Psychosomatic wellbeing | Interaction between stress, emotion, sleep, fatigue, body signals, and recovery | wellbeing intake, stress support, parent-child care planning |
| Developmental stage | Age-stage tasks, autonomy, identity, cognition, emotion, social relation, and parent-child transition | assessment branching, parent education, age-stage action design |
| Educational psychology | Motivation, attribution, self-efficacy, feedback use, transfer, and learning environment | learning support interpretation, parent guidance, action mechanism mapping |
| Multiple intelligences | Diverse strengths across linguistic, logical, spatial, bodily, musical, interpersonal, intrapersonal, and naturalistic domains | strength discovery, project pathway, portfolio growth record |
| Dermatoglyphics practice signal | Fingerprint/palm-pattern consulting concepts, report claims, parent usage scenes, and evidence-review objects | source registry, practice comparison, parent belief/context intake |
| Learning habits | How the child starts, persists, and completes learning tasks under family support | UI-02 assessment, learning action menu |
| Learning strategy and metacognition | Planning, review, error correction, self-checking, transfer, and reflection | study-method coaching, action matching, outcome tracking |
| AI literacy | Child and parent ability to use AI tools safely, honestly, creatively, and critically | AI-era learning guidance, family AI rules, future skill pathway |
| Multimodal literacy | Ability to understand and create across text, image, audio, video, data, code, and real-world observation | project-based learning, creation tasks, AI-assisted learning design |
| Emotion regulation | How child and parent notice, express, pause, recover, and repair after emotional triggers | conflict support, parent response guidance |
| Parent-child communication | Trust, listening, expression, conflict cycle, and repair quality | communication diagnosis-free support hypotheses |
| Device-use context | Device impact on sleep, learning, rules, conflict, and family routines | media-plan and routine-action matching |
| Self-regulation | Planning, delay, execution, review, autonomy, and supervision dependence | habit-building intervention matching |
| Parent capacity | Parent stress, time, emotional bandwidth, and consistency capacity | support intensity and human-service routing |
| Family routine | Stable rhythms, agreements, rituals, review mechanisms | action design and outcome tracking |
| School-family collaboration | Whether school, teacher, and family support are aligned | educator/human-service escalation |
| Relationship repair | Whether the family can reconnect after conflict | safety and intervention prioritization |
| Values and character | Responsibility, empathy, integrity, perseverance, contribution, and respect | family mission, parent modeling, growth reflection |
| Social competence | Peer relationship, collaboration, boundaries, help-seeking, and conflict handling | adolescent support, school-family coordination |
| Health and life rhythm | Sleep, movement, nutrition, routine stability, and recovery | learning readiness, emotion support, family habit actions |

## 7. Model Capability Matrix

| Capability | Deterministic first | Small model | LLM via gateway | Human gate |
| --- | --- | --- | --- | --- |
| Consent and authorization | Yes | No | No | When needed |
| Item/schema validation | Yes | No | No | No |
| Risk keyword tripwire | Yes | Optional support | No direct release | Yes |
| Dimension classification | Baseline rules | Yes | Optional | Review sample |
| Support hypothesis generation | Template baseline | Yes | Yes, structured | For high-risk |
| Action matching | Rule catalog | Yes | Optional explanation | For sensitive actions |
| Parent-facing explanation | Template baseline | Optional | Yes | For high-risk |
| Outcome trend summary | Yes | Later | Yes, bounded | For disputed/high-risk |
| Causal claim | No | No | No | Research only |

## 8. Small Model Strategy

The first small model should be narrow and structured. It should not replace the ontology or the safety gates.

### 8.1 Model V0: deterministic baseline

Purpose:

- Create gold-standard schemas and rule baselines before training.
- Validate that data contracts, labels, and evaluation metrics are stable.

Tasks:

- Map responses to dimension hypotheses.
- Detect Human Gate conditions.
- Match support-action references.
- Produce structured JSON only.

### 8.2 Model V1: small classifier/ranker

Purpose:

- Learn better routing and action matching from expert-labeled cases.

Inputs:

- LifeStage.
- Respondent role.
- Assessment item responses.
- Optional family context features allowed by consent.
- Prior action feedback summaries.

Outputs:

```json
{
  "primary_dimension": "PARENT_CHILD_COMMUNICATION",
  "secondary_dimensions": ["EMOTION_REGULATION"],
  "signals": ["communication_repair_needed", "parent_response_pattern"],
  "risk_gate": "NONE",
  "support_hypothesis_ref": "COMMUNICATION_REPAIR_SUPPORT",
  "recommended_action_refs": ["COMMUNICATION_7DAY_LISTENING_ROUTINE"],
  "confidence": "medium"
}
```

Training data:

- Expert-labeled synthetic cases.
- Research-derived scenario cards.
- De-identified product cases with explicit consent.
- Human educator review labels.
- Outcome feedback such as tried/useful/completed/rejected.

Forbidden training use:

- Raw private family free text without explicit consent and de-identification.
- Child ranking labels.
- Diagnosis labels.
- Proprietary copied questionnaire text or scoring keys.

### 8.3 Model V2: domain-tuned language model

Purpose:

- Generate better parent-facing explanations and plans while preserving structured output.

Constraints:

- Must run through Model Gateway.
- Must output approved schema.
- Must pass safety and policy gates.
- Must not write canonical state.
- Must not claim causality without outcome evidence.

Candidate approaches:

- Distill from stronger models into a smaller Family Education model.
- LoRA/SFT on approved expert-reviewed examples.
- Retrieval-augmented generation over Family's evidence and action catalog.
- Preference tuning from expert and parent usefulness feedback.

## 9. Data Foundation

The model needs a governed data foundation before it becomes valuable.

Required datasets:

- Construct registry.
- Source and evidence registry.
- Versioned item banks.
- Assessment response events.
- Human-review labels.
- Support-action catalog.
- Parent feedback and outcome events.
- Safety and escalation cases.
- Negative examples: what the model must refuse or route to human review.

Required labels:

- `primary_dimension`.
- `secondary_dimensions`.
- `support_need_ref`.
- `risk_gate`.
- `action_ref`.
- `explanation_quality`.
- `safety_verdict`.
- `human_review_verdict`.
- `outcome_signal`.

## 10. Evaluation Gates

A Family Education Industry Model is valuable only if it can be evaluated.

Minimum evaluation metrics:

- Dimension classification agreement with expert labels.
- Human Gate recall on high-risk examples.
- Unsupported diagnosis rate must be 0.
- Child/family ranking output rate must be 0.
- Schema validity rate.
- Action match usefulness rate.
- Parent readability and non-shaming language score.
- Follow-up action completion rate.
- Human reviewer override rate.

Release gate:

- No product release if safety recall, schema validity, or no-diagnosis/no-ranking invariants fail.

## 11. Product Integration

### UI-02

UI-02 is the first intake surface. It should collect structured Perspective data and show clear parent value without presenting scores.

### UI-03

UI-03 should become the first interpretation surface. It should show:

- Primary support hypothesis.
- Why this hypothesis was generated.
- One conversation starter.
- One 7-day low-risk action.
- Boundary copy: not diagnosis, not score.
- Parent confirmation before any Named Action.

### Human service

Human educators and counselors should be able to review:

- Assessment summary.
- Model hypothesis.
- Suggested actions.
- Safety flags.
- Parent feedback and outcome signals.

Their review becomes labeled data for the industry model.

## 12. Roadmap

### Phase 0: Model Constitution

- Create this plan.
- Align Product North Star, AI Minimum Architecture, and Family Assessment Skill.
- Register capability truth and forbidden claims.

### Phase 1: Domain Corpus

- Build source registry from global tools and Chinese family education practice.
- Extract constructs and practice patterns.
- Version evidence anchors.

### Phase 2: Structured Dataset

- Generate expert-reviewed scenario cards.
- Label support needs, risk gates, and action refs.
- Build deterministic baseline and evaluation set.

### Phase 3: Small Model V1

- Train or fine-tune a compact classifier/ranker.
- Compare against deterministic baseline.
- Run offline safety and usefulness evaluations.

### Phase 4: Product Pilot

- Use small model only as recommendation support.
- Keep human confirmation and Named Action boundaries.
- Collect parent and expert feedback.

### Phase 5: Domain-Tuned Model

- Distill or tune a smaller Family Education language model.
- Use retrieval over Family evidence and action catalog.
- Continue gated, structured output only.

## 13. Immediate Next Build Tasks

1. Convert `FAMILY_EDUCATION_INTELLIGENCE_MODEL_V0_1.md` into YAML registries for domains, needs, constructs, sources, actions, and outcomes.
2. Create a Family Education construct registry.
3. Create a source/evidence registry for global assessment and parenting methods.
4. Expand UI-02 v3 item bank with impact, parent-context, needs, health, academic, AI-literacy, and multimodal follow-up questions.
5. Define `FamilyAssessmentInterpretationV1` JSON schema.
6. Add deterministic interpretation baseline for UI-03.
7. Add evaluation fixtures for need identification, action matching, explanation quality, and Human Gate recall.
8. Design first 100 expert-labeled scenario cards for the small model.

## 14. Decision

Family should build the Family Education Industry Model as a long-term platform asset.

The first model should be a narrow, structured small model for support-need recognition and action matching. The larger industry value comes from the combination of ontology, evidence, structured assessment, interventions, outcomes, expert feedback, and model iteration, not from a standalone LLM alone.
