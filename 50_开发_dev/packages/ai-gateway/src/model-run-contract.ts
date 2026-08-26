/**
 * UI-02/UI-03 shared ModelRun contract.
 *
 * This module is intentionally runtime-independent: it contains only data
 * shapes and deterministic validation. It must not call a model or mutate
 * canonical Family state.
 */

export type ModelProvider = string;

export type ModelOutputBoundary = 'draft' | 'hypothesis' | 'recommendation' | 'proposal';

export type ConsentPurpose =
  | 'SERVICE'
  | 'ASSESSMENT'
  | 'GROWTH_TRACKING'
  | 'AI_PERSONALIZATION'
  | 'MATERIAL_STRUCTURE_ASSIST';

export interface ProvenanceRef {
  ref: string;
  source: string;
  provenance: 'observed' | 'reported' | 'derived' | 'simulated' | 'inferred' | 'unverified';
}

export interface ConsentContext {
  consent_ref: string;
  purpose: ConsentPurpose;
  status: 'GRANTED';
  subject_ref: string;
  policy_version: string;
}

export interface ModelRunPolicy {
  policy_version: string;
  allowed_boundary: ModelOutputBoundary;
  may_mutate_business_state: false;
  canonical_mutation_requested: false;
}

export interface ValidationResult {
  status: 'passed' | 'failed';
  schema_valid: boolean;
  provenance_complete: boolean;
  consent_valid: boolean;
  policy_valid: boolean;
  reasons: readonly string[];
}

export interface HumanGate {
  required: boolean;
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  gate_ref?: string;
}

export interface ModelRunTrace {
  trace_id: string;
  parent_trace_id?: string;
  started_at: string;
  completed_at?: string;
}

export interface ModelRun {
  provider: ModelProvider;
  model: string;
  prompt_version: string;
  schema_version: string;
  input_refs: readonly ProvenanceRef[];
  evidence_refs: readonly ProvenanceRef[];
  consent: ConsentContext;
  purpose: ConsentPurpose;
  policy: ModelRunPolicy;
  fallback_reason?: string;
  validation: ValidationResult;
  human_gate: HumanGate;
  trace: ModelRunTrace;
  output_boundary: ModelOutputBoundary;
}

export type ModelRunRejectionReason =
  | 'MISSING_PROVENANCE'
  | 'MISSING_CONSENT'
  | 'CANONICAL_MUTATION_FORBIDDEN'
  | 'POLICY_BOUNDARY_MISMATCH'
  | 'INVALID_MODEL_RUN';

export interface ModelRunContractDecision {
  decision: 'allow' | 'deny';
  fail_closed: boolean;
  reasons: readonly ModelRunRejectionReason[];
}

const KNOWN_BOUNDARIES: readonly ModelOutputBoundary[] = ['draft', 'hypothesis', 'recommendation', 'proposal'];

function hasProvenance(refs: readonly ProvenanceRef[]): boolean {
  return refs.length > 0 && refs.every((ref) =>
    ref.ref.trim().length > 0 && ref.source.trim().length > 0 && ref.provenance.trim().length > 0,
  );
}

function hasConsent(run: ModelRun): boolean {
  return run.consent.status === 'GRANTED'
    && run.consent.consent_ref.trim().length > 0
    && run.consent.subject_ref.trim().length > 0
    && run.consent.policy_version.trim().length > 0
    && run.consent.purpose === run.purpose;
}

/**
 * Deterministically evaluates the contract. Any missing safety prerequisite
 * denies the run; this function never throws and never performs I/O.
 */
export function evaluateModelRunContract(run: ModelRun): ModelRunContractDecision {
  const reasons: ModelRunRejectionReason[] = [];
  const provenanceComplete = hasProvenance(run.input_refs) && hasProvenance(run.evidence_refs);
  if (!provenanceComplete) reasons.push('MISSING_PROVENANCE');

  if (!hasConsent(run)) reasons.push('MISSING_CONSENT');

  if (run.policy.may_mutate_business_state !== false || run.policy.canonical_mutation_requested !== false) {
    reasons.push('CANONICAL_MUTATION_FORBIDDEN');
  }

  if (run.policy.allowed_boundary !== run.output_boundary || !KNOWN_BOUNDARIES.includes(run.output_boundary)) {
    reasons.push('POLICY_BOUNDARY_MISMATCH');
  }

  if (run.validation.status !== 'passed' || !run.validation.schema_valid || !run.validation.policy_valid) {
    reasons.push('INVALID_MODEL_RUN');
  }

  return reasons.length === 0
    ? { decision: 'allow', fail_closed: false, reasons: [] }
    : { decision: 'deny', fail_closed: true, reasons };
}
