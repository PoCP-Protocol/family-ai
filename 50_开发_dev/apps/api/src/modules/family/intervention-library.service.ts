import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type {
  InterventionCardDto,
  InterventionLibraryItemDto,
  InterventionLibraryProjection,
  InterventionLibrarySourceRefDto,
} from '@family/contracts';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

@Injectable()
export class InterventionLibraryService {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async listPublishedForFamily(familyId: string, actorId: string): Promise<InterventionLibraryProjection> {
    return this.repository.withTransaction(async (client) => {
      await assertFamilyManagePermission(client, familyId, actorId);
      const tenantId = await resolveActiveTenantId(client, familyId);
      const result = await client.query<InterventionLibraryRow>(
        `select i.intervention_id,
                i.intervention_code,
                i.tenant_id,
                i.evidence_grade,
                i.risk_level,
                i.human_requirement,
                i.version,
                i.review_status,
                i.reviewed_by_actor_id,
                i.reviewed_at,
                iv.content,
                iv.required_consent_purposes,
                iv.source_refs
         from interventions i
         join intervention_versions iv
           on iv.intervention_id = i.intervention_id
          and iv.version = i.version
         where i.status = 'ACTIVE'
           and i.review_status = 'PUBLISHED'
           and iv.status = 'PUBLISHED'
           and (i.tenant_id is null or i.tenant_id = $1::uuid)
         order by i.tenant_id nulls last, i.intervention_code, i.version desc`,
        [tenantId],
      );
      return {
        family_id: familyId,
        items: result.rows.map(mapLibraryItem),
        generated_at: new Date().toISOString(),
        boundary: 'READ_ONLY_APPROVED_INTERVENTION_LIBRARY',
      };
    });
  }
}

async function resolveActiveTenantId(client: pg.PoolClient, familyId: string): Promise<string | null> {
  const result = await client.query<{ tenant_id: string }>(
    `select tenant_id
     from tenant_family_bindings
     where family_id = $1 and status = 'ACTIVE'
     order by created_at desc
     limit 1`,
    [familyId],
  );
  return result.rows[0]?.tenant_id ?? null;
}

function mapLibraryItem(row: InterventionLibraryRow): InterventionLibraryItemDto {
  const content = asRecord(row.content);
  const actionPlan = asStringArray(content.action_plan);
  const card: InterventionCardDto = {
    intervention_id: row.intervention_id as InterventionCardDto['intervention_id'],
    intervention_code: row.intervention_code as InterventionCardDto['intervention_code'],
    name_zh: asString(content.name_zh) as InterventionCardDto['name_zh'],
    duration_days: asNumber(content.duration_days) as InterventionCardDto['duration_days'],
    why: asString(content.why),
    target: asString(content.target),
    behavior: asString(content.behavior),
    applicability: asStringArray(content.applicability),
    contraindications: asStringArray(content.contraindications),
    safety_notes: asStringArray(content.safety_notes),
    expected_mediator: asString(content.expected_mediator),
    expected_outcome: asString(content.expected_outcome),
    action_template: actionPlan.join('\n'),
    policy_version: asString(content.policy_version) as InterventionCardDto['policy_version'],
  };
  return {
    intervention: card,
    content_version: row.version,
    scope: row.tenant_id ? 'TENANT' : 'GLOBAL',
    tenant_id: row.tenant_id,
    review_status: row.review_status,
    evidence_grade: row.evidence_grade,
    risk_level: row.risk_level,
    human_requirement: row.human_requirement,
    required_consent_purposes: asStringArray(row.required_consent_purposes),
    source_refs: asSourceRefs(row.source_refs),
    reviewed_by_actor_id: row.reviewed_by_actor_id,
    reviewed_at: row.reviewed_at ? toIsoString(row.reviewed_at) : null,
    evidence_boundary: 'PRACTICE_CONTENT_NOT_DIAGNOSIS_OR_GUARANTEED_OUTCOME',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asSourceRefs(value: unknown): InterventionLibrarySourceRefDto[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((item) =>
    typeof item.source_type === 'string' && typeof item.source_ref === 'string' && typeof item.evidence_grade === 'string',
  ).map((item) => ({
    source_type: item.source_type as string,
    source_ref: item.source_ref as string,
    evidence_grade: item.evidence_grade as string,
  }));
}

function toIsoString(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

interface InterventionLibraryRow {
  intervention_id: string;
  intervention_code: string;
  tenant_id: string | null;
  evidence_grade: string;
  risk_level: string;
  human_requirement: string;
  version: number;
  review_status: InterventionLibraryItemDto['review_status'];
  reviewed_by_actor_id: string | null;
  reviewed_at: Date | string | null;
  content: unknown;
  required_consent_purposes: unknown;
  source_refs: unknown;
}
