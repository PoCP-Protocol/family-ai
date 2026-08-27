import { BadRequestException } from '@nestjs/common';
import type { Ui09TaskStateRequest } from '@family/contracts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['START', 'PAUSE', 'RESUME', 'CANCEL']);
const ALLOWED_FIELDS = new Set(['action', 'occurred_at']);

export interface ValidatedTaskStateActionRequest extends Ui09TaskStateRequest {
  family_id: string;
  action_id: string;
  idempotency_key: string;
}

export function validateTaskStateActionRequest(
  familyId: string,
  actionId: string,
  idempotencyKey: string | undefined,
  body: unknown,
): ValidatedTaskStateActionRequest {
  if (!UUID_PATTERN.test(familyId) || !UUID_PATTERN.test(actionId)) throw new BadRequestException('Invalid schema');
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 1 || idempotencyKey.length > 128) throw new BadRequestException('Invalid schema');
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Invalid schema');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((field) => !ALLOWED_FIELDS.has(field))) throw new BadRequestException('Invalid schema');
  if (typeof input.action !== 'string' || !ACTIONS.has(input.action)) throw new BadRequestException('Invalid schema');
  if (typeof input.occurred_at !== 'string' || Number.isNaN(Date.parse(input.occurred_at))) throw new BadRequestException('Invalid schema');
  return {
    family_id: familyId,
    action_id: actionId,
    action: input.action as Ui09TaskStateRequest['action'],
    occurred_at: input.occurred_at,
    idempotency_key: idempotencyKey,
  };
}
