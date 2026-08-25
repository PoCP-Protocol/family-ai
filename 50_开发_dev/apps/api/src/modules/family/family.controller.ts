import { randomUUID } from 'node:crypto';
import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ActorId, FamilyContext, FamilyPlatformAuthGuard, RequireFamilyAction } from '../auth/family-platform-auth.guard';
import { projectTaskCheckinResult, projectTaskStateResult } from '@family/contracts';
import type { AddChildResponse, AddParentResponse, AssignLifeStageResponse, AuditMeta, BuildGrowthProfileDraftsResponse, CompleteGrowthActionResponse, CompleteGrowthReviewResponse, ConfirmGrowthPriorityResponse, ConfirmGrowthProfileResponse, ConfirmJourneyPlanResponse, CreateFamilyRelationshipResponse, CreateFamilyResponse, CreateJourneyPlanResponse, FamilyAggregateResponse, FamilyTimelineResponse, GrantConsentResponse, GrowthActionDto, GrowthInsightResponse, GrowthPriorityInsightResponse, InterventionCardDto, JourneyPlanProjection, PauseJourneyPlanResponse, PerspectiveSummaryResponse, RecordNextStepDecisionResponse, RecordOutcomeObservationResponse, RecordPerspectiveResponse, ReviewJourneyPhaseResponse, StartGrowthOnboardingResponse, StartInterventionResponse } from '@family/contracts';
import { validateAddChildRequest } from './add-child.dto';
import { validateAddParentRequest } from './add-parent.dto';
import { validateAssignLifeStageRequest } from './assign-life-stage.dto';
import { validateBuildGrowthProfileDraftsRequest } from './build-growth-profile-drafts.dto';
import { validateCompleteGrowthActionRequest } from './complete-growth-action.dto';
import { validateTaskStateActionRequest } from './task-state-action.dto';
import { validateCompleteGrowthReviewRequest } from './complete-growth-review.dto';
import { validateConfirmGrowthPriorityRequest } from './confirm-growth-priority.dto';
import { validateConfirmGrowthProfileRequest } from './confirm-growth-profile.dto';
import { validateCreateFamilyRelationshipRequest } from './create-family-relationship.dto';
import { validateCreateFamilyRequest } from './create-family.dto';
import { validateGrantConsentRequest } from './grant-consent.dto';
import { validateConfirmJourneyPlanRequest, validateCreateJourneyPlanRequest, validatePauseJourneyPlanRequest, validateReviewJourneyPhaseRequest } from './journey-plan.dto';
import { validateRecordNextStepDecisionRequest } from './record-next-step-decision.dto';
import { validateRecordOutcomeObservationRequest } from './record-outcome-observation.dto';
import { validateRecordPerspectiveRequest } from './record-perspective.dto';
import { validateStartGrowthOnboardingRequest } from './start-growth-onboarding.dto';
import { validateStartInterventionRequest } from './start-intervention.dto';
import { FamilyService } from './family.service';
import { GrowthActionService } from './growth-action.service';
import { GrowthPriorityService } from './growth-priority.service';
import { GrowthReviewService } from './growth-review.service';
import { InterventionService } from './intervention.service';
import { JourneyPlanService } from './journey-plan.service';
import { OnboardingService } from './onboarding.service';
import { TodayService } from './today.service';
import { DevCoreGrowthService } from './dev-core-growth.service';
import { DevPlatformSurfacesService } from './dev-platform-surfaces.service';
import { DevFlowReceiptService } from './dev-flow-receipt.service';
import { TenantScopedUiProjectionService } from './tenant-scoped-ui-projection.service';
import { FamilyHomeService } from './family-home.service';
import { AssessmentService } from './assessment.service';
import { GrowthHypothesisService } from './growth-hypothesis.service';
import { GrowthCamp21Service } from './growth-camp21.service';
import { validateAdmitGrowthCamp21SubjectRequest, validateCheckInGrowthCamp21DayRequest, validateEnrollGrowthCamp21Request, validateReleaseCurriculumDraftRequest, validateReviewCurriculumDraftRequest } from './curriculum.dto';

