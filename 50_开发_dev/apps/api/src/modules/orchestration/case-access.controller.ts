import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import {
  ProfessionalWorkContextGuard,
  ProfessionalWorkContextParam,
  RequireProfessionalAction,
} from '../auth/professional-work-context.guard';
import type { ProfessionalWorkContext } from '../auth/auth.service';
import { OrchestrationService } from './orchestration.service';

/** Account-scoped Party runtime; no family URL is trusted or required. */
@Controller('orchestration/case-access')
export class CaseAccessController {
  constructor(
    @Inject(OrchestrationService) private readonly orchestration: OrchestrationService,
  ) {}

  @Get(':caseId/projection')
  @UseGuards(ProfessionalWorkContextGuard)
  @RequireProfessionalAction('READ_GRANTED_CASE')
  async projection(
    @Param('caseId') caseId: string,
    @ProfessionalWorkContextParam() context: ProfessionalWorkContext,
  ) {
    return this.orchestration.getGrantedCaseProjection(caseId, context.party_id, context.tenant_id);
  }
}
