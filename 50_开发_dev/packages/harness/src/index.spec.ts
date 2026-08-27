import { describe, expect, it } from 'vitest';
import {
  CodexHarnessAdapter,
  FAMILY_HARNESS_TOOL_POLICIES,
  FamilyHarnessPolicyError,
  assertFamilyHarnessToolPolicy,
} from './index';

describe('Family Harness boundary', () => {
  it('allows only registered read/proposal/human-review tools', () => {
    expect(() => assertFamilyHarnessToolPolicy(['get_family_context', 'propose_growth_action'])).not.toThrow();
    expect(FAMILY_HARNESS_TOOL_POLICIES.every((tool) => tool.mayMutateCanonicalTruth === false)).toBe(true);
  });

  it('rejects direct database and core ontology mutation tools', () => {
    expect(() => assertFamilyHarnessToolPolicy(['execute_sql'])).toThrow(FamilyHarnessPolicyError);
    expect(() => assertFamilyHarnessToolPolicy(['write_growth_profile'])).toThrow(FamilyHarnessPolicyError);
  });

  it('passes Family invariants to the Codex App Server adapter', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const adapter = new CodexHarnessAdapter(async (request) => {
      calls.push({ method: request.method, params: request.params });
      return { result: { threadId: 'thread-1', createdAt: '2026-08-24T00:00:00.000Z' } };
    });

    const thread = await adapter.startThread({
      familyId: 'family-1',
      subjectPersonId: 'child-1',
      actorId: 'parent-1',
      correlationId: 'corr-1',
      purpose: 'FAMILY_NOW',
      allowedTools: ['get_family_context', 'get_family_now'],
    });

    expect(thread.backend).toBe('codex_app_server');
    expect(calls[0].method).toBe('family.thread.create');
    expect(calls[0].params.allowedTools).toEqual(['get_family_context', 'get_family_now']);
    expect(calls[0].params.invariants).toContain('NAMED_ACTION_EXECUTES');
  });
});