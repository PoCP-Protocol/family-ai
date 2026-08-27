# Family Assessment AI Skill Global Research Map

## 1. Purpose

This document records global research and practice patterns that can be converted into the Family Assessment AI Skill for UI-02 and later assessment flows.

This document is a downstream research map of `docs/FAMILY_EDUCATION_INDUSTRY_MODEL_PLAN.md`. The industry model defines the platform-level ontology, constructs, small-model route, evaluation gates, and outcome loop; this document focuses on the assessment-specific research corpus and Skill conversion.

The goal is not to copy one mature questionnaire into the product. The goal is to learn the architecture of mature family, parenting, child behavior, child development, health, psychosomatic wellbeing, academic/K12 learning, AI literacy, multimodal literacy, and digital-wellbeing assessments, then synthesize Family's own versioned item bank, branching logic, interpretation workflow, and outcome feedback loop.

## 2. Boundary

- Research sources are method inputs, not automatic product claims.
- Public instruments and commercial programs may inform constructs, flow, scales, and intervention linkage, but Family must write its own item text and validation notes.
- Parent answers are `Perspective`, not `Fact`.
- Assessment outputs are hypotheses and next-step support suggestions, not diagnosis, ranking, or total family score.
- High-risk signals must route to Human Gate.
- Model interpretation must go through Model Gateway and structured validation before any Named Action.

## 3. Global Sources Scanned

| Source | Type | What it contributes to Family Skill | Use in Family |
| --- | --- | --- | --- |
| SDQ, Strengths and Difficulties Questionnaire | child behavioral screener, ages 2-17 | brief multi-scale structure, impact supplement, parent/teacher/self respondent versions, follow-up design | learn short-screening architecture and impact follow-up pattern |
| Pediatric Symptom Checklist | psychosocial screening questionnaire | parent-report symptom screening, concise item bank, clinical referral boundary | learn safety triage and non-diagnostic screening boundaries |
| PHQ / GAD-7 screeners | mental-health screener pattern | short time-windowed Likert items, severity banding, referral boundary | learn compact item style only; do not turn family assessment into diagnosis |
| McMaster Family Assessment Device | family functioning theory/instrument | problem solving, communication, roles, affective responsiveness, affective involvement, behavior control | anchor family-system dimensions and avoid only child-centered framing |
| FACES / Circumplex Model | family cohesion/adaptability model | balance of closeness, flexibility, communication | inform parent-child communication and family-routine context |
| SCORE-15 | systemic family therapy outcome measure | repeated measurement, family functioning and therapeutic change tracking | learn outcome-loop and progress-tracking pattern |
| Alabama Parenting Questionnaire | parenting practice measure | involvement, positive parenting, discipline, monitoring, consistency | inform parent behavior and device/routine governance questions |
| Parenting Scale | parenting discipline style measure | laxness, over-reactivity, verbosity patterns | inform parent response-pattern probes without blaming language |
| Parenting Stress Index | parenting stress assessment | parent distress, child demands, parent-child dysfunctional interaction | inform parent capacity/context questions and support threshold |
| PAFAS, Parenting and Family Adjustment Scales | parenting and family adjustment measure | parent adjustment, family relationships, coercive parenting, consistency | bridge child behavior, parent wellbeing, and family functioning |
| Family Check-Up | assessment-feedback-intervention model | ecological assessment, motivational interviewing, feedback session, tailored parenting support | key workflow model: assess -> feedback -> choose small action -> review outcome |
| Triple P | evidence-based parenting program | levels of intensity, parenting skills, self-regulation orientation | inform stepped-care support menu |
| Strengthening Families Program 10-14 | family skills program | joint parent-child sessions, communication and protective factors for early adolescents | inform parent-child communication and teen transition logic |
| Incredible Years | parenting/child social-emotional program | parent practice, child emotion/social skills, teacher/family ecosystem | inform practice activities after assessment |
| FAST, Families and Schools Together | school-family-community intervention | school-family connection and multi-family support format | inform education ecosystem routing when school support is needed |
| CDC Essentials for Parenting | public-health parenting guidance | behavior-focused parent resources, videos, activities, age coverage | inform plain-language family actions |
| Harvard Serve and Return | child development framework | responsive interaction, caregiver stress context, early relational health | anchor parent-child communication and emotional repair |
| UNICEF Parenting | global parenting resource hub | developmental milestones, child wellbeing, digital parenting, practical caregiver content | inform age-stage localization and parent-friendly content |
| AAP 5 Cs of Media Use | family media framework | Child, Content, Calm, Crowding Out, Communication | direct model for device-use context dimension |
| AAP Family Media Plan / Common Sense Family Tech Planners | family technology planning tools | family agreements, conversation prompts, routines, age-stage device rules | convert assessment findings into collaborative device-plan actions |
| K12 academic learning research | school learning and study-skills research | homework process, motivation, self-efficacy, metacognition, feedback use, subject learning profile | extend Learning habits into a full Academic and K12 domain without ranking or score worship |
| AI literacy frameworks | AI education and digital competence frameworks | AI concepts, tool fluency, prompt/task design, verification, privacy, ethics, human-AI collaboration | define AI-era family education skill paths and safety boundaries |
| Multimodal literacy frameworks | media, information, data, visual, audio, video, code, and creative production literacy | cross-modal comprehension, creation, evaluation, and communication | help children shift from passive media consumption to multimodal learning and creation |
| Child development and educational psychology | developmental science, learning science, motivation, social-emotional learning | age-stage tasks, self-efficacy, executive function, feedback, family systems, emotion-learning interaction | ground item design and parent actions in child-growth mechanisms |
| Child health and psychosomatic wellbeing | pediatric health education, sleep, exercise, nutrition, stress-body interaction | sleep, movement, growth, puberty, fatigue, body stress signals, recovery routines | connect learning and behavior support with physical and mental wellbeing context |
| Parent and child needs research | family support needs, caregiver burden, parent education, child voice | child needs, parent needs, family shared needs, help-seeking, service navigation | make assessment output answer real family needs rather than only naming dimensions |

