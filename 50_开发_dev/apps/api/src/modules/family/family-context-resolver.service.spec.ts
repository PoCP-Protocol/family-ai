import { describe, expect, it } from 'vitest';
import { FamilyContextResolverService } from './family-context-resolver.service';

describe('FamilyContextResolverService', () => {
  it('区分成长指导与 AI 个性化同意，并只暴露最小上下文', async () => {
    const client = {
      query: async (sql: string) => {
        if (sql.includes('from family_memberships') && sql.includes('person_id = $2')) return { rows: [{ ok: 1 }], rowCount: 1 };
        if (sql.includes('from family_memberships')) return { rows: [{ role: 'OWNER_GUARDIAN', status: 'ACTIVE' }], rowCount: 1 };
        if (sql.includes('from consents')) return { rows: [
          { subject_person_id: 'child-1', guardian_person_id: 'guardian-1', purpose: 'SERVICE', status: 'GRANTED', policy_version: 'v1' },
          { subject_person_id: 'child-1', guardian_person_id: 'guardian-1', purpose: 'ASSESSMENT', status: 'GRANTED', policy_version: 'v1' },
          { subject_person_id: 'child-1', guardian_person_id: 'guardian-1', purpose: 'GROWTH_TRACKING', status: 'GRANTED', policy_version: 'v1' },
        ], rowCount: 3 };
        if (sql.includes('from life_stage_assignments')) return { rows: [{ life_stage_code: 'EARLY_ADOLESCENCE_12_15' }], rowCount: 1 };
        if (sql.includes('from growth_priorities')) return { rows: [{ dimension_id: 'R03' }], rowCount: 1 };
        if (sql.includes('from intervention_episodes')) return { rows: [], rowCount: 0 };
        if (sql.includes('from growth_actions')) return { rows: [{ status: 'PENDING' }], rowCount: 1 };
        if (sql.includes('from tenant_family_bindings')) return { rows: [{ tenant_id: 'tenant-1' }], rowCount: 1 };
        if (sql.includes('from interventions')) return { rows: [{ intervention_code: 'LISTEN_BEFORE_RESPOND' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
    };
    const repository = { withTransaction: async <T>(work: (tx: typeof client) => Promise<T>) => work(client) };
    const service = new FamilyContextResolverService(repository as never);
    const result = await service.resolve({
      familyId: 'family-1', subjectPersonId: 'child-1', purpose: 'GROWTH_GUIDANCE', actorId: 'guardian-1',
    });

    expect(result.consent.allowed).toBe(true);
    expect(result.rule_based_context?.confirmed_growth_priority).toEqual(['R03']);
    expect(result.ai_personalization.allowed).toBe(false);
    expect(result.ai_context).toBeNull();
    expect(result.model_gateway_status).toBe('BLOCKED_BY_CONSENT');
    expect(result.approved_intervention_codes).toEqual(['LISTEN_BEFORE_RESPOND']);
    expect(result.boundaries).toEqual({
      context: 'MINIMUM_NECESSARY_ALLOWLIST',
      recommendation: 'PROPOSAL_NOT_DECISION',
      action: 'NAMED_ACTION_ONLY',
      ontology: 'AI_CANNOT_WRITE_CORE_ONTOLOGY',
    });
  });
});