@Controller('families')
@UseGuards(FamilyPlatformAuthGuard)   // PLATFORM-IAM-104:统一解析可信 actor;required 模式拒 x-actor-id-only
export class FamilyController {
  constructor(
    @Inject(FamilyService) private readonly familyService: FamilyService,
    @Inject(GrowthPriorityService) private readonly growthPriorityService: GrowthPriorityService,
    @Inject(InterventionService) private readonly interventionService: InterventionService,
    @Inject(JourneyPlanService) private readonly journeyPlanService: JourneyPlanService,
    @Inject(GrowthActionService) private readonly growthActionService: GrowthActionService,
    @Inject(GrowthReviewService) private readonly growthReviewService: GrowthReviewService,
    @Inject(OnboardingService) private readonly onboardingService: OnboardingService,
    @Inject(TodayService) private readonly todayService: TodayService,
    @Inject(DevCoreGrowthService) private readonly devCoreGrowthService: DevCoreGrowthService,
    @Inject(DevPlatformSurfacesService) private readonly devPlatformSurfacesService: DevPlatformSurfacesService,
    @Inject(DevFlowReceiptService) private readonly devFlowReceiptService: DevFlowReceiptService,
    @Inject(TenantScopedUiProjectionService) private readonly tenantScopedUiProjectionService: TenantScopedUiProjectionService,
    @Inject(FamilyHomeService) private readonly familyHomeService: FamilyHomeService,
    @Inject(AssessmentService) private readonly assessmentService: AssessmentService,
    @Inject(GrowthHypothesisService) private readonly growthHypothesisService: GrowthHypothesisService,
    @Inject(GrowthCamp21Service) private readonly growthCamp21Service: GrowthCamp21Service,
  ) {}

  @RequireFamilyAction('ReviewCurriculumDraft')
  @Post(':familyId/curriculum/drafts/:draftId/review')
  reviewCurriculumDraft(@Param('familyId') familyId: string, @Param('draftId') draftId: string, @Body() body: unknown, @ActorId() actorId: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-correlation-id') correlationId?: string, @Headers('x-source') source?: string) {
    if (!actorId || !isUuid(familyId)) throw new BadRequestException('Invalid schema');
    return this.growthCamp21Service.reviewDraft(validateReviewCurriculumDraftRequest(draftId, idempotencyKey, body), buildAuditMeta(actorId, correlationId, source), familyId);
  }

  @RequireFamilyAction('ReleaseCurriculumDraft')
  @Post(':familyId/curriculum/drafts/:draftId/release')
  releaseCurriculumDraft(@Param('familyId') familyId: string, @Param('draftId') draftId: string, @Body() body: unknown, @ActorId() actorId: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-correlation-id') correlationId?: string, @Headers('x-source') source?: string) {
    if (!actorId || !isUuid(familyId)) throw new BadRequestException('Invalid schema');
    return this.growthCamp21Service.releaseDraft(validateReleaseCurriculumDraftRequest(draftId, idempotencyKey, body), buildAuditMeta(actorId, correlationId, source), familyId);
  }

  @RequireFamilyAction('AdmitGrowthCamp21Subject')
  @Post(':familyId/curriculum/21day/admissions')
  admitGrowthCamp21Subject(@Param('familyId') familyId: string, @Body() body: unknown, @ActorId() actorId: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-correlation-id') correlationId?: string, @Headers('x-source') source?: string) {
    if (!actorId) throw new UnauthorizedException('actor_is_authenticated');
    return this.growthCamp21Service.admitSubject(validateAdmitGrowthCamp21SubjectRequest(familyId, idempotencyKey, body), buildAuditMeta(actorId, correlationId, source));
  }

  @RequireFamilyAction('EnrollGrowthCamp21')
  @Post(':familyId/curriculum/21day/enroll')
  enrollGrowthCamp21(@Param('familyId') familyId: string, @Body() body: unknown, @ActorId() actorId: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-correlation-id') correlationId?: string, @Headers('x-source') source?: string) {
    if (!actorId) throw new UnauthorizedException('actor_is_authenticated');
    return this.growthCamp21Service.enroll(validateEnrollGrowthCamp21Request(familyId, idempotencyKey, body), buildAuditMeta(actorId, correlationId, source));
  }