## 4. What Family Should Absorb

### 4.1 Instrument design

- Use short observable items with a recent time window.
- Separate screening, interpretation, and action recommendation.
- Capture respondent role and child age-stage.
- Support follow-up items when a parent selects a priority dimension.
- Use impact questions, not only frequency questions.
- Allow repeated assessment versions for progress tracking.

### 4.2 Family-system design

- Do not only ask what the child does. Also ask what the parent does, what the family routine allows, and what environmental stressors exist.
- Treat behavior as interactional and contextual.
- Add repair, communication, rules, consistency, and parent stress/capacity as first-class assessment memories.

### 4.3 Intervention linkage

- Every assessment output should map to a low-risk support action.
- Support actions should be small, observable, and reviewable in 1-2 weeks.
- Higher intensity needs should route to parent educator, counselor, school collaboration, or professional referral instead of AI-only guidance.

### 4.4 Skill improvement loop

- Track completion rate, item skip rate, selected priority dimension, action selection, action completion, parent usefulness feedback, and human-review outcomes.
- Use feedback to improve item wording, branching, explanation clarity, and support action matching.
- Do not claim causal learning or world-model training before causal episode and outcome foundations exist.

## 5. Mapping to Family UI-02 Five Dimensions

The current UI-02 five dimensions are a low-friction assessment entry, not the complete Family Education Industry Model. `Learning habits` is only the first UI entry into the broader Academic and K12 domain. Future assessment versions should add academic evidence, subject learning profile, AI literacy, and multimodal literacy as structured follow-up modules when consent and product scope allow.

| Family dimension | External anchors | Skill implication |
| --- | --- | --- |
| Learning habits | SDQ impact logic, APQ monitoring/consistency, CDC parenting activities | probe routine, initiation, persistence, help-seeking, and parent scaffolding |
| Emotion management | SDQ emotional symptoms, Harvard Serve and Return, Incredible Years social-emotional work | probe triggers, recovery, expression, co-regulation, repair after conflict |
| Parent-child communication | McMaster FAD, FACES, SFP 10-14, Harvard Serve and Return | probe listening, trust, conflict cycle, repair, willingness to talk |
| Device use context | AAP 5 Cs, Family Media Plan, Common Sense planners | probe content, calm, crowding out, communication, rules, sleep/homework impact |
| Self-regulation | Triple P self-regulation, APQ consistency, Parenting Scale discipline style | probe routine ownership, delayed gratification, task completion, supervision dependence |

### 5.1 Academic, AI, and multimodal expansion

| Expansion module | Constructs to probe | Product implication |
| --- | --- | --- |
| Academic and K12 learning | subject learning profile, homework process, exam feedback cycle, learning motivation, learning strategy, academic pressure, parent academic support | create academic support hypotheses, 7-day study actions, school-family handoff, and non-ranking progress review |
| AI literacy | AI concept knowledge, tool fluency, prompt/task design, verification, privacy, ethics, human-AI collaboration | create family AI-use agreements, learning-with-AI routines, anti-cheating boundaries, and age-stage AI skill paths |
| Multimodal literacy | text, image, audio, video, data, code, presentation, cross-modal translation, creative production | create project-based learning actions and help families shift from passive media use to creation and explanation |

### 5.2 Needs, health, and development expansion

