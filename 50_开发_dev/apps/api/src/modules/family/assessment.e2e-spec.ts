import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';
import { AuthService } from '../auth/auth.service';

describe('UI-02 versioned family assessment commercial slice', () => {
  let app: INestApplication;
  let baseUrl: string;
  let pool: pg.Pool;
  let auth: AuthService;
  let familyId: string;
  let childId: string;
  let token: string;
  const previousMode = process.env.PLATFORM_AUTH_MODE;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.PLATFORM_AUTH_MODE = 'required';
    pool = createTestPool();
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    auth = app.get(AuthService);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    process.env.PLATFORM_AUTH_MODE = previousMode;
  });

  beforeEach(async () => {
    await cleanFamilyCoreTables(pool);
    const tenantId = (await pool.query<{ tenant_id: string }>(
      `insert into tenants(tenant_ref,display_name,tenant_type,status) values ('ASSESSMENT_E2E','Assessment E2E','INTERNAL_SANDBOX','ACTIVE') returning tenant_id`,
    )).rows[0].tenant_id;
    const accountId = (await pool.query<{ account_id: string }>(
      `insert into accounts(external_ref,status) values ('assessment:e2e:guardian','ACTIVE') returning account_id`,
    )).rows[0].account_id;
    familyId = (await pool.query<{ family_id: string }>(`insert into families(display_name) values ('测评测试家庭') returning family_id`)).rows[0].family_id;
    const guardianId = (await pool.query<{ person_id: string }>(
      `insert into persons(family_id,person_type,parent_role,display_name,account_id) values ($1,'PARENT','GUARDIAN','测试家长','assessment:e2e:guardian') returning person_id`, [familyId],
    )).rows[0].person_id;
    childId = (await pool.query<{ person_id: string }>(
      `insert into persons(family_id,person_type,display_name,birth_date) values ($1,'CHILD','测试孩子','2013-05-01') returning person_id`, [familyId],
    )).rows[0].person_id;
    await pool.query(`insert into account_person_bindings(account_id,person_id,status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
    await pool.query(`insert into family_memberships(family_id,person_id,role,status,joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now()),($1,$3,'CHILD_SUBJECT','ACTIVE',now())`, [familyId, guardianId, childId]);
    await pool.query(`insert into tenant_account_memberships(tenant_id,account_id,role,status,valid_from) values ($1,$2,'TENANT_VIEWER','ACTIVE',now())`, [tenantId, accountId]);
    await pool.query(`insert into tenant_family_bindings(tenant_id,family_id,status,effective_from,migration_ref) values ($1,$2,'ACTIVE',now(),'ASSESSMENT_E2E')`, [tenantId, familyId]);
    await pool.query(`insert into tenant_policy_profiles(tenant_id,policy_version,status,allowed_pages,allowed_tools) values ($1,'assessment-e2e-v1','ACTIVE','["UI-01","UI-02","UI-03"]'::jsonb,'["FAMILY_SUPPORT_NEEDS"]'::jsonb)`, [tenantId]);
    await pool.query(`insert into consents(family_id,subject_person_id,guardian_person_id,purpose,status,policy_version,granted_at) values ($1,$2,$3,'ASSESSMENT','GRANTED','assessment-v1',now())`, [familyId, childId, guardianId]);
    token = (await auth.issueAccountSession('assessment:e2e:guardian')).token;
  });

  const post = (path: string, body: unknown, key: string) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key, 'x-correlation-id': `corr-${key}`, 'x-source': 'assessment-e2e' },
    body: JSON.stringify(body),
  });

  it('locks a tool version, preserves answer revisions, submits immutable evidence and replays safely', async () => {
    const projectionResponse = await fetch(`${baseUrl}/families/${familyId}/ui/02/assessment`, { headers: { authorization: `Bearer ${token}` } });
    expect(projectionResponse.status).toBe(200);
    const projection = await projectionResponse.json() as any;
    expect(projection).toMatchObject({ projection_version: 'UI02_FAMILY_ASSESSMENT_V1', availability: 'AVAILABLE' });
    expect(projection.subjects).toEqual([{ person_id: childId, display_name: '测试孩子', availability: 'AVAILABLE' }]);
    expect(projection.tool).toMatchObject({ tool_ref: 'FAMILY_SUPPORT_NEEDS', version_no: 2, evidence_level: 'E1', boundary: { capability_ref: 'FAMILY_ASSESSMENT_AI_CAPABILITY', ai_use_case: 'ASSESSMENT_INTERPRETATION' } });
    expect(projection.tool.items.some((item: any) => item.item_ref === 'PARENT_CHILD_COMMUNICATION_Q01')).toBe(true);

    const startResponse = await post(`/families/${familyId}/assessments/sessions`, { subject_person_id: childId }, 'ui02-start');
    expect(startResponse.status).toBe(201);
    const started = await startResponse.json() as any;
    const sessionId = started.session.assessment_session_id;
    expect(started).toMatchObject({ action: 'START_ASSESSMENT', replayed: false, session: { tool_ref: 'FAMILY_SUPPORT_NEEDS', tool_version: 2, status: 'IN_PROGRESS' } });
    expect((await post(`/families/${familyId}/assessments/sessions`, { subject_person_id: childId }, 'ui02-start')).status).toBe(201);
    const startReplay = await (await post(`/families/${familyId}/assessments/sessions`, { subject_person_id: childId }, 'ui02-start')).json() as any;
    expect(startReplay.replayed).toBe(true);

    expect((await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: 'LEARNING_HABITS' }, 'ui02-focus-v1')).status).toBe(201);
    const revisedResponse = await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: 'PARENT_CHILD_COMMUNICATION' }, 'ui02-focus-v2');
    expect(revisedResponse.status).toBe(201);
    expect((await revisedResponse.json() as any).session.responses).toMatchObject([{ item_ref: 'FOCUS', response_value: 'PARENT_CHILD_COMMUNICATION', revision: 2 }]);
    expect((await pool.query(`select count(*)::int n from family_assessment_responses where assessment_session_id=$1 and item_ref='FOCUS'`, [sessionId])).rows[0].n).toBe(2);
    expect((await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'PARENT_CHILD_COMMUNICATION_Q01', response_type: 'SINGLE_CHOICE', response_value: 'OFTEN' }, 'ui02-deep-q1')).status).toBe(201);
    expect((await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'PARENT_CHILD_COMMUNICATION_Q02', response_type: 'SINGLE_CHOICE', response_value: 'ALWAYS' }, 'ui02-deep-invalid')).status).toBe(400);

    const submitResponse = await post(`/families/${familyId}/assessments/sessions/${sessionId}/submit`, {}, 'ui02-submit');
    expect(submitResponse.status).toBe(201);
    const submitted = await submitResponse.json() as any;
    expect(submitted).toMatchObject({ action: 'SUBMIT_ASSESSMENT', replayed: false, session: { status: 'SUBMITTED', tool_version: 2 }, boundary: 'FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS' });
    expect(submitted.evidence_id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: 'SELF_REGULATION' }, 'ui02-after-submit')).status).toBe(409);

    const counts = await pool.query(`select (select count(*) from audit_logs where family_id=$1 and action_name like '%ASSESSMENT%')::int audits,(select count(*) from outbox_events where aggregate_id=$2)::int events`, [familyId, sessionId]);
    expect(counts.rows[0]).toEqual({ audits: 5, events: 5 });
  });

  it('fails closed without ASSESSMENT consent and never selects a child implicitly', async () => {
    await pool.query(`update consents set status='WITHDRAWN',withdrawn_at=now() where family_id=$1 and purpose='ASSESSMENT'`, [familyId]);
    const projection = await (await fetch(`${baseUrl}/families/${familyId}/ui/02/assessment`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(projection).toMatchObject({ availability: 'CONSENT_REQUIRED', subjects: [{ person_id: childId, availability: 'CONSENT_REQUIRED' }], sessions: [] });
    const growthProjection = await (await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(growthProjection).toMatchObject({ availability: 'NO_SUBMITTED_ASSESSMENT', hypothesis: null });
    expect(await post(`/families/${familyId}/assessments/sessions`, { subject_person_id: childId }, 'no-consent')).toMatchObject({ status: 403 });
  });

  it('projects an evidence-bound hypothesis and creates GrowthIntent only after family confirmation', async () => {
    const empty = await (await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(empty).toMatchObject({ projection_version: 'UI03_GROWTH_HYPOTHESIS_V1', availability: 'NO_SUBMITTED_ASSESSMENT', hypothesis: null, ai_state: 'NOT_INVOKED', latest_assessment_session_id: null });
    expect(empty.named_actions).toMatchObject({ generate: 'GENERATE_GROWTH_HYPOTHESIS', confirm: 'CONFIRM_GROWTH_HYPOTHESIS', dismiss: 'DISMISS_GROWTH_HYPOTHESIS' });

    const started = await (await post(`/families/${familyId}/assessments/sessions`, { subject_person_id: childId }, 'ui03-start')).json() as any;
    const sessionId = started.session.assessment_session_id;
    await post(`/families/${familyId}/assessments/sessions/${sessionId}/responses`, { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: 'PARENT_CHILD_COMMUNICATION' }, 'ui03-focus');
    await post(`/families/${familyId}/assessments/sessions/${sessionId}/submit`, {}, 'ui03-submit');

    const afterSubmitProjection = await (await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(afterSubmitProjection).toMatchObject({ availability: 'SUBMITTED', hypothesis: null, ai_state: 'NOT_INVOKED', latest_assessment_session_id: sessionId });
    expect((await pool.query(`select count(*)::int n from family_assessment_ai_runs where assessment_session_id=$1`, [sessionId])).rows[0].n).toBe(0);

    const generateResponse = await post(`/families/${familyId}/assessments/${sessionId}/growth-hypothesis`, {}, 'ui03-generate');
    expect(generateResponse.status).toBe(201);
    const generated = await generateResponse.json() as any;
    expect(generated).toMatchObject({ action: 'GENERATE_GROWTH_HYPOTHESIS', outcome: 'HYPOTHESIS_CREATED', status: 'PROPOSED', fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS', replayed: false });
    const generateReplay = await (await post(`/families/${familyId}/assessments/${sessionId}/growth-hypothesis`, {}, 'ui03-generate')).json() as any;
    expect(generateReplay).toMatchObject({ replayed: true, hypothesis_ref: generated.hypothesis_ref });

    const hypothesisResponse = await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } });
    expect(hypothesisResponse.status).toBe(200);
    const hypothesisProjection = await hypothesisResponse.json() as any;
    expect(hypothesisProjection).toMatchObject({ availability: 'READY', ai_state: 'READ_ONLY_PERSISTED', latest_assessment_session_id: sessionId, hypothesis: {
      subject_person_id: childId,
      focus_ref: 'PARENT_CHILD_COMMUNICATION',
      need_type_ref: 'PARENT_CHILD_COMMUNICATION_CONFLICT',
      generator: 'FAMILY_EDUCATION_ASSESSMENT_MODEL_V0_1',
      model_generator: 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC',
      model_component_ref: 'FAMILY_ASSESSMENT_V0_COMPONENT',
      fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS',
      source_refs: { assessment_session_id: sessionId, tool_ref: 'FAMILY_SUPPORT_NEEDS', tool_version: 2 },
    } });
    expect(hypothesisProjection.hypothesis.safety_gate).toEqual({ required: false, reason_refs: [], mode: 'HUMAN_REVIEW_REQUIRED' });
    expect(hypothesisProjection.hypothesis.limitations).toHaveLength(3);
    expect(hypothesisProjection.hypothesis.principal).toMatchObject({ public_role: '法咪莉校长', codename: 'FAMILI_PRINCIPAL_SISTERLY_MENTOR' });
    expect(hypothesisProjection.hypothesis.principal.boundary_labels).toContain('hypothesis_not_fact');
    expect(hypothesisProjection.hypothesis.scorecard).toMatchObject({ generated_by: 'FAMILI_PRINCIPAL_FAMILY_EDUCATION_MODEL', score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING' });
    expect(hypothesisProjection.hypothesis.scorecard.overall_score).toEqual(expect.any(Number));
    expect(hypothesisProjection.hypothesis.scorecard.dimensions).toHaveLength(5);
    expect(hypothesisProjection.hypothesis.scorecard.core_issue_tags).toEqual([]);
    expect(hypothesisProjection.hypothesis.scorecard.recommendations).toEqual([]);
    expect(hypothesisProjection.hypothesis.evidence_coverage).toMatchObject({ source_response_count: 1, interpreted_response_count: 0, coverage_ratio: 0, mapped_item_refs: [], uninterpreted_item_refs: [] });
    expect(hypothesisProjection.hypothesis.source_refs.assessment_submitted_at).toEqual(expect.any(String));
    expect(hypothesisProjection.hypothesis.model_boundary_labels).toContain('hypothesis_not_fact');
    expect(hypothesisProjection.hypothesis.need_refs).toEqual([]);
    expect(hypothesisProjection.hypothesis.construct_refs).toEqual([]);
    expect(hypothesisProjection.hypothesis.action_candidate_refs).toEqual([]);
    expect(hypothesisProjection.hypothesis.model_run_ref).toMatch(/^[0-9a-f-]{36}$/);
    expect((await pool.query(`select count(*)::int n from family_assessment_ai_runs where assessment_session_id=$1`, [sessionId])).rows[0].n).toBe(1);
    expect((await pool.query(`select count(*)::int n from family_growth_hypotheses where assessment_session_id=$1 and fact_boundary='HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS'`, [sessionId])).rows[0].n).toBe(1);
    const repeatedProjection = await (await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(repeatedProjection.hypothesis.model_run_ref).toBe(hypothesisProjection.hypothesis.model_run_ref);
    expect((await pool.query(`select count(*)::int n from family_assessment_ai_runs where assessment_session_id=$1`, [sessionId])).rows[0].n).toBe(1);
    expect((await pool.query(`select count(*)::int n from family_growth_hypotheses where assessment_session_id=$1`, [sessionId])).rows[0].n).toBe(1);
    expect((await pool.query(`select count(*)::int n from growth_intents where family_id=$1`, [familyId])).rows[0].n).toBe(0);

    const decisionBody = { assessment_session_id: sessionId, hypothesis_ref: hypothesisProjection.hypothesis.hypothesis_ref, decision_type: 'CONFIRM' };
    const confirmedResponse = await post(`/families/${familyId}/growth-hypotheses/decisions`, decisionBody, 'ui03-confirm');
    expect(confirmedResponse.status).toBe(201);
    const confirmed = await confirmedResponse.json() as any;
    expect(confirmed).toMatchObject({ action: 'CONFIRM_GROWTH_HYPOTHESIS', outcome: 'INTENT_CREATED', replayed: false, intent: { need_type: 'PARENT_CHILD_COMMUNICATION_CONFLICT', status: 'OPEN', boundary: 'HUMAN_CONFIRMED_INTENT_NOT_OUTCOME' } });
    expect(confirmed.intent.evidence_refs).toEqual([hypothesisProjection.hypothesis.source_refs.assessment_evidence_id]);
    const replay = await (await post(`/families/${familyId}/growth-hypotheses/decisions`, decisionBody, 'ui03-confirm')).json() as any;
    expect(replay).toMatchObject({ replayed: true, intent: { intent_id: confirmed.intent.intent_id } });
    expect((await pool.query(`select count(*)::int n from growth_intents where family_id=$1 and source_type='ASSESSMENT_HYPOTHESIS'`, [familyId])).rows[0].n).toBe(1);
    expect((await pool.query(`select status from family_growth_hypotheses where assessment_session_id=$1`, [sessionId])).rows[0].status).toBe('ACKNOWLEDGED');
    await pool.query(`update consents set status='WITHDRAWN',withdrawn_at=now() where family_id=$1 and purpose='ASSESSMENT'`, [familyId]);
    const withdrawnProjection = await (await fetch(`${baseUrl}/families/${familyId}/ui/03/growth-hypothesis`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(withdrawnProjection).toMatchObject({ availability: 'CONSENT_WITHDRAWN', hypothesis: null });
  });
});
