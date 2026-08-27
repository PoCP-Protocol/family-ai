# Family Education Large Model Harness Strategy V0.1

## 1. Decision

Building the Family Education Large Model with a combined adoption and self-build strategy is feasible and recommended.

The correct position is:

> Use Codex harness-style open architecture as the engineering, evaluation, dataset, and workflow harness. Build Family's own domain model, registries, item banks, action catalog, evaluation labels, and outcome definitions as first-party assets.

Architecture principle:

> Stand on the shoulders of giants, but keep the Family domain intelligence first-party. Good architecture decides how far the model can go.

Codex harness is not the model itself. It is the factory, test bench, and iteration system around the model.

## 2. Why This Is Feasible

The Family Education Large Model is not a single model checkpoint. It is a model system made of:

- domain registries;
- need taxonomies;
- construct registries;
- source and evidence rules;
- item banks and branching rules;
- memory, dialogue, and multimodal schemas;
- action catalogs;
- outcome schemas;
- expert scenario datasets;
- evaluation suites;
- small classifiers, routers, rerankers, and action matchers;
- controlled generative model paths through Model Gateway.

This architecture fits a harness approach because every artifact can be generated, reviewed, validated, evaluated, versioned, and improved in repeatable loops.

## 3. What To Adopt

Adopt mature tools for infrastructure and iteration speed:

| Area | Adopted pattern/tool type | Role |
| --- | --- | --- |
| Agent workflow | Codex harness-style task execution and review loops | generate, update, test, and review model assets |
| Evaluation | eval harness, golden cases, rubric tests, regression runners | prevent unsafe or low-quality model output |
| Schema contracts | JSON Schema, OpenAPI, TypeScript contracts | make model input/output executable |
| Knowledge/RAG | retrieval frameworks, citation pipelines, vector/search stores | retrieve approved source context |
| Labeling/data ops | labeling tools and dataset versioning | build expert-labeled scenario data |
| Small-model training | standard ML and transformer tooling | train need classifiers, construct mappers, action matchers |
| Observability | trace and audit tooling | inspect model behavior and quality drift |
| CI/CD | repo validators and automated gates | keep model assets shippable |

## 4. What Must Be Self-Built

These are Family's durable assets and should not be outsourced to generic tools:

- Chinese family education domain system;
- child, parent, and family need taxonomy;
- K12 learning, AI literacy, multimodal literacy, health, psychology, and family-system construct map;
- family assessment item bank and interpretation schema;
- parent-facing explanation language;
- support action catalog;
- human-service handoff standard;
- evidence grading and source-use policy;
- family outcome definitions;
- expert scenario dataset;
- safety boundaries for no ranking, no total score, no direct diagnosis, no direct core-state mutation.

This is the model moat.

## 5. Target Build Architecture

```text
Family-owned model assets
  - domain / need / construct / source registries
  - item banks / interpretation schemas
  - memory / dialogue / multimodal schemas
  - action catalog / outcome schema
  - expert scenario datasets
        ↓
Codex harness-style engineering loop
  - generate candidate asset
  - validate schema
  - run safety tests
  - run golden scenarios
  - produce review report
  - accept / revise / reject
        ↓
Model capability layer
  - deterministic rules
  - retrieval
  - small models
  - Model Gateway structured generation
        ↓
Family Growth Platform
  - UI-01..UI-35 baseline experiences
  - assessment, report, journey, action, service, community, commerce surfaces
```

## 6. First Practical Path

Start with a lightweight harness inside the current repository before introducing heavier platforms.

Phase A: Model asset baseline

- Keep model assets in `docs/model`.
- Add a foundation manifest.
- Validate YAML parsing, asset existence, component required fields, and dependency references.
- Keep current runtime/DB/live-AI boundaries unchanged.

Phase B: Evaluation seed

- Create 30 expert scenario cards.
- Add deterministic checks for structured output, safety boundary, no ranking, no total score, and no diagnosis.
- Make UI-02/UI-03 pass scenario checks before expanding assessment products.

Phase C: Model component composition

- Add item bank registry.
- Add interpretation schema.
- Bind UI-01..UI-35 to model components.
- Ensure each UI's visible capability has a model component, data contract, policy boundary, and evaluation route.

Phase D: Small-model and retrieval path

- Start with rules and retrieval over approved sources.
- Add classical or embedding-based baselines only after labeled data exists.
- Add fine-tuning or LoRA only when the dataset, model card, eval report, and rollback path are ready.

## 7. Risks and Controls

| Risk | Control |
| --- | --- |
| Treating harness as domain intelligence | Domain assets remain Family-owned and expert-reviewed |
| Fast generation creates low-quality registries | Require schema validation, source refs, review reports, and golden scenarios |
| Generic LLM output bypasses safety | Model Gateway, structured output, policy, Human Gate, Named Action |
| Model learns from noisy product behavior | Outcome signals and expert labels are separated from raw behavior |
| UI expands faster than model foundation | UI-01..UI-35 bind to model components before new product expansion |
| Small model overclaims ability | Model card, eval report, bounded use case, rollback strategy |

## 8. Bottom Line

The recommended route is not pure open-source adoption and not pure self-build.

It is:

```text
Adopt mature harness and tooling
  + self-build Family education domain intelligence
  + validate everything through schemas and evaluation
  + expose capabilities through model components
  + compose the 35 UI baseline on top of the model foundation
```

This gives Family speed, quality control, and long-term defensibility.