| Expansion module | Constructs to probe | Product implication |
| --- | --- | --- |
| Child needs | physical, emotional, relationship, learning, identity, social, digital, and future-skill needs | make every assessment output answer what the child needs now |
| Parent needs | understanding, methods, emotional support, collaboration, decision support, feedback | create parent learning paths and service support based on actual parent need |
| Physical health | growth, sleep, exercise, nutrition, eyesight, posture, puberty, energy, recovery | connect family actions with learning readiness and daily rhythm |
| Psychosomatic wellbeing | stress body signals, fatigue, sleep disruption, appetite change, emotional recovery | add body-mind context to learning, conflict, and device-use assessment |
| Child development foundations | educational psychology, developmental psychology, learning science, family systems, SEL | give every item bank and support action a theory anchor |

## 6. Research-to-Skill Extraction Schema

Every external method added to the Family Assessment Skill should be extracted with these fields:

- `source_name`
- `source_type`: screener, scale, program, guidance, planner, repository, commercial product, practice case
- `target_age_range`
- `respondent`: parent, child, teacher, practitioner, multi-respondent
- `constructs`
- `academic_context`: subject area, grade stage, homework/exam/project context, teacher feedback, school requirement
- `ai_literacy_context`: AI tool type, learning task, verification behavior, privacy concern, ethics/plagiarism risk
- `multimodal_context`: text, image, audio, video, data, code, presentation, artifact creation, cross-modal translation
- `needs_context`: child need, parent need, family shared need, current help-seeking goal
- `health_context`: sleep, movement, nutrition, growth, puberty, eyesight, posture, body-stress signal, recovery routine
- `development_context`: age-stage task, cognitive/emotional/social development, family-system pattern, learning mechanism
- `item_style`
- `time_window`
- `response_scale`
- `scoring_or_interpretation_pattern`
- `follow_up_or_impact_logic`
- `intervention_linkage`
- `feedback_or_outcome_loop`
- `evidence_status`: research evidence, public-health guidance, practice signal, product pattern
- `family_use`: dimension anchor, wording pattern, branching pattern, action menu, safety boundary, outcome loop
- `do_not_copy`: protected item wording, proprietary scoring, diagnostic claim, unsupported cultural transfer

## 7. AI Skill Pipeline

1. Intake
   - Capture respondent, child age-stage, family context, and consent state.
   - Start with UI-02 priority selection for low-friction entry.

2. Dimension probing
   - Ask 3-5 structured questions for the selected priority dimension.
   - Include one frequency item, one impact item, and one parent-child interaction/context item.

3. Branching
   - If responses show severe safety, distress, violence, self-harm, abuse, or clinical-risk indicators, route to Human Gate.
   - If responses are low-risk, produce a support hypothesis and one small action.

4. Interpretation
   - Convert answers into structured hypotheses such as `needs_routine_support`, `communication_repair_needed`, or `device_rule_alignment_needed`.
   - Do not output diagnosis, total score, ranking, or trait label.

5. Support suggestion
   - Offer a short parent-facing explanation, a conversation starter, and a low-risk 7-day action.
   - Link action to the selected dimension and age-stage.

6. Feedback loop
   - Ask whether the action was tried, whether conflict decreased, whether routine completion improved, and whether the suggestion was useful.
   - Store feedback as outcome signals for the capability memory, not as proven causal facts.

## 8. UI-02 Near-Term Product Decision

UI-02 should stay visually close to the approved baseline, but its content should be powered by `FAMILY_ASSESSMENT_AI_CAPABILITY`.

Near-term version v2 should include:

- Five priority dimensions.
- Three follow-up questions per dimension.
- Four answer options: often, sometimes, rarely, not sure.
- No score shown to the parent.
- Submit creates a structured assessment session that UI-03 can interpret as support needs.

Next version v3 should add:

- One impact question per dimension.
- One parent-context question per dimension.
- Academic and K12 follow-up modules for learning habits, including subject profile, homework process, exam feedback, parent support style, and academic pressure.
- AI literacy and multimodal literacy follow-up modules under device use, learning autonomy, and future skill development.
- Human Gate trigger rules.
- Support action menu linked to dimension hypotheses.
- Outcome feedback after 7-14 days.

## 9. Open Research Backlog

- Review public documentation for McMaster FAD, FACES, SCORE-15, APQ, Parenting Scale, PSI, and PAFAS in more detail.
- Search Chinese family education practice sources, including 榜样教育、波波校长, and classify them as practice signals unless independently validated.
- Build a source registry YAML for assessment constructs and extraction fields.
- Convert the current v2 item bank into a versioned assessment design artifact with evidence anchors.
- Add item-level safety tags and action-link tags before AI interpretation is enabled.
