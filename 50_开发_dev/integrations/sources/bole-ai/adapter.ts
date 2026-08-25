/**
 * Bole.AI adapter boundary. This module maps external rows to a curriculum
 * design candidate only; it never writes Family ontology or calls a model.
 */
import type { CurriculumSourceLineage } from '@family/contracts';

export interface BoleAiRawEducationRow {
  instruction: string;
  input: string;
  output: string;
  rationale?: string;
  kind?: string;
  region?: string;
  signals?: string[] | Record<string, unknown>;
}

export interface CurriculumDesignCandidate {
  source_system: 'bole-ai';
  candidate_kind: 'SCENARIO_STYLE_TOPIC_CANDIDATE';
  title_hint: string;
  practice_hint: string;
  reflection_hint: string;
  source_lineage: CurriculumSourceLineage;
  evidence_boundary: 'E1_NOT_PROOF_OF_FACT_OR_EFFECT';
  requires_human_review: true;
}

export function mapBoleAiRow(row: BoleAiRawEducationRow, sourceId: string, mappingVersion = 'BOLE_AI_FAMILY_EDU_V1'): CurriculumDesignCandidate {
  if (!row || typeof row.instruction !== 'string' || typeof row.input !== 'string' || typeof row.output !== 'string') {
    throw new Error('invalid_bole_ai_raw_dto');
  }
  const compact = (value: string, max: number) => value.trim().slice(0, max);
  return {
    source_system: 'bole-ai',
    candidate_kind: 'SCENARIO_STYLE_TOPIC_CANDIDATE',
    title_hint: compact(row.instruction, 160),
    practice_hint: compact(row.input || row.output, 600),
    reflection_hint: compact(row.rationale || row.output, 500),
    source_lineage: { source_system: 'bole-ai', source_id: sourceId, mapping_version: mappingVersion, evidence_limit: 'E1' },
    evidence_boundary: 'E1_NOT_PROOF_OF_FACT_OR_EFFECT',
    requires_human_review: true,
  };
}