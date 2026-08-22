import { ForbiddenException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface TenantScopedUiProjectionInput {
  familyId: string;
  accountId: string;
}

type TenantScopeRow = {
  tenant_id: string;
  tenant_ref: string;
  tenant_name: string;
  tenant_role: string;
  policy_version: string | null;
  allowed_pages: string[] | null;
};

/**
 * COMMERCIAL-RUNTIME-ADAPTER-001
 * 收敛既有 Tenant/Family 主数据与商业、服务、会员投影视图；只读，不复制领域模型。
 */
@Injectable()
export class TenantScopedUiProjectionService {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    this.pool = new Pool({ connectionString });
  }

  async getProjection(input: TenantScopedUiProjectionInput) {
    const scope = await this.resolveScope(input);
    const [catalog, commerceAssets, serviceRecords, membershipAssets] = await Promise.all([
      this.pool.query(
        `select product_id, scope_type, tenant_id, product_ref, version_no, title, price_plan_ref,
                entitlement_policy_ref, attributes, status, admission_status, effective_from, effective_to
           from family_product_offerings
          where status='ACTIVE' and admission_status='ADMITTED'
            and effective_from <= now() and (effective_to is null or effective_to > now())
            and (scope_type='PLATFORM' or (scope_type='TENANT' and tenant_id=$1))
          order by scope_type desc, product_ref, version_no desc`,
        [scope.tenant_id],
      ),
      this.pool.query(
        `select asset_id, asset_ref, entitlement_status, source_order_intent_id, available_at, expires_at,
                environment, source_system, external_effect, created_at, updated_at
           from family_customer_commerce_projection_v
          where tenant_id=$1 and family_id=$2
          order by created_at desc`,
        [scope.tenant_id, input.familyId],
      ),
      this.pool.query(
        `select booking_request_id, booking_ref, booking_status, service_offering_ref, availability_slot_ref,
                starts_at, ends_at, channel, booking_service_record_id, service_record_status,
                environment, source_system, external_effect, created_at, updated_at
           from family_customer_service_booking_projection_v
          where tenant_id=$1 and family_id=$2
          order by created_at desc`,
        [scope.tenant_id, input.familyId],
      ),
      this.pool.query(
        `select membership_subscription_id, subscription_ref, plan_ref, plan_version, subscription_status,
                subject_person_id, effective_from, effective_to, benefit_grant_id, benefit_ref, benefit_status,
                allocated_units, remaining_units, valid_from, valid_to
           from family_customer_membership_asset_projection_v
          where tenant_id=$1 and family_id=$2
          order by effective_from desc, benefit_created_at desc`,
        [scope.tenant_id, input.familyId],
      ),
    ]);

    const allowedPages = Array.isArray(scope.allowed_pages) ? scope.allowed_pages : [];
    return {
      projection_version: 'TENANT_SCOPED_UI_001',
      tenant: {
        tenant_id: scope.tenant_id,
        tenant_ref: scope.tenant_ref,
        display_name: scope.tenant_name,
        member_role: scope.tenant_role,
        policy_version: scope.policy_version,
        allowed_pages: allowedPages,
      },
      family_id: input.familyId,
      runtime_boundary: {
        environment: process.env.FAMILY_APP_ENV ?? 'DEV',
        payment: 'NOT_EXECUTED',
        refund: 'NOT_EXECUTED',
        external_booking: 'NOT_EXECUTED',
        external_notification: 'NOT_EXECUTED',
        model_gateway: 'READ_ONLY_OR_NOOP',
      },
      commercial: {
        catalog: catalog.rows,
        entitlement_assets: commerceAssets.rows,
        membership_assets: membershipAssets.rows,
      },
      service: { booking_records: serviceRecords.rows },
      ui_surfaces: buildUiSurfaceRegistry(allowedPages),
    };
  }

  private async resolveScope(input: TenantScopedUiProjectionInput): Promise<TenantScopeRow> {
    const result = await this.pool.query<TenantScopeRow>(
      `select b.tenant_id, t.tenant_ref, t.display_name as tenant_name, m.role as tenant_role,
              p.policy_version, p.allowed_pages
         from tenant_family_bindings b
         join tenants t on t.tenant_id=b.tenant_id and t.status='ACTIVE'
         join tenant_account_memberships m on m.tenant_id=b.tenant_id and m.account_id=$1
              and m.status='ACTIVE' and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
         left join tenant_policy_profiles p on p.tenant_id=b.tenant_id and p.status='ACTIVE'
        where b.family_id=$2 and b.status='ACTIVE'
          and b.effective_from <= now() and (b.effective_to is null or b.effective_to > now())
        limit 1`,
      [input.accountId, input.familyId],
    );
    const scope = result.rows[0];
    if (!scope) throw new ForbiddenException('active_tenant_membership_required_for_family_projection');
    return scope;
  }
}

function buildUiSurfaceRegistry(allowedPages: string[]) {
  const ids = Array.from({ length: 35 }, (_unused, index) => `UI-${String(index + 1).padStart(2, '0')}`);
  return ids.map((ui_id) => ({
    ui_id,
    tenant_policy: allowedPages.length === 0 || allowedPages.includes(ui_id) ? 'ALLOWED_BY_ACTIVE_POLICY' : 'NOT_LISTED_BY_ACTIVE_POLICY',
    read_model: ui_id >= 'UI-13' && ui_id <= 'UI-18'
      ? 'TENANT_COMMERCIAL_CATALOG_OR_ASSET'
      : ui_id >= 'UI-19' && ui_id <= 'UI-24'
        ? 'TENANT_SERVICE_BOOKING_PROJECTION'
        : ui_id >= 'UI-29' && ui_id <= 'UI-34'
          ? 'TENANT_MEMBERSHIP_OR_COMMERCE_ASSET'
          : 'EXISTING_FAMILY_SCOPED_PROJECTION',
    write_boundary: 'EXISTING_NAMED_ACTION_OR_DEV_TEST_NOOP_ONLY',
  }));
}
