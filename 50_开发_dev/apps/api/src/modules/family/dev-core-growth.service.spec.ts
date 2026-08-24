import { describe, expect, it } from 'vitest';
import { DevCoreGrowthService } from './dev-core-growth.service';

describe('DevCoreGrowthService', () => {
  const service = new DevCoreGrowthService();
  const familyId = '22222222-2222-4222-8222-222222222222';

  it('provides UI-02~UI-10 synthetic Growth OS projection without outcomes, diagnosis, ranking or a model call', () => {
    const projection = service.getProjection(familyId);
    expect(projection).toMatchObject({
      projection_version: 'DEV_CORE_GROWTH_V1',
      family_id: familyId,
      data_source: 'SYNTHETIC_DEV_ONLY',
      model_gateway: { status: 'NOOP_NOT_INVOKED', rule: 'NO_FREE_TEXT_MODEL_WRITE_TO_CORE_ONTOLOGY' },
    });
    expect(projection.cards.map((card) => card.surface)).toEqual(['UI-02', 'UI-03', 'UI-04', 'UI-05', 'UI-06', 'UI-07', 'UI-08', 'UI-10']);
    expect(projection.cards.every((card) => card.data_source === 'SYNTHETIC_DEV_ONLY')).toBe(true);
    expect(projection.cards.every((card) => card.loop === 'GROWTH_LOOP' && card.primary_objects.length > 0)).toBe(true);
    expect(projection.cards.find((card) => card.surface === 'UI-05')).toMatchObject({
      business_capability: '90-day plan draft', state_boundary: 'CONTROLLED_DRAFT',
    });
    expect(projection.cards.some((card) => card.surface === 'UI-35')).toBe(false);
    expect(JSON.stringify(projection)).not.toContain('family_ranking');
    expect(JSON.stringify(projection)).not.toContain('family_total_score');
    expect(JSON.stringify(projection)).not.toContain('diagnosis');
  });

  it('derives the UI-04 report and UI-05 plan preview from the latest UI-02 family focus without creating a formal plan', () => {
    const projection = service.getProjection(familyId, [
      { ui_id: 'UI-03', command: 'PREVIEW_SYNTHETIC_REPORT_EXPLANATION', selection: 'EMOTION_REGULATION' },
      { ui_id: 'UI-02', command: 'SELECT_SYNTHETIC_ASSESSMENT_DIMENSION', selection: 'EMOTION_REGULATION' },
    ]);
    expect(projection.cards.find((card) => card.surface === 'UI-04')?.report_draft).toMatchObject({
      focus: 'EMOTION_REGULATION', state: 'READY', headline: '先看见感受，再决定怎样回应', plan_link_state: 'READY_TO_VIEW',
      this_week_action: expect.objectContaining({ action: expect.stringContaining('我看到你现在很不容易') }),
    });
    expect(projection.cards.find((card) => card.surface === 'UI-05')?.plan_preview).toMatchObject({
      focus: 'EMOTION_REGULATION', state: 'READY',
      stages: expect.arrayContaining([
        expect.objectContaining({ stage_id: 'SEE', weeks: '第 1-3 周' }),
        expect.objectContaining({ stage_id: 'STABILIZE', weeks: '第 11-13 周' }),
      ]),
      weekly_action_handoff: expect.objectContaining({ state: 'READY_TO_OPEN', target_route: 'growth-daily-task', action: expect.stringContaining('我看到你现在很不容易') }),
    });

    const withoutSelectedFocus = service.getProjection(familyId);
    expect(withoutSelectedFocus.cards.find((card) => card.surface === 'UI-04')?.report_draft?.focus).toBe('PARENT_CHILD_COMMUNICATION');
    expect(withoutSelectedFocus.cards.find((card) => card.surface === 'UI-07')?.growth_profile_progress).toBeUndefined();
    const previewed = service.getProjection(familyId, [
      { ui_id: 'UI-04', command: 'PREVIEW_SYNTHETIC_90_DAY_PLAN_DRAFT', selection: 'EMOTION_REGULATION' },
      { ui_id: 'UI-02', command: 'SELECT_SYNTHETIC_ASSESSMENT_DIMENSION', selection: 'EMOTION_REGULATION' },
    ]);
    expect(previewed.cards.find((card) => card.surface === 'UI-05')?.plan_preview?.state).toBe('VIEWED_FROM_REPORT');
    const actionOpened = service.getProjection(familyId, [
      { ui_id: 'UI-05', command: 'OPEN_SYNTHETIC_WEEKLY_GROWTH_ACTION', selection: 'EMOTION_REGULATION' },
      { ui_id: 'UI-02', command: 'SELECT_SYNTHETIC_ASSESSMENT_DIMENSION', selection: 'EMOTION_REGULATION' },
    ]);
    expect(actionOpened.cards.find((card) => card.surface === 'UI-05')?.plan_preview?.weekly_action_handoff.state).toBe('OPENED');
    expect(actionOpened.cards.find((card) => card.surface === 'UI-08')?.action_review).toBeUndefined();
    const reviewReady = service.getProjection(familyId, [
      { ui_id: 'UI-09', command: 'OPEN_SYNTHETIC_FAMILY_ACTION_REVIEW', selection: 'EMOTION_REGULATION' },
      { ui_id: 'UI-02', command: 'SELECT_SYNTHETIC_ASSESSMENT_DIMENSION', selection: 'EMOTION_REGULATION' },
    ]);
    expect(reviewReady.cards.find((card) => card.surface === 'UI-08')?.action_review).toMatchObject({
      state: 'ACTION_RECORDED', focus: 'EMOTION_REGULATION', plan_route: 'core-plan', fact_boundary: 'ACTION_RECORDED_NOT_OUTCOME',
    });
    expect(reviewReady.cards.find((card) => card.surface === 'UI-06')?.companion_progress).toMatchObject({
      state: 'ACTION_RECORDED', focus: 'EMOTION_REGULATION', review_route: 'growth-report', action_route: 'growth-daily-task', fact_boundary: 'ACTION_RECORDED_NOT_OUTCOME',
    });
    expect(reviewReady.cards.find((card) => card.surface === 'UI-10')?.child_action_prompt).toMatchObject({
      state: 'ACTION_RECORDED', focus: 'EMOTION_REGULATION', action_route: 'growth-daily-task', fact_boundary: 'ACTION_RECORDED_NOT_CHILD_OUTCOME',
    });
    expect(reviewReady.cards.find((card) => card.surface === 'UI-07')?.growth_profile_progress).toMatchObject({
      state: 'FOCUS_SELECTED', focus: 'EMOTION_REGULATION', plan_route: 'core-plan', review_route: 'growth-report', fact_boundary: 'FOCUS_SELECTED_NOT_OUTCOME',
    });
    expect(JSON.stringify(previewed)).not.toContain('GrowthTaskCreated');
    expect(JSON.stringify(previewed)).not.toContain('OutcomeEvidenceCreated');
  });

  it('keeps UI-10 child assistant read-only and only derives prompts from supported family actions', () => {
    const reviewedAction = service.getProjection(familyId, [
      { ui_id: 'UI-02', command: 'SELECT_SYNTHETIC_ASSESSMENT_DIMENSION', selection: 'EMOTION_REGULATION' },
      { ui_id: 'UI-09', command: 'OPEN_SYNTHETIC_FAMILY_ACTION_REVIEW', selection: 'EMOTION_REGULATION' },
    ]);
    expect(reviewedAction.cards.find((card) => card.surface === 'UI-10')?.child_action_prompt).toMatchObject({
      state: 'ACTION_RECORDED',
      fact_boundary: 'ACTION_RECORDED_NOT_CHILD_OUTCOME',
    });
    expect(JSON.stringify(reviewedAction)).toContain('NO_FREE_TEXT_MODEL_WRITE_TO_CORE_ONTOLOGY');
    expect(JSON.stringify(reviewedAction)).not.toContain('diagnosis');
  });

  it('exposes a controller-safe allow-list for supported DEV surfaces', () => {
    expect(service.supportsSurface('UI-05')).toBe(true);
    expect(service.supportsSurface('UI-35')).toBe(false);
    expect(service.supportsSurface('UI-11')).toBe(false);
  });

  it('acknowledges supported DEV commands without persistence or external effect', () => {
    expect(service.acknowledgeNoop(familyId, 'UI-05', 'PREVIEW_SYNTHETIC_90_DAY_PLAN_DRAFT')).toEqual({
      family_id: familyId,
      surface: 'UI-05',
      command: 'PREVIEW_SYNTHETIC_90_DAY_PLAN_DRAFT',
      status: 'NOOP_ACKNOWLEDGED',
      persistence: 'NONE',
      external_effect: false,
      audit_boundary: 'DEV_COMMAND_TRACE_ONLY',
    });
  });

  it('rejects unsupported surfaces rather than creating an implicit dynamic route', () => {
    expect(() => service.acknowledgeNoop(familyId, 'UI-99' as any, 'UNKNOWN')).toThrow('unsupported_dev_core_growth_surface');
  });

  it('includes a completed 90-day Journey action in UI-08 family-private review readback without asserting an outcome', () => {
    const readback = service.getFamilyReviewReadback(
      familyId,
      '11111111-2222-4333-8444-555555555555',
      {},
      [],
      [{
        action_id: 'journey-action-day-1',
        journey_plan_id: 'journey-plan-90',
        journey_phase: 'SEE',
        day_index: 1,
        completed_at: '2026-08-19T12:00:00.000Z',
        boundary: 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME',
      }],
    );
    expect(readback).toMatchObject({
      visibility: 'FAMILY_PRIVATE',
      state: 'ACTION_RECORDED',
      fact_boundary: 'ACTION_RECORDED_NOT_OUTCOME_OR_CHILD_DIAGNOSIS',
      recorded_actions: [expect.objectContaining({
        receipt_id: 'journey-action-day-1',
        source_ui: 'UI-09',
        kind: 'JOURNEY_ACTION_RECEIPT',
        journey_plan_id: 'journey-plan-90',
        journey_phase: 'SEE',
        day_index: 1,
        boundary: 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME',
      })],
    });
    expect(JSON.stringify(readback)).not.toContain('OutcomeEvidenceCreated');
    expect(JSON.stringify(readback)).not.toContain('diagnosis');
  });
});
