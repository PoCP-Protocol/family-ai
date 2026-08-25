import { Controller, Get, Headers, Inject, Param, UnauthorizedException } from '@nestjs/common';
import { AuthService, sessionTokenFromHeaders } from '../auth/auth.service';
import { OrchestrationService } from './orchestration.service';

/** Account-scoped Party runtime; no family URL is trusted or required. */
@Controller('orchestration/case-access')
export class CaseAccessController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(OrchestrationService) private readonly orchestration: OrchestrationService,
  ) {}

  @Get(':caseId/projection')
  async projection(@Param('caseId') caseId: string, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string) {
    const account = await this.auth.resolveAccount(sessionTokenFromHeaders({ authorization, cookie }));
    if (!account) throw new UnauthorizedException('account_session_required');
    return this.orchestration.getGrantedCaseProjection(caseId, account.accountId);
  }
}
