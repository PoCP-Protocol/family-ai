import { describe, expect, it } from 'vitest';
import { evaluateModelRunContract, type ModelRun } from './model-run-contract';

const validRun = (): ModelRun => ({
  provider: 'internal-test-provider',
  model: 'family-assessment-test',
  prompt_version: 'ui-02-p1',
  schema_version: 'ui-02-s1',
  input_refs: [{ ref: 'input:1', source: 'family-context', provenance: 'reported' }],
  evidence_refs: [{ ref: 'evidence:1', source: 'knowledge-card', provenance: 'observed' }],
  consent: {
    consent_ref: 'consent:1',
    purpose: 'ASSESSMENT',
    status: 'GRANTED',
    subject_ref: 'subject:1',
    policy_version: 'policy-1',
  },
  purpose: 'ASSESSMENT',
  policy: {
    policy_version: 'policy-1',
    allowed_boundary: 'draft',
    may_mutate_business_state: false,
    canonical_mutation_requested: false,
  },
  validation: {
    status: 'passed',
    schema_valid: true,
    provenance_complete: true,
    consent_valid: true,
    policy_valid: true,
    reasons: [],
  },
  human_gate: { required: true, status: 'pending' },
  trace: { trace_id: 'trace:1', started_at: '2026-08-26T00:00:00.000Z' },
  output_boundary: 'draft',
});

describe('ModelRun contract', () => {
  it('allows a fully attributed non-mutating draft run', () => {
    expect(evaluateModelRunContract(validRun())).toEqual({
      decision: 'allow',
      fail_closed: false,
      reasons: [],
    });
  });

  it('fails closed when provenance is missing', () => {
    const run = validRun();
    run.input_refs = [];

    expect(evaluateModelRunContract(run)).toMatchObject({
      decision: 'deny',
      fail_closed: true,
      reasons: ['MISSING_PROVENANCE'],
    });
  });

  it('fails closed when consent is absent or purpose-mismatched', () => {
    const run = validRun();
    run.consent = { ...run.consent, purpose: 'SERVICE' };

    expect(evaluateModelRunContract(run)).toMatchObject({
      decision: 'deny',
      fail_closed: true,
      reasons: ['MISSING_CONSENT'],
    });
  });

  it('fails closed for direct canonical mutation', () => {
    const run = validRun();
    run.policy = { ...run.policy, canonical_mutation_requested: true as false };

    expect(evaluateModelRunContract(run)).toMatchObject({
      decision: 'deny',
      fail_closed: true,
      reasons: ['CANONICAL_MUTATION_FORBIDDEN'],
    });
  });

  it('keeps draft/hypothesis/recommendation/proposal within the declared policy boundary', () => {
    for (const boundary of ['draft', 'hypothesis', 'recommendation', 'proposal'] as const) {
      const run = validRun();
      run.output_boundary = boundary;
      run.policy = { ...run.policy, allowed_boundary: boundary };
      expect(evaluateModelRunContract(run).decision).toBe('allow');
    }
  });
});
