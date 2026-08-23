import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OrchestrationRepository } from './orchestration.repository';
import {
  type ExecuteTestExperienceDto,
  type OperationFollowUpResult,
  type TestExperienceAction,
  type TestExperienceCustomerProjection,
  type TestExperienceOperationResult,
  type UpdateOperationFollowUpDto,
  TEST_EXPERIENCE_FIXTURE_VERSION,
  fixtureAllowedForTestExperienceAction,
  isTestExperienceAction,
  operationKindForTestExperienceAction,
  pageAllowedForTestExperienceAction,
  testExperienceTextEquivalent,
} from './test-experience.contract';
import { getFamilyLlmPagePolicy } from './llm-gateway/family-llm-page-policy';
import { requireDevSyntheticTestLoop } from './test-env.policy';
import { FamilyProductEventService } from './family-product-event.service';

interface OperationRow {
  operation_id: string;
  page_id: string;
  operation_kind: TestExperienceOperationResult['operation_kind'];
  fixture_ref: string;
  fixture_version: string;
  status: 'CREATED' | 'CONFIRMED' | 'CANCELLED';
  environment: 'DEV' | 'TEST';
  source: 'TEST_FIXTURE';
  external_effect: boolean;
  created_at: string | Date;
}

interface DomainCommandRow {
  operation_id: string;
  page_id: string;
  fixture_ref: string;
  event_type: string;
  created_at: string;
}

interface OperationFollowUpRow {
  operation_id: string;
  follow_up_status: 'PENDING_FOLLOW_UP' | 'PROCESSED';
  operator_note: string | null;
  updated_at: string | Date;
}

function operationTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class TestExperienceService {
  constructor(
    @Inject(OrchestrationRepository) private readonly repo: OrchestrationRepository,
    @Inject(FamilyProductEventService) private readonly productEvents: FamilyProductEventService,
  ) {}

  private async assertSyntheticFamilyEligible(familyId: string): Promise<void> {
    const subject = await this.repo.query<{ person_id: string }>(
      `select person_id from persons
       where family_id=$1 and person_type='CHILD'
         and birth_date is not null
         and date_part('year', age(current_date, birth_date)) between 12 and 15
       order by person_id asc limit 1`,
      [familyId],
    );
    const personId = subject.rows[0]?.person_id;
    if (!personId) throw new ForbiddenException('test_experience_synthetic_subject_unavailable');
    const facts = await this.repo.loadEligibilityFacts(familyId, personId);
    if (!facts.serviceConsentGranted) throw new ForbiddenException('service_consent_required');
  }

  private async withIdempotency<T>(familyId: string, action: string, key: string | undefined, request: unknown, work: () => Promise<T>): Promise<T> {
    if (!key) return work();
    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    await this.repo.query(
      `insert into idempotency_keys(idempotency_key, action_name, request_hash)
       values ($1,$2,$3) on conflict (idempotency_key) do nothing`,
      [key, action, requestHash],
    );
    const row = (await this.repo.query<{ action_name: string; request_hash: string; response_body: unknown | null }>(
      `select action_name, request_hash, response_body from idempotency_keys where idempotency_key=$1`,
      [key],
    )).rows[0];
    if (!row || row.action_name !== action || row.request_hash !== requestHash) throw new ConflictException('idempotency_conflict');
    if (row.response_body) return row.response_body as T;
    const response = await work();
    await this.repo.query(
      `update idempotency_keys set response_code=201, response_body=$2::jsonb
       where idempotency_key=$1`,
      [key, JSON.stringify(response)],
    );
    return response;
  }

  private async tenantForFamily(familyId: string): Promise<string> {
    const result = await this.repo.query<{ tenant_id: string }>(
      `select tenant_id from tenant_family_bindings where family_id=$1 and status='ACTIVE' order by effective_from desc limit 1`,
      [familyId],
    );
    const tenantId = result.rows[0]?.tenant_id;
    if (!tenantId) throw new ForbiddenException('tenant_family_binding_required');
    return tenantId;
  }

  private environment(): 'DEV' | 'TEST' {
    const status = requireDevSyntheticTestLoop().environment_status;
    return status === 'TEST_VALIDATED' ? 'TEST' : 'DEV';
  }

  async updateOperationFollowUp(
    familyId: string,
    actorPersonId: string,
    operationId: string,
    dto: UpdateOperationFollowUpDto,
    idempotencyKey?: string,
  ): Promise<OperationFollowUpResult> {
    requireDevSyntheticTestLoop();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) throw new BadRequestException('operation_id_invalid');
    const followUpStatus = dto?.follow_up_status;
    if (followUpStatus !== 'PENDING_FOLLOW_UP' && followUpStatus !== 'PROCESSED') throw new BadRequestException('follow_up_status_required');
    const note = dto.operator_note?.trim() || null;
    if (note && note.length > 1000) throw new BadRequestException('operator_note_too_long');
    const tenantId = await this.tenantForFamily(familyId);
    return this.withIdempotency(
      familyId,
      'ManageOperationReceipt',
      idempotencyKey,
      { familyId, actorPersonId, operationId, followUpStatus, note },
      async () => {
        const target = await this.repo.query<{ found: boolean }>(
          `select exists(
             select 1 from test_experience_operations where family_id=$1 and operation_id=$2
             union all
             select 1 from family_product_events where family_id=$1 and event_id=$2
           ) as found`,
          [familyId, operationId],
        );
        if (!target.rows[0]?.found) throw new NotFoundException('family_operation_receipt_not_found');
        const result = await this.repo.query<OperationFollowUpRow>(
          `insert into family_operation_followups(
             tenant_id, family_id, operation_id, follow_up_status, operator_note, updated_by_person_id
           ) values ($1,$2,$3,$4,$5,$6)
           on conflict (tenant_id, family_id, operation_id) do update set
             follow_up_status=excluded.follow_up_status,
             operator_note=excluded.operator_note,
             updated_by_person_id=excluded.updated_by_person_id,
             updated_at=now()
           returning operation_id, follow_up_status, operator_note, updated_at`,
          [tenantId, familyId, operationId, followUpStatus, note, actorPersonId],
        );
        const row = result.rows[0];
        return {
          operation_id: row.operation_id,
          follow_up_status: row.follow_up_status,
          operator_note: row.operator_note,
          follow_up_updated_at: operationTimestamp(row.updated_at),
          external_effect: false,
          text_equivalent: '已记录当前家庭范围内的人工跟进状态和备注；不会变更订单、服务、权益、儿童事实或触发外部通知。',
        };
      },
    );
  }

  async execute(
    familyId: string,
    actorPersonId: string,
    dto: ExecuteTestExperienceDto,
    correlationId: string,
    idempotencyKey?: string,
  ): Promise<TestExperienceOperationResult> {
    requireDevSyntheticTestLoop();
    if (!isTestExperienceAction(dto?.action)) throw new BadRequestException('test_experience_action_not_allowed');
    if (dto.fixture_version !== TEST_EXPERIENCE_FIXTURE_VERSION) throw new BadRequestException('test_experience_fixture_version_mismatch');
    if (!pageAllowedForTestExperienceAction(dto.action, dto.page_id)) throw new BadRequestException('test_experience_action_page_mismatch');
    if (!fixtureAllowedForTestExperienceAction(dto.action, dto.fixture_ref)) throw new BadRequestException('test_experience_fixture_not_allowed');

    const pagePolicy = getFamilyLlmPagePolicy(dto.page_id!);
    if (!pagePolicy || !(pagePolicy.supported_actions as readonly string[]).includes(dto.action)) {
      throw new ForbiddenException('test_experience_page_policy_denied');
    }
    if (dto.action === 'CREATE_BOOKING' && dto.channel && !['VIDEO', 'TEXT', 'OFFLINE'].includes(dto.channel)) {
      throw new BadRequestException('test_experience_booking_channel_not_allowed');
    }
    if (dto.action !== 'CREATE_BOOKING' && dto.channel) throw new BadRequestException('test_experience_channel_not_allowed');

    await this.assertSyntheticFamilyEligible(familyId);
    const action = dto.action;
    return this.withIdempotency(
      familyId,
      `ExecuteTestExperience:${action}`,
      idempotencyKey,
      { familyId, actorPersonId, pageId: dto.page_id, action, fixtureRef: dto.fixture_ref, fixtureVersion: dto.fixture_version, channel: dto.channel ?? null },
      async () => {
        const operationKind = operationKindForTestExperienceAction(action);
        const result = await this.repo.query<OperationRow>(
          `insert into test_experience_operations(
             family_id, actor_person_id, page_id, operation_kind, fixture_version, fixture_ref,
             channel, status, environment, source, correlation_id, idempotency_key, external_effect
           ) values ($1,$2,$3,$4,$5,$6,$7,'CONFIRMED',$8,'TEST_FIXTURE',$9,$10,false)
           returning operation_id, page_id, operation_kind, fixture_ref, fixture_version, status,
                     environment, source, external_effect, created_at`,
          [
            familyId,
            actorPersonId,
            dto.page_id,
            operationKind,
            TEST_EXPERIENCE_FIXTURE_VERSION,
            dto.fixture_ref,
            dto.channel ?? null,
            this.environment(),
            correlationId,
            idempotencyKey ?? null,
          ],
        );
        const row = result.rows[0];
        if (action === 'ENTER_EXPERT_LIVE' || action === 'CREATE_EVENT') {
          const isActivityInterest = action === 'CREATE_EVENT';
          await this.repo.query(
            `insert into family_service_records(
               family_id, operation_ref, record_kind, source, status, visibility, record_payload,
               external_effect, created_by_person_id, occurred_at
             ) values ($1,$2,$3,'TEST_EXPERIENCE_OPERATION','RECORDED','FAMILY_PRIVATE',$4::jsonb,false,$5,now())
             on conflict do nothing`,
            [
              familyId,
              row.operation_id,
              isActivityInterest ? 'EVENT_REGISTRATION_INTEREST' : 'EXPERT_LIVE_INTEREST',
              JSON.stringify({
                ...(isActivityInterest ? { event_ref: dto.fixture_ref } : { session_ref: dto.fixture_ref }),
                page_id: dto.page_id,
                perspective_boundary: isActivityInterest ? 'REGISTRATION_DRAFT_NOT_ATTENDANCE' : 'FAMILY_INTEREST_ONLY',
                service_effect: 'NOT_ESTABLISHED',
                fixture_only: true,
              }),
              actorPersonId,
            ],
          );
        }
        const tenantId = await this.tenantForFamily(familyId);
        await this.productEvents.record({
          tenantId,
          familyId,
          actorId: actorPersonId,
          eventType: action === 'CREATE_BOOKING' ? 'booking_requested'
            : action === 'CREATE_EVENT' ? 'registration_requested'
            : action === 'PUBLISH_TEMPLATE' ? 'publication_recorded'
            : action === 'CREATE_INVITE' ? 'invite_created' : 'group_created',
          objectType: 'TestExperienceOperation',
          objectId: row.operation_id,
          sourcePageId: dto.page_id,
          purpose: 'PRODUCT_EXPERIENCE',
          consentRef: `service-consent:${familyId}`,
          correlationId,
          payload: { action, fixture_ref: dto.fixture_ref, fixture_version: TEST_EXPERIENCE_FIXTURE_VERSION },
          createdBy: actorPersonId,
        });
        return {
          operation_id: row.operation_id,
          page_id: row.page_id,
          action,
          operation_kind: row.operation_kind,
          fixture_ref: row.fixture_ref,
          fixture_version: TEST_EXPERIENCE_FIXTURE_VERSION,
          status: 'CONFIRMED',
          environment: row.environment,
          source: 'TEST_FIXTURE',
          external_effect: false,
          text_equivalent: testExperienceTextEquivalent(action),
        };
      },
    );
  }

  async cancel(familyId: string, operationId: string): Promise<{ operation_id: string; status: 'CANCELLED'; external_effect: false; text_equivalent: string }> {
    requireDevSyntheticTestLoop();
    const updated = await this.repo.query<{ operation_id: string }>(
      `update test_experience_operations
       set status='CANCELLED', cancelled_at=now()
       where operation_id=$1 and family_id=$2 and status='CONFIRMED'
       returning operation_id`,
      [operationId, familyId],
    );
    if ((updated.rowCount ?? 0) !== 1) throw new BadRequestException('test_experience_operation_not_cancellable');
    return {
      operation_id: operationId,
      status: 'CANCELLED',
      external_effect: false,
      text_equivalent: '已取消本次体验回执。不会撤销支付、预约、活动或任何外部发布，因为这些副作用从未发生。',
    };
  }

  async customerProjection(familyId: string): Promise<TestExperienceCustomerProjection> {
    requireDevSyntheticTestLoop();
    await this.assertSyntheticFamilyEligible(familyId);
    const tenantId = await this.tenantForFamily(familyId);
    const [rows, domainEvents, followUps] = await Promise.all([
      this.repo.query<OperationRow>(
      `select operation_id, page_id, operation_kind, fixture_ref, fixture_version, status,
              environment, source, external_effect, created_at
       from test_experience_operations
       where family_id=$1
       order by created_at desc, operation_id desc`,
      [familyId],
      ),
      this.repo.query<DomainCommandRow>(
        `select event_id::text as operation_id, source_page_id as page_id,
                coalesce(object_id, event_id::text) as fixture_ref, event_type, occurred_at::text as created_at
           from family_product_events
          where family_id=$1
            and source_page_id = any($2::varchar[])
            and object_type <> 'TestExperienceOperation'
          order by occurred_at desc, event_id desc`,
        [familyId, ['UI-13', 'UI-14', 'UI-15', 'UI-16', 'UI-17', 'UI-18', 'UI-19', 'UI-20', 'UI-21', 'UI-22', 'UI-23', 'UI-24']],
      ),
      this.repo.query<OperationFollowUpRow>(
        `select operation_id::text, follow_up_status, operator_note, updated_at
           from family_operation_followups
          where tenant_id=$1 and family_id=$2`,
        [tenantId, familyId],
      ),
    ]);
    const followUpByOperation = new Map(followUps.rows.map((row) => [row.operation_id, row]));
    const operations = [
      ...rows.rows.map((row) => {
        const followUp = followUpByOperation.get(row.operation_id);
        return {
        operation_id: row.operation_id,
        page_id: row.page_id,
        operation_kind: row.operation_kind,
        fixture_ref: row.fixture_ref,
        status: row.status,
        source: 'TEST_FIXTURE' as const,
        authorization_status: 'FAMILY_SCOPE_AUTHORIZED' as const,
        follow_up_status: followUp?.follow_up_status ?? 'NOT_MARKED' as const,
        operator_note: followUp?.operator_note ?? null,
        follow_up_updated_at: followUp ? operationTimestamp(followUp.updated_at) : null,
        external_effect: false as const,
        created_at: operationTimestamp(row.created_at),
        };
      }),
      ...domainEvents.rows.map((row) => {
        const followUp = followUpByOperation.get(row.operation_id);
        return {
        operation_id: row.operation_id,
        page_id: row.page_id,
        operation_kind: 'DOMAIN_COMMAND' as const,
        fixture_ref: row.fixture_ref,
        status: row.event_type === 'booking_request_cancelled' ? 'CANCELLED' as const : 'CONFIRMED' as const,
        source: 'DOMAIN_COMMAND_ADAPTER' as const,
        authorization_status: 'FAMILY_SCOPE_AUTHORIZED' as const,
        follow_up_status: followUp?.follow_up_status ?? 'NOT_MARKED' as const,
        operator_note: followUp?.operator_note ?? null,
        follow_up_updated_at: followUp ? operationTimestamp(followUp.updated_at) : null,
        external_effect: false as const,
        created_at: operationTimestamp(row.created_at),
        };
      }),
    ].sort((left, right) => right.created_at.localeCompare(left.created_at));
    return {
      environment: this.environment(),
      source: domainEvents.rows.length > 0 ? 'DOMAIN_COMMAND_ADAPTER' : 'TEST_FIXTURE',
      operations,
      text_equivalent: '以下显示当前家庭的受控操作回执。它们仅记录家庭范围内的开发或测试动作，不代表支付、权益发放、真人预约、活动资格、社区发布或家庭档案变更。',
    };
  }
}