  @RequireFamilyAction('CheckInGrowthCamp21Day')
  @Post(':familyId/curriculum/21day/enrollments/:enrollmentId/checkins')
  checkInGrowthCamp21(@Param('familyId') familyId: string, @Param('enrollmentId') enrollmentId: string, @Body() body: unknown, @ActorId() actorId: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-correlation-id') correlationId?: string, @Headers('x-source') source?: string) {
    if (!actorId) throw new UnauthorizedException('actor_is_authenticated');
    return this.growthCamp21Service.checkIn(validateCheckInGrowthCamp21DayRequest(familyId, enrollmentId, idempotencyKey, body), buildAuditMeta(actorId, correlationId, source));
  }

  /** UI-01 commercial home: one trusted Tenant/Family projection shared by App and Web. */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/ui/01/home')
  async familyHome(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { accountId: string; tenantId: string; familyId: string; personId: string; familyRole: string } | undefined,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.familyHomeService.getHome(familyId, familyContext.tenantId, actorId);
  }

  /** UI-02 commercial projection: versioned tool, explicit subject and recoverable sessions. */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/ui/02/assessment')
  async familyAssessment(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.assessmentService.getProjection(familyId, familyContext.tenantId, familyContext.personId);
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/assessments/sessions')
  async startAssessment(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-source') source?: string,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    const candidate = body as { subject_person_id?: unknown; tool_ref?: unknown };
    if (typeof candidate?.subject_person_id !== 'string') throw new BadRequestException('subject_person_id_required');
    return this.assessmentService.start(familyId, familyContext.tenantId, familyContext.personId, {
      subject_person_id: candidate.subject_person_id,
      ...(typeof candidate.tool_ref === 'string' ? { tool_ref: candidate.tool_ref } : {}),
    }, mutationMeta(correlationId, idempotencyKey, source));
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/assessments/sessions/:sessionId/responses')
  async saveAssessmentResponse(
    @Param('familyId') familyId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-source') source?: string,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    const candidate = body as { item_ref?: unknown; response_type?: unknown; response_value?: unknown };
    if (typeof candidate?.item_ref !== 'string' || typeof candidate.response_type !== 'string' || !['string', 'boolean'].includes(typeof candidate.response_value)) throw new BadRequestException('assessment_response_required');
    return this.assessmentService.saveResponse(familyId, familyContext.tenantId, familyContext.personId, sessionId, {
      item_ref: candidate.item_ref,
      response_type: candidate.response_type as 'SINGLE_CHOICE' | 'TEXT' | 'BOOLEAN',
      response_value: candidate.response_value as string | boolean,
    }, mutationMeta(correlationId, idempotencyKey, source));
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/assessments/sessions/:sessionId/submit')
  async submitAssessment(
    @Param('familyId') familyId: string,
    @Param('sessionId') sessionId: string,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-source') source?: string,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.assessmentService.submit(familyId, familyContext.tenantId, familyContext.personId, sessionId, mutationMeta(correlationId, idempotencyKey, source));
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/assessments/:sessionId/growth-hypothesis')
  async generateGrowthHypothesis(
    @Param('familyId') familyId: string,
    @Param('sessionId') sessionId: string,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-source') source?: string,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!isUuid(sessionId)) throw new BadRequestException('Invalid assessment_session_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.growthHypothesisService.generate(familyId, familyContext.tenantId, familyContext.personId, sessionId, mutationMeta(correlationId, idempotencyKey, source));
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/ui/03/growth-hypothesis')
  async growthHypothesis(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.growthHypothesisService.getProjection(familyId, familyContext.tenantId, familyContext.personId);
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/growth-hypotheses/decisions')
  async decideGrowthHypothesis(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @FamilyContext() familyContext: { tenantId: string; familyId: string; personId: string } | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-source') source?: string,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!actorId || !familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    const candidate = body as { assessment_session_id?: unknown; hypothesis_ref?: unknown; decision_type?: unknown };
    if (typeof candidate?.assessment_session_id !== 'string' || typeof candidate.hypothesis_ref !== 'string' || !['CONFIRM','DISMISS'].includes(String(candidate.decision_type))) throw new BadRequestException('growth_hypothesis_decision_required');
    return this.growthHypothesisService.decide(familyId, familyContext.tenantId, familyContext.personId, {
      assessment_session_id: candidate.assessment_session_id,
      hypothesis_ref: candidate.hypothesis_ref,
      decision_type: candidate.decision_type as 'CONFIRM' | 'DISMISS',
    }, mutationMeta(correlationId, idempotencyKey, source));
  }

  /** 统一 tenant-scoped UI 读取适配：实际会话 + tenant/family 双重范围，外部效果一律不执行。 */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/tenant-scoped/ui-projection')
  async tenantScopedUiProjection(
    @Param('familyId') familyId: string,
    @FamilyContext() familyContext: { accountId: string; tenantId: string; familyId: string; personId: string; familyRole: string } | undefined,
  ) {
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    if (!familyContext || familyContext.familyId !== familyId) throw new UnauthorizedException('real_family_session_required');
    return this.tenantScopedUiProjectionService.getProjection({ familyId, accountId: familyContext.accountId });
  }

  // FAMILY-ONBOARDING-001:可恢复 onboarding 状态(读模型,0 canonical 写)。
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/onboarding/status')
  async onboardingStatus(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    return this.onboardingService.getStatus(familyId, actorId);
  }

  // UI-01/UI-09 first slice: family-scoped read projection, 0 canonical writes.
  // The underlying GrowthAction read already applies family-manager authorization;
  // the check-in command separately revalidates consent/safety immediately before write.
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/today')
  async today(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    return this.todayService.getFamilyTodayProjection(familyId, actorId);
  }

  /**
   * UI-02..UI-10 DEV-only Family Growth OS projection.
   * It returns explicitly synthetic/read-only data to wire the visual pages without creating
   * assessment facts, profiles, plans, outcomes, external effects or model calls.
   */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/dev/core-growth')
  async devCoreGrowth(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    const events = await this.devFlowReceiptService.list(familyId, actorId);
    const coreGrowthEvents = events.filter((event) => this.devCoreGrowthService.supportsSurface(event.ui_id) || event.ui_id === 'UI-09');
    const projection = this.devCoreGrowthService.getProjection(familyId, coreGrowthEvents);
    return { ...projection, recent_flow_events: coreGrowthEvents };
  }

  /** DEV-only trace acknowledgement: intentionally no DB write, audit persistence, outbox consumer or external effect. */
  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/dev/core-growth/commands')
  async devCoreGrowthCommand(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @Body() body: unknown,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    const candidate = body as { surface?: unknown; command?: unknown };
    if (typeof candidate?.surface !== 'string' || typeof candidate?.command !== 'string' || candidate.command.trim().length === 0) {
      throw new BadRequestException('surface_and_command_required');
    }
    if (!this.devCoreGrowthService.supportsSurface(candidate.surface)) throw new BadRequestException('unsupported_dev_core_growth_surface');
    return this.devCoreGrowthService.acknowledgeNoop(familyId, candidate.surface, candidate.command.trim());
  }

  /** UI-11..UI-34 DEV-only read projection/no-op adapter. No payment, notification, booking, share, export, publication or model call is executed. */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/dev/platform-surfaces')
  async devPlatformSurfaces(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    const events = await this.devFlowReceiptService.list(familyId, actorId);
    const projection = this.devPlatformSurfacesService.getProjection(familyId, events);
    return { ...projection, recent_flow_events: events.filter((event) => this.devPlatformSurfacesService.supportsSurface(event.ui_id)) };
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/dev/platform-surfaces/commands')
  async devPlatformSurfacesCommand(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @Body() body: unknown,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    const candidate = body as { surface?: unknown; command?: unknown };
    if (typeof candidate?.surface !== 'string' || typeof candidate?.command !== 'string' || candidate.command.trim().length === 0) {
      throw new BadRequestException('surface_and_command_required');
    }
    if (!this.devPlatformSurfacesService.supportsSurface(candidate.surface)) throw new BadRequestException('unsupported_dev_platform_surface');
    return this.devPlatformSurfacesService.acknowledgeNoop(familyId, candidate.surface, candidate.command.trim());
  }

  /**
   * DEV-only persistent interaction receipt shared by all six business loops.
   * It stores synthetic test-flow state only and never creates an order,
   * booking, entitlement, public post, outcome, notification, export or model call.
   */
  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/dev/flow-events')
  async recordDevFlowEvent(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    const candidate = body as { ui_id?: unknown; command?: unknown; selection?: unknown };
    if (typeof candidate?.ui_id !== 'string' || typeof candidate?.command !== 'string') {
      throw new BadRequestException('ui_id_and_command_required');
    }
    return this.devFlowReceiptService.record(familyId, actorId, {
      ui_id: candidate.ui_id,
      command: candidate.command,
      correlation_id: correlationId?.trim() || randomUUID(),
      idempotency_key: idempotencyKey?.trim() || undefined,
      ...(typeof candidate.selection === 'string' ? { selection: candidate.selection } : {}),
    });
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/dev/flow-events')
  async listDevFlowEvents(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    if (!isUuid(familyId)) throw new BadRequestException('Invalid family_id');
    return { family_id: familyId, events: await this.devFlowReceiptService.list(familyId, actorId) };
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId')
  async getFamilyAggregate(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ): Promise<FamilyAggregateResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    if (!isUuid(familyId)) {
      throw new BadRequestException('Invalid family_id');
    }

    return this.familyService.getFamilyAggregate(familyId, actorId);
  }

  @Post()
  async create(
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
  ): Promise<CreateFamilyResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateCreateFamilyRequest(body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.createFamily(request, meta);
  }

  @RequireFamilyAction('InviteAdult')
  @Post(':familyId/parents')
  async addParent(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
  ): Promise<AddParentResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateAddParentRequest(familyId, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.addParent(request, meta);
  }

  @RequireFamilyAction('AddChild')
  @Post(':familyId/children')
  async addChild(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
  ): Promise<AddChildResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateAddChildRequest(familyId, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.addChild(request, meta);
  }

  @Post(':familyId/relationships')
  async createRelationship(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
  ): Promise<CreateFamilyRelationshipResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateCreateFamilyRelationshipRequest(familyId, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.createRelationship(request, meta);
  }

  @Post(':familyId/life-stages')
  async assignLifeStage(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
  ): Promise<AssignLifeStageResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateAssignLifeStageRequest(familyId, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.assignLifeStage(request, meta);
  }

  @RequireFamilyAction('GrantConsent')
  @Post(':familyId/consents')
  async grantConsent(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<GrantConsentResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateGrantConsentRequest(familyId, idempotencyKey, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.grantConsent(request, meta);
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/growth/onboarding/active')
  async getActiveGrowthOnboarding(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ): Promise<StartGrowthOnboardingResponse | null> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }
    if (!isUuid(familyId)) {
      throw new BadRequestException('Invalid family_id');
    }
    return this.familyService.getActiveGrowthOnboarding(familyId, actorId);
  }

  @Post(':familyId/growth/onboarding')
  async startGrowthOnboarding(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StartGrowthOnboardingResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateStartGrowthOnboardingRequest(familyId, idempotencyKey, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.startGrowthOnboarding(request, meta);
  }

  @RequireFamilyAction('RecordPerspective')
  @Post(':familyId/growth/onboardings/:onboardingId/perspectives')
  async recordPerspective(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<RecordPerspectiveResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateRecordPerspectiveRequest(familyId, onboardingId, idempotencyKey, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.recordPerspective(request, meta);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/perspectives')
  async getPerspectiveSummary(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ): Promise<PerspectiveSummaryResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    if (!isUuid(familyId) || !isUuid(onboardingId)) {
      throw new BadRequestException('Invalid schema');
    }

    return this.familyService.getPerspectiveSummary(familyId, onboardingId, actorId);
  }

  @Post(':familyId/growth/onboardings/:onboardingId/profile-drafts')
  async buildGrowthProfileDrafts(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<BuildGrowthProfileDraftsResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateBuildGrowthProfileDraftsRequest(familyId, onboardingId, idempotencyKey, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.buildGrowthProfileDrafts(request, meta);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/insight')
  async getGrowthInsight(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ): Promise<GrowthInsightResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    if (!isUuid(familyId) || !isUuid(onboardingId)) {
      throw new BadRequestException('Invalid schema');
    }

    return this.familyService.getGrowthInsight(familyId, onboardingId, actorId);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/report-explanation')
  async getReportExplanation(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const events = await this.devFlowReceiptService.list(familyId, actorId!);
    return this.devCoreGrowthService.getReportExplanation(familyId, onboardingId, insight, events);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/plan-preview')
  async getPlanPreview(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const events = await this.devFlowReceiptService.list(familyId, actorId!);
    return this.devCoreGrowthService.getPlanPreview(familyId, onboardingId, insight, events);
  }

  @Post(':familyId/growth/onboardings/:onboardingId/plan-preview/refresh')
  async refreshPlanPreview(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    if (!idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    await this.devFlowReceiptService.record(familyId, actorId!, {
      ui_id: 'UI-04',
      command: 'PREVIEW_SYNTHETIC_90_DAY_PLAN_DRAFT',
      correlation_id: correlationId?.trim() || randomUUID(),
      idempotency_key: idempotencyKey.trim(),
    });
    const events = await this.devFlowReceiptService.list(familyId, actorId!);
    return { ...this.devCoreGrowthService.getPlanPreview(familyId, onboardingId, insight, events), refreshed: true, external_effect: false };
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/growth/onboardings/:onboardingId/service-journey')
  async getServiceJourney(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const events = await this.devFlowReceiptService.list(familyId, actorId!);
    return this.devCoreGrowthService.getServiceJourneyProjection(familyId, onboardingId, insight, events);
  }

  @RequireFamilyAction('ReadFamily')
  @Post(':familyId/growth/onboardings/:onboardingId/service-journey/checkin-drafts')
  async createPrivateServiceJourneyCheckinDraft(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    if (!idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    const candidate = body as { action_ref?: unknown };
    const actionRef = candidate?.action_ref;
    if (actionRef !== 'WEEKLY_ACTION_SEE' && actionRef !== 'WEEKLY_ACTION_ADJUST' && actionRef !== 'PAUSE_AND_RETURN') {
      throw new BadRequestException('unsupported_private_checkin_action_ref');
    }
    // Require active onboarding/provenance before recording a family-private draft.
    await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const effectiveCorrelationId = correlationId?.trim() || randomUUID();
    const receipt = await this.devFlowReceiptService.record(familyId, actorId!, {
      ui_id: 'UI-06',
      command: 'CREATE_PRIVATE_CHECKIN_DRAFT',
      correlation_id: effectiveCorrelationId,
      idempotency_key: idempotencyKey.trim(),
      selection: actionRef,
    });
    return {
      receipt_id: receipt.event_id,
      family_id: familyId,
      onboarding_id: onboardingId,
      state: receipt.replayed ? 'REPLAYED' as const : 'CREATED' as const,
      visibility: 'FAMILY_PRIVATE' as const,
      draft_kind: 'PRIVATE_CHECKIN_DRAFT' as const,
      action_ref: actionRef,
      external_effect: false as const,
      ontology_write: false as const,
      audit_event_ref: receipt.event_id,
      correlation_id: effectiveCorrelationId,
      boundary: 'DRAFT_IS_NOT_TASK_OUTCOME_COMMUNITY_POST_OR_SERVICE_RECORD' as const,
    };
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/growth/onboardings/:onboardingId/growth-profile-readback')
  async getGrowthProfileReadback(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const events = await this.devFlowReceiptService.list(familyId, actorId!);
    return this.devCoreGrowthService.getGrowthProfileReadback(familyId, onboardingId, insight, events);
  }

  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/growth/onboardings/:onboardingId/family-review-readback')
  async getFamilyReviewReadback(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ) {
    assertReadContext(familyId, actorId, onboardingId);
    const insight = await this.familyService.getGrowthInsight(familyId, onboardingId, actorId!);
    const [events, journeyActions] = await Promise.all([
      this.devFlowReceiptService.list(familyId, actorId!),
      this.growthActionService.listCompletedJourneyActions(familyId, actorId!, onboardingId),
    ]);
    return this.devCoreGrowthService.getFamilyReviewReadback(familyId, onboardingId, insight, events, journeyActions);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/priority')
  async getGrowthPriorityInsight(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ): Promise<GrowthPriorityInsightResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    if (!isUuid(familyId) || !isUuid(onboardingId)) {
      throw new BadRequestException('Invalid schema');
    }

    return this.growthPriorityService.getGrowthPriorityInsight(familyId, onboardingId, actorId);
  }

  @RequireFamilyAction('ConfirmGrowthPriority')
  @Post(':familyId/growth/onboardings/:onboardingId/priority/confirm')
  async confirmGrowthPriority(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ConfirmGrowthPriorityResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateConfirmGrowthPriorityRequest(familyId, onboardingId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.growthPriorityService.confirmGrowthPriority(request, meta);
  }

  @Get(':familyId/growth/interventions/LISTEN_BEFORE_RESPOND')
  async getInterventionCard(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ): Promise<InterventionCardDto> {
    assertReadContext(familyId, actorId);
    return this.interventionService.getInterventionCard(familyId, actorId!);
  }

  @RequireFamilyAction('StartIntervention')
  @Post(':familyId/growth/onboardings/:onboardingId/interventions/start')
  async startIntervention(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StartInterventionResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateStartInterventionRequest(familyId, onboardingId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.interventionService.startIntervention(request, meta);
  }

  @Get(':familyId/growth/onboardings/:onboardingId/interventions/active')
  async getActiveIntervention(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @ActorId() actorId: string,
  ): Promise<StartInterventionResponse | null> {
    assertReadContext(familyId, actorId, onboardingId);
    return this.interventionService.getActiveIntervention(familyId, onboardingId, actorId!);
  }

  /**
   * Full 90-day Journey projection. The current phase is schedule state only;
   * it is never an outcome, diagnosis, ranking or automatic recommendation.
   */
  @RequireFamilyAction('ReadFamily')
  @Get(':familyId/growth/journey-plan')
  async getJourneyPlan(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ): Promise<JourneyPlanProjection> {
    assertReadContext(familyId, actorId);
    return this.journeyPlanService.getActiveProjection(familyId, actorId!);
  }

  @RequireFamilyAction('CreateJourneyPlan')
  @Post(':familyId/growth/onboardings/:onboardingId/journey-plan')
  async createJourneyPlan(
    @Param('familyId') familyId: string,
    @Param('onboardingId') onboardingId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateJourneyPlanResponse> {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    const request = validateCreateJourneyPlanRequest(familyId, onboardingId, idempotencyKey, body);
    return this.journeyPlanService.createPlan(request, buildAuditMeta(actorId, correlationId, source));
  }

  @RequireFamilyAction('ConfirmJourneyPlan')
  @Post(':familyId/growth/journey-plans/:planId/confirm')
  async confirmJourneyPlan(
    @Param('familyId') familyId: string,
    @Param('planId') planId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ConfirmJourneyPlanResponse> {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    const request = validateConfirmJourneyPlanRequest(familyId, planId, idempotencyKey, body);
    return this.journeyPlanService.confirmPlan(request, buildAuditMeta(actorId, correlationId, source));
  }

  @RequireFamilyAction('PauseJourneyPlan')
  @Post(':familyId/growth/journey-plans/:planId/pause')
  async pauseJourneyPlan(
    @Param('familyId') familyId: string,
    @Param('planId') planId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PauseJourneyPlanResponse> {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    const request = validatePauseJourneyPlanRequest(familyId, planId, idempotencyKey, body);
    return this.journeyPlanService.pausePlan(request, buildAuditMeta(actorId, correlationId, source));
  }

  @RequireFamilyAction('ReviewJourneyPhase')
  @Post(':familyId/growth/journey-plans/:planId/phase-review')
  async reviewJourneyPhase(
    @Param('familyId') familyId: string,
    @Param('planId') planId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ReviewJourneyPhaseResponse> {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    const request = validateReviewJourneyPhaseRequest(familyId, planId, idempotencyKey, body);
    return this.journeyPlanService.reviewCurrentPhase(request, buildAuditMeta(actorId, correlationId, source));
  }

  @Get(':familyId/growth/actions/today')
  async getTodayGrowthAction(
    @Param('familyId') familyId: string,
    @ActorId() actorId: string,
  ): Promise<GrowthActionDto | null> {
    assertReadContext(familyId, actorId);
    return this.growthActionService.getTodayAction(familyId, actorId!);
  }

  @RequireFamilyAction('CompleteAction')
  @Post(':familyId/growth/actions/:actionId/complete')
  async completeGrowthAction(
    @Param('familyId') familyId: string,
    @Param('actionId') actionId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CompleteGrowthActionResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateCompleteGrowthActionRequest(familyId, actionId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.growthActionService.completeGrowthAction(request, meta);
  }

  /**
   * UI-09 first real slice facade. The pre-existing growth/actions/:actionId/complete
   * endpoint remains canonical for current consumers; this UI contract returns a
   * family-scoped readback projection without adding any external effect.
   */
  @RequireFamilyAction('CompleteAction')
  @Post(':familyId/tasks/:taskId/check-in')
  async checkInTodayTask(
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }
    const request = validateCompleteGrowthActionRequest(familyId, taskId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    const response = await this.growthActionService.completeGrowthAction(request, meta);
    return projectTaskCheckinResult(response.action, meta.correlationId, request.idempotency_key, response.replayed === true);
  }

  /** UI-09 persisted interaction lifecycle: start, pause, resume, or cancel. */
  @RequireFamilyAction('CompleteAction')
  @Post(':familyId/tasks/:taskId/state')
  async changeTodayTaskState(
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!actorId || actorId.trim().length === 0) throw new UnauthorizedException('actor_is_authenticated');
    const request = validateTaskStateActionRequest(familyId, taskId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    const response = await this.growthActionService.transitionTaskExecution(request, meta);
    return projectTaskStateResult(response.action, meta.correlationId, request.idempotency_key, response.replayed);
  }

  @Post(':familyId/growth/outcome-observations')
  async recordOutcomeObservation(
    @Param('familyId') familyId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<RecordOutcomeObservationResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateRecordOutcomeObservationRequest(familyId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.growthReviewService.recordOutcomeObservation(request, meta);
  }

  @Post(':familyId/growth/intervention-episodes/:episodeId/review/complete')
  async completeGrowthReview(
    @Param('familyId') familyId: string,
    @Param('episodeId') episodeId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CompleteGrowthReviewResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateCompleteGrowthReviewRequest(familyId, episodeId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.growthReviewService.completeGrowthReview(request, meta);
  }

  @Post(':familyId/growth/reviews/:reviewId/next-step')
  async recordNextStepDecision(
    @Param('familyId') familyId: string,
    @Param('reviewId') reviewId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<RecordNextStepDecisionResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateRecordNextStepDecisionRequest(familyId, reviewId, idempotencyKey, body);
    const meta = buildAuditMeta(actorId, correlationId, source);
    return this.growthReviewService.recordNextStepDecision(request, meta);
  }

  @Get(':familyId/growth/intervention-episodes/:episodeId/timeline')
  async getGrowthTimeline(
    @Param('familyId') familyId: string,
    @Param('episodeId') episodeId: string,
    @ActorId() actorId: string,
  ): Promise<FamilyTimelineResponse> {
    assertReadContext(familyId, actorId, episodeId);
    return this.growthReviewService.getTimeline(familyId, episodeId, actorId!);
  }

  @Post(':familyId/growth/profile-drafts/:draftId/confirm')
  async confirmGrowthProfile(
    @Param('familyId') familyId: string,
    @Param('draftId') draftId: string,
    @Body() body: unknown,
    @ActorId() actorId: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-source') source?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ConfirmGrowthProfileResponse> {
    if (!actorId || actorId.trim().length === 0) {
      throw new UnauthorizedException('actor_is_authenticated');
    }

    const request = validateConfirmGrowthProfileRequest(familyId, draftId, idempotencyKey, body);
    const meta: AuditMeta = {
      actor: actorId,
      correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
      source: source && source.trim().length > 0 ? source : 'api',
      occurredAt: new Date().toISOString(),
    };

    return this.familyService.confirmGrowthProfile(request, meta);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildAuditMeta(actorId: string, correlationId?: string, source?: string): AuditMeta {
  return {
    actor: actorId,
    correlationId: correlationId && correlationId.trim().length > 0 ? correlationId : crypto.randomUUID(),
    source: source && source.trim().length > 0 ? source : 'api',
    occurredAt: new Date().toISOString(),
  };
}

function mutationMeta(correlationId?: string, idempotencyKey?: string, source?: string) {
  return {
    correlationId: correlationId?.trim() || randomUUID(),
    idempotencyKey: idempotencyKey?.trim() || '',
    source: source?.trim() || 'api',
  };
}

function assertReadContext(familyId: string, actorId?: string, onboardingId?: string): void {
  if (!actorId || actorId.trim().length === 0) {
    throw new UnauthorizedException('actor_is_authenticated');
  }
  if (!isUuid(familyId) || (onboardingId !== undefined && !isUuid(onboardingId))) {
    throw new BadRequestException('Invalid schema');
  }
}
