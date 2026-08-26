import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, sessionTokenFromHeaders, type ProfessionalWorkContext } from './auth.service';

export const PROFESSIONAL_ACTION_KEY = 'professional_required_action';
export type ProfessionalNamedAction = 'READ_GRANTED_CASE';
export const RequireProfessionalAction = (action: ProfessionalNamedAction) => SetMetadata(PROFESSIONAL_ACTION_KEY, action);

export const ProfessionalWorkContextParam = createParamDecorator((_data: unknown, ctx: ExecutionContext): ProfessionalWorkContext => {
  const request = ctx.switchToHttp().getRequest<{ professionalWorkContext?: ProfessionalWorkContext }>();
  if (!request.professionalWorkContext) throw new ForbiddenException('professional_context_required');
  return request.professionalWorkContext;
});

export function professionalContextFromRequest(request: { professionalWorkContext?: ProfessionalWorkContext }): ProfessionalWorkContext {
  if (!request.professionalWorkContext) throw new ForbiddenException('professional_context_required');
  return request.professionalWorkContext;
}

@Injectable()
export class ProfessionalWorkContextGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown>; professionalWorkContext?: ProfessionalWorkContext }>();
    const token = sessionTokenFromHeaders(request.headers ?? {});
    if (!token) throw new UnauthorizedException('session_required');
    const contextRef = String(request.headers?.['x-professional-context'] ?? '').trim();
    if (!contextRef) throw new ForbiddenException('professional_context_required');
    const selected = await this.auth.resolveProfessionalContext(token, contextRef);
    if (!selected) throw new ForbiddenException('invalid_or_ambiguous_professional_context');
    const action = this.reflector.get<ProfessionalNamedAction | undefined>(PROFESSIONAL_ACTION_KEY, context.getHandler());
    if (action === undefined) throw new ForbiddenException('professional_action_required');
    if (action !== 'READ_GRANTED_CASE') throw new ForbiddenException('unsupported_professional_action');
    request.professionalWorkContext = selected;
    return true;
  }
}
