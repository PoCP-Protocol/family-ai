import { describe, expect, it } from 'vitest';
import { validateTaskStateActionRequest } from './task-state-action.dto';

const familyId = '22222222-2222-4222-8222-222222222222';
const taskId = '11111111-1111-4111-8111-111111111111';

describe('validateTaskStateActionRequest', () => {
  it('accepts only a registered UI-09 transition with server-scoped identifiers', () => {
    expect(validateTaskStateActionRequest(familyId, taskId, 'idem-ui09-start', {
      action: 'START', occurred_at: '2026-08-23T08:00:00.000Z',
    })).toMatchObject({ family_id: familyId, action_id: taskId, action: 'START', idempotency_key: 'idem-ui09-start' });
  });

  it('rejects an unknown transition or client-supplied scope field', () => {
    expect(() => validateTaskStateActionRequest(familyId, taskId, 'idem-ui09-invalid', { action: 'COMPLETE', occurred_at: new Date().toISOString() })).toThrow('Invalid schema');
    expect(() => validateTaskStateActionRequest(familyId, taskId, 'idem-ui09-scope', { action: 'START', occurred_at: new Date().toISOString(), family_id: familyId })).toThrow('Invalid schema');
  });

  it('requires a retry-safe idempotency key and valid occurrence time', () => {
    expect(() => validateTaskStateActionRequest(familyId, taskId, undefined, { action: 'PAUSE', occurred_at: new Date().toISOString() })).toThrow('Invalid schema');
    expect(() => validateTaskStateActionRequest(familyId, taskId, 'idem-ui09-time', { action: 'PAUSE', occurred_at: 'not-a-time' })).toThrow('Invalid schema');
  });
});
