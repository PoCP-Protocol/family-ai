# Family Model Runtime Integration Contract V0.1

```text
CONTRACT_ID  = FAMILY_MODEL_RUNTIME_INTEGRATION_CONTRACT_V0_1
STATUS       = DRAFT / ARCHITECTURE_GATE_ONLY
SCOPE        = Family Education Large Model runtime integration boundary
CURRENT_GATE = G1-A ARCHITECTURE_AND_CONTRACT_CONVERGENCE
```

## 1. Current Gate

This contract defines the Family Model runtime integration boundary. The current authorization is limited to internal/local UI-02/UI-03 Family Assessment Model execution through Model Gateway.

```text
BUSINESS_RUNTIME = INTERNAL_LOCAL_AUTHORIZED_FOR_FAMILY_ASSESSMENT_MODEL
DB_SCHEMA_CHANGE = NOT_AUTHORIZED
LIVE_EXTERNAL_AI = INTERNAL_LOCAL_AUTHORIZED_FOR_UI02_FAMILY_MODEL_GATEWAY
```

Allowed now:

- package-level model runtime planning
- mock gateway execution
- architecture plan generation
- schema / asset / eval validation
- internal/local UI-02 assessment interpretation runtime after explicit request authorization
- live cc-switch/Codex-compatible gateway calls only when authorization and local env gates both pass

Forbidden now:

- NestJS route that calls external model providers
- client direct model provider calls
- DB writes for model drafts, memory, events, or outcomes
- AI free text writing core ontology or canonical family state
- pilot or production default live external AI enablement

## 2. Runtime Boundary

Every model-backed product action must resolve a technical architecture flow before execution.

```text
surface_ref
→ flow_ref
→ FamilyModelTechnicalArchitectureRuntime.planFlow
→ component plan
→ gateway profile decision
→ structured model or deterministic runtime
→ validator / eval hook
→ draft only
→ human confirmation or Named Action
```

The canonical planner is `FamilyModelTechnicalArchitectureRuntime` in `packages/family-model`.

## 3. Request Contract

Future API or worker callers must provide:

```json
{
  "request_id": "uuid-or-trace-id",
  "surface_ref": "UI-02",
  "flow_ref": "UI02_ASSESSMENT_TO_STRUCTURED_DRAFT",
  "family_context_ref": "optional permissioned context ref",
  "actor_ref": "parent|child|staff|system scoped actor ref",
  "purpose_ref": "assessment_interpretation|memory_recall|multimodal_signal|action_outcome",
  "consent_ref": "required when family data is included",
  "input_refs": ["family_assessment_item_bank.registry.yaml"],
  "payload": {}
  "business_runtime_authorized": true,
  "live_external_ai_authorized": true,
  "available_env_keys": ["FAMILY_MODEL_GATEWAY_MODE"]
}
```

Rules:

- `flow_ref` must exist in `family_model_technical_architecture.registry.yaml`.
- `surface_ref` must be covered by `family_ui_model_binding.registry.yaml` when invoked from UI.
- `purpose_ref` must be checked before context retrieval.
- `payload` must be transformed into structured model input before gateway use.
- Raw family data must not be sent to gateway unless consent and purpose gates pass.
- `business_runtime_authorized` and `live_external_ai_authorized` must be confirmed per request; registry authorization alone is not enough.
- Live gateway execution also requires local env keys; missing env must fail closed.

## 4. Response Contract

All model runtime responses are drafts.

```json
{
  "request_id": "same-as-request",
  "flow_ref": "UI02_ASSESSMENT_TO_STRUCTURED_DRAFT",
  "architecture_plan": {
    "ordered_layer_refs": [],
    "ordered_component_refs": [],
    "blocked_reasons": [],
    "may_call_live_external_ai": false,
    "may_mutate_business_state": false
  },
  "draft_kind": "assessment_interpretation|memory_update_candidate|multimodal_signal|action_candidate|outcome_signal",
  "draft": {},
  "boundary_labels": [
    "perspective_not_fact",
    "hypothesis_not_fact",
    "recommendation_not_decision"
  ],
  "requires_human_confirmation": true,
  "allowed_next_named_actions": []
}
```

Rules:

- `may_mutate_business_state` must remain `false` in model response.
- `blocked_reasons` must be returned to caller instead of bypassed.
- `draft` must pass schema and boundary validation.
- A draft is not a decision, not an action, not an outcome, and not canonical truth.

## 5. Worker Orchestration Boundary

Future workers may orchestrate long-running model tasks only through an explicit workflow contract.

Allowed worker steps after authorization:

1. Resolve `flow_ref` to architecture plan.
2. Retrieve permissioned context set.
3. Execute deterministic baseline runtime.
4. Optionally call Model Gateway if plan and authorization allow it.
5. Validate structured output and run eval hooks.
6. Emit draft-ready event or human-review-needed event.

Forbidden worker steps:

- write canonical Family/Growth/Service/Commerce tables directly
- mark service completion as growth outcome
- convert recommendation candidates into decisions
- suppress model gateway failures through silent fallback

## 6. Event Boundary

When event emission becomes authorized, model runtime events must follow `events/EVENT_STANDARD.md`.

Candidate event names:

- `FamilyModelDraftGenerated`
- `FamilyModelDraftRejected`
- `FamilyModelHumanReviewRequested`
- `FamilyModelMemoryUpdateCandidateGenerated`
- `FamilyModelOutcomeSignalDrafted`

Event payload must include:

```json
{
  "requestId": "string",
  "flowRef": "string",
  "surfaceRef": "string",
  "componentRefs": [],
  "boundaryLabels": [],
  "blockedReasons": [],
  "draftRef": "string|null",
  "humanGateRequired": true
}
```

No event may claim canonical outcome unless a separate Named Action commits it.

## 7. Gateway Boundary

External model calls must use `@family/ai-gateway`.

```text
Client → API/Worker → Family Model Runtime → AI Gateway → Provider
```

Forbidden:

```text
Client → Provider
Business module → Provider SDK
Model free text → Core ontology write
```

cc switch may be used only when:

- `LIVE_EXTERNAL_AI = AUTHORIZED`
- `FAMILY_MODEL_GATEWAY_MODE = cc-switch`
- `FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI = true`
- local API key and model configuration exist
- architecture plan has no live-AI blockers

## 8. Acceptance

- `pnpm run plan:family-model-architecture -- --all` returns plans for all registered flows.
- Live AI flows return blockers while live authorization or gateway env is missing.
- Non-live flows can produce plans without gateway configuration.
- `pnpm run validate:model-assets` passes.
- `pnpm --filter @family/family-model test` passes.