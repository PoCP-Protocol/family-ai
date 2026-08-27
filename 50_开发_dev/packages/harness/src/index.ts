export type FamilyHarnessBackend = 'codex_app_server' | 'deterministic_test';

export type FamilyHarnessToolMode = 'READ_ONLY' | 'PROPOSAL_ONLY' | 'HUMAN_REVIEW_ONLY';

export type FamilyHarnessToolName =
  | 'get_family_context'
  | 'get_family_now'
  | 'get_growth_episode'
  | 'search_interventions'
  | 'get_intervention'
  | 'get_family_perspectives'
  | 'get_recent_actions'
  | 'propose_growth_action'
  | 'request_human_review'
  | 'create_support_case_draft'
  | 'get_service_options';

export interface FamilyHarnessToolPolicy {
  name: FamilyHarnessToolName;
  mode: FamilyHarnessToolMode;
  mayReadCanonicalTruth: boolean;
  mayMutateCanonicalTruth: false;
  requiresNamedActionBridge: boolean;
}

export const FAMILY_HARNESS_TOOL_POLICIES: readonly FamilyHarnessToolPolicy[] = [
  { name: 'get_family_context', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'get_family_now', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'get_growth_episode', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'search_interventions', mode: 'READ_ONLY', mayReadCanonicalTruth: false, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'get_intervention', mode: 'READ_ONLY', mayReadCanonicalTruth: false, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'get_family_perspectives', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'get_recent_actions', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
  { name: 'propose_growth_action', mode: 'PROPOSAL_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: true },
  { name: 'request_human_review', mode: 'HUMAN_REVIEW_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: true },
  { name: 'create_support_case_draft', mode: 'PROPOSAL_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: true },
  { name: 'get_service_options', mode: 'READ_ONLY', mayReadCanonicalTruth: true, mayMutateCanonicalTruth: false, requiresNamedActionBridge: false },
] as const;

export const FAMILY_HARNESS_FORBIDDEN_TOOL_NAMES = [
  'execute_sql',
  'update_table',
  'write_growth_profile',
  'write_family_context',
  'mutate_core_ontology',
  'generic_patch_core_object',
] as const;

export type FamilyHarnessInvariant =
  | 'AI_READS_CONTEXT'
  | 'AI_PROPOSES'
  | 'HUMAN_OR_POLICY_DECIDES'
  | 'NAMED_ACTION_EXECUTES'
  | 'DOMAIN_CORE_RECORDS'
  | 'NO_AGENT_DIRECT_DATABASE_WRITE'
  | 'AI_CANNOT_WRITE_CORE_ONTOLOGY'
  | 'PROPOSAL_NOT_DECISION';

export const FAMILY_HARNESS_INVARIANTS: readonly FamilyHarnessInvariant[] = [
  'AI_READS_CONTEXT',
  'AI_PROPOSES',
  'HUMAN_OR_POLICY_DECIDES',
  'NAMED_ACTION_EXECUTES',
  'DOMAIN_CORE_RECORDS',
  'NO_AGENT_DIRECT_DATABASE_WRITE',
  'AI_CANNOT_WRITE_CORE_ONTOLOGY',
  'PROPOSAL_NOT_DECISION',
] as const;

export interface FamilyHarnessThreadRef {
  backend: FamilyHarnessBackend;
  threadId: string;
  familyId: string;
  subjectPersonId: string;
  actorId: string;
  createdAt: string;
}

export interface FamilyHarnessEvent {
  eventId: string;
  threadId: string;
  eventType: 'thread.created' | 'turn.started' | 'tool.requested' | 'tool.result' | 'approval.requested' | 'turn.completed' | 'turn.failed';
  payload: Record<string, unknown>;
}

export interface FamilyHarnessStartThreadInput {
  familyId: string;
  subjectPersonId: string;
  actorId: string;
  correlationId: string;
  purpose: 'FAMILY_NOW' | 'FAMILY_INSIGHT' | 'TODAY_ACTION' | 'GROWTH_EPISODE' | 'CASE_COPILOT' | 'INTERVENTION_FACTORY';
  allowedTools: readonly FamilyHarnessToolName[];
}

export interface FamilyHarnessTurnInput {
  threadId: string;
  actorId: string;
  userIntent: string;
  correlationId: string;
}

export interface FamilyHarnessTurnResult {
  threadId: string;
  turnId: string;
  events: readonly FamilyHarnessEvent[];
  requiresApproval: boolean;
  proposalRefs: readonly string[];
}

export interface FamilyHarness {
  startThread(input: FamilyHarnessStartThreadInput): Promise<FamilyHarnessThreadRef>;
  runTurn(input: FamilyHarnessTurnInput): Promise<FamilyHarnessTurnResult>;
}

export type CodexJsonRpcTransport = (request: {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}) => Promise<{ result?: unknown; error?: { code: number; message: string } }>;

export class FamilyHarnessPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilyHarnessPolicyError';
  }
}

export function assertFamilyHarnessToolPolicy(tools: readonly string[]): asserts tools is readonly FamilyHarnessToolName[] {
  const allowed = new Set(FAMILY_HARNESS_TOOL_POLICIES.map((tool) => tool.name));
  for (const tool of tools) {
    if ((FAMILY_HARNESS_FORBIDDEN_TOOL_NAMES as readonly string[]).includes(tool)) {
      throw new FamilyHarnessPolicyError(`forbidden harness tool: ${tool}`);
    }
    if (!allowed.has(tool as FamilyHarnessToolName)) {
      throw new FamilyHarnessPolicyError(`unregistered harness tool: ${tool}`);
    }
  }
}

export class CodexHarnessAdapter implements FamilyHarness {
  constructor(private readonly transport: CodexJsonRpcTransport) {}

  async startThread(input: FamilyHarnessStartThreadInput): Promise<FamilyHarnessThreadRef> {
    assertFamilyHarnessToolPolicy(input.allowedTools);
    const response = await this.transport({
      jsonrpc: '2.0',
      id: input.correlationId,
      method: 'family.thread.create',
      params: {
        familyId: input.familyId,
        subjectPersonId: input.subjectPersonId,
        actorId: input.actorId,
        purpose: input.purpose,
        allowedTools: input.allowedTools,
        invariants: FAMILY_HARNESS_INVARIANTS,
      },
    });
    if (response.error) throw new FamilyHarnessPolicyError(response.error.message);
    const result = response.result as Partial<FamilyHarnessThreadRef> | undefined;
    return {
      backend: 'codex_app_server',
      threadId: requireString(result?.threadId, 'threadId'),
      familyId: input.familyId,
      subjectPersonId: input.subjectPersonId,
      actorId: input.actorId,
      createdAt: typeof result?.createdAt === 'string' ? result.createdAt : new Date(0).toISOString(),
    };
  }

  async runTurn(input: FamilyHarnessTurnInput): Promise<FamilyHarnessTurnResult> {
    const response = await this.transport({
      jsonrpc: '2.0',
      id: input.correlationId,
      method: 'family.turn.run',
      params: input as unknown as Record<string, unknown>,
    });
    if (response.error) throw new FamilyHarnessPolicyError(response.error.message);
    const result = response.result as Partial<FamilyHarnessTurnResult> | undefined;
    return {
      threadId: input.threadId,
      turnId: requireString(result?.turnId, 'turnId'),
      events: Array.isArray(result?.events) ? result.events as FamilyHarnessEvent[] : [],
      requiresApproval: result?.requiresApproval === true,
      proposalRefs: Array.isArray(result?.proposalRefs) ? result.proposalRefs as string[] : [],
    };
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FamilyHarnessPolicyError(`invalid codex app-server response: missing ${field}`);
  }
  return value;
}