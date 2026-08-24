# FAMILY-UI-FUNCTIONAL-REALIZATION-REBASELINE-001

## Objective

Rebaseline Family 1.0 from a visual 34 UI delivery model to a functional product operating system model.

The execution SSOT is now:

- `governance/FAMILY_UI_CANONICAL_MAP_V1.json`
- `governance/FAMILY_UI_FUNCTIONAL_REALIZATION_REBASELINE_V1.json`
- `tools/validate-ui-functional-realization.mjs`

## Problem

The mobile UI baseline is visually broad, but many primary actions are still draft, fixture, projection-only, preview-only, or controlled Dev no-op. A checked item in `apps/mobile/todo.md` is not evidence of product completion.

## Required Maps

1. UI-01..UI-34 to Business Capability Map.
2. Business Capability to Domain/Data/API Map.
3. Gap to Implementation Wave Map.

## New Completion Standard

Use implementation depth instead of done/not-done:

- L0_DESIGN
- L1_UI
- L2_PROJECTION
- L3_COMMAND
- L4_CANONICAL
- L5_CLOSED_LOOP
- L6_EXTERNAL_EFFECT
- L7_PRODUCTION_E2E

## Implementation Order

1. PHASE_0 Canonical Rebaseline.
2. PHASE_1 Platform Spine.
3. PHASE_2 Golden Growth Loop.
4. PHASE_3 Service Loop.
5. PHASE_4 Commerce Loop.
6. PHASE_5 Community Loop.
7. PHASE_6 Operations OS.
8. PHASE_7 Production Closure.

## Guardrails

- UI numbers belong to the Experience layer only.
- Business code must use semantic keys, domain actions, and canonical objects.
- `recordDevFlowEvent` cannot be treated as a completed business command.
- Payment, booking, publishing, asset export, service delivery, outcome, and entitlement flows must be real or explicitly out of scope.
- Dev/test may call real external AI only through Family API Model Gateway.
- Family Context is the continuity spine, not a large ungoverned profile table.

## Current Result

PHASE_0 is active. The new validator records present gaps and prevents future work from calling visual/projection completion `FAMILY_1_0_READY`.