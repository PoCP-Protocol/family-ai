import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ProfessionalWorkContextGuard } from './professional-work-context.guard';

const contextFor = (headers: Record<string, string>, handler: unknown) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  getHandler: () => handler,
});

describe('ProfessionalWorkContextGuard', () => {
  const resolvedContext = {
    type: 'TEACHER' as const,
    context_ref: 'provider-1',
    tenant_id: 'tenant-1',
    party_id: 'party-1',
    teacher_profile_id: 'teacher-1',
    provider_profile_id: 'provider-1',
  };

  it('requires an account session', async () => {
    const auth = { resolveProfessionalContext: vi.fn() };
    const reflector = { get: vi.fn().mockReturnValue('READ_GRANTED_CASE') };
    const guard = new ProfessionalWorkContextGuard(auth as never, reflector as never);

    await expect(guard.canActivate(contextFor({}, vi.fn()) as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.resolveProfessionalContext).not.toHaveBeenCalled();
  });

  it('requires an explicitly selected professional context', async () => {
    const auth = { resolveProfessionalContext: vi.fn() };
    const reflector = { get: vi.fn().mockReturnValue('READ_GRANTED_CASE') };
    const guard = new ProfessionalWorkContextGuard(auth as never, reflector as never);

    await expect(
      guard.canActivate(contextFor({ authorization: 'Bearer session-1' }, vi.fn()) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.resolveProfessionalContext).not.toHaveBeenCalled();
  });

  it('requires a supported named action', async () => {
    const auth = { resolveProfessionalContext: vi.fn().mockResolvedValue(resolvedContext) };
    const reflector = { get: vi.fn().mockReturnValue(undefined) };
    const guard = new ProfessionalWorkContextGuard(auth as never, reflector as never);

    await expect(
      guard.canActivate(
        contextFor(
          { authorization: 'Bearer session-1', 'x-professional-context': 'provider-1' },
          vi.fn(),
        ) as never,
      ),
    ).rejects.toThrow('professional_action_required');
  });

  it('resolves and attaches the trusted context for READ_GRANTED_CASE', async () => {
    const auth = { resolveProfessionalContext: vi.fn().mockResolvedValue(resolvedContext) };
    const reflector = { get: vi.fn().mockReturnValue('READ_GRANTED_CASE') };
    const guard = new ProfessionalWorkContextGuard(auth as never, reflector as never);
    const request = { headers: { authorization: 'Bearer session-1', 'x-professional-context': 'provider-1' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => vi.fn(),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(auth.resolveProfessionalContext).toHaveBeenCalledWith('session-1', 'provider-1');
    expect(request.professionalWorkContext).toEqual(resolvedContext);
  });
});
