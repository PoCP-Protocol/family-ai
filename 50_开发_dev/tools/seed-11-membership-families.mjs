// 本地 DEV/TEST 专用：创建 11 个独立账号、家庭、孩子、SERVICE consent，并通过真实会员 API 生成权益。
// 设计目标：每个 external_ref 只有一个家庭，移动端登录后可直接进入 UI-18，不触发 family_selection。
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const API = process.env.API ?? 'http://localhost:3100';
const DATABASE_URL = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL or TEST_DATABASE_URL is required');

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const PLAN_REF = 'MEMBERSHIP_ANNUAL_UI18_FIXTURE';
const TENANT_REF = 'FAMILY_DIRECT';
const PAGE_ID = 'UI-30';
const externalRefs = Array.from({ length: 11 }, (_, i) => `phone:138000000${String(i + 1).padStart(2, '0')}`);
// 让 UI-18 能观察到不同状态：ACTIVE、消费、撤销，以及投影中不显示的终态。
const targetStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE'];

async function sql(text, values = []) {
  return pool.query(text, values);
}

async function ensureCatalogue() {
  let tenantId = (await sql('select tenant_id from tenants where tenant_ref=$1', [TENANT_REF])).rows[0]?.tenant_id;
  if (!tenantId) {
    const tenant = await sql(
      `insert into tenants(tenant_ref, display_name, tenant_type, status, region_ref, plan_ref)
         values ($1,'Family Direct Customer Tenant','DIRECT_CUSTOMER','ACTIVE','CN','FAMILY_DIRECT_V1')
       returning tenant_id`,
      [TENANT_REF],
    );
    tenantId = tenant.rows[0]?.tenant_id;
  }
    if (!tenantId) throw new Error(`tenant ${TENANT_REF} could not be created`);
  let planId = (await sql(
    `select plan_id from family_membership_plans
      where tenant_id=$1 and plan_ref=$2 and version_no=1`,
    [tenantId, PLAN_REF],
  )).rows[0]?.plan_id;
  if (!planId) {
    planId = (await sql(
      `insert into family_membership_plans(
         scope_type, tenant_id, plan_ref, version_no, title, source_ref, fixture_only, status, attributes
       ) values ('TENANT',$1,$2,1,'年度成长会员 · UI-18 测试','fixture:ui18-membership',true,'ACTIVE',$3::jsonb)
       returning plan_id`,
      [tenantId, PLAN_REF, JSON.stringify({ fulfillment: 'SANDBOX_NOOP', seed: '11-families' })],
    )).rows[0].plan_id;
  }
  await sql(
    `insert into family_membership_benefit_definitions(
       plan_id, tenant_id, benefit_ref, version_no, title, allocation_type, units_per_grant,
       valid_days, fixture_only, status, attributes
     )
     select $1,$2,'BENEFIT_CONSULT',1,'家庭交流支持','COUNT',2,30,true,'ACTIVE','{}'::jsonb
     where not exists (
       select 1 from family_membership_benefit_definitions
        where plan_id=$1 and benefit_ref='BENEFIT_CONSULT' and version_no=1
     )`,
    [planId, tenantId],
  );
  await sql(
    `insert into family_membership_benefit_definitions(
       plan_id, tenant_id, benefit_ref, version_no, title, allocation_type, units_per_grant,
       valid_days, fixture_only, status, attributes
     )
     select $1,$2,'BENEFIT_CONTENT',1,'成长内容支持','ACCESS',1,null,true,'ACTIVE','{}'::jsonb
     where not exists (
       select 1 from family_membership_benefit_definitions
        where plan_id=$1 and benefit_ref='BENEFIT_CONTENT' and version_no=1
     )`,
    [planId, tenantId],
  );
  return { tenantId, planId };
}

async function call(method, path, token, body, headers = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-correlation-id': `seed-11-${randomUUID()}`,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 保留原始文本 */ }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 500)}`);
  return json;
}

async function bootstrap(externalRef, index) {
  const session = await call('POST', '/auth/account-session', '', { external_ref: externalRef });
  const contexts = await call('GET', '/auth/contexts', session.token);
  let context = contexts.contexts?.[0];
  if (!context) {
    context = await call('POST', '/auth/families', session.token, {
      display_name: `会员测试家庭${String(index + 1).padStart(2, '0')}`,
      guardian_name: `测试家长${String(index + 1).padStart(2, '0')}`,
    });
  }
  return { token: session.token, externalRef, familyId: context.family_id, guardianId: context.person_id };
}

async function ensureChild(family) {
  const existing = await sql(
    `select person_id from persons where family_id=$1 and person_type='CHILD' order by created_at limit 1`,
    [family.familyId],
  );
  if (existing.rows[0]) return existing.rows[0].person_id;
  const child = await call('POST', `/families/${family.familyId}/children`, family.token, {
    display_name: `测试孩子-${family.externalRef.slice(-2)}`,
    birth_date: '2013-06-15',
    idempotency_key: `seed-11-child-${family.familyId}`,
  });
  return child.child?.person_id ?? child.person_id;
}

async function ensureConsent(family, childId) {
  const existing = await sql(
    `select 1 from consents where family_id=$1 and subject_person_id=$2 and guardian_person_id=$3
       and purpose='SERVICE' and status='GRANTED' limit 1`,
    [family.familyId, childId, family.guardianId],
  );
  if (existing.rows[0]) return;
  // 该旧 Family controller 在 Bearer 模式下将 actor 解析为 person UUID，
  // 但 consent service 的 legacy 校验仍要求 guardian external_ref；种子脚本直接写入同一事实表。
  await sql(
    `insert into consents(
       family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at
     ) values ($1,$2,$3,'SERVICE','GRANTED','ui18-seed-v1',now())`,
    [family.familyId, childId, family.guardianId],
  );
}

async function ensureMembership(family, childId, tenantId, index) {
  const existing = await sql(
    `select membership_subscription_id from family_membership_subscriptions
      where tenant_id=$1 and family_id=$2 and idempotency_key=$3`,
    [tenantId, family.familyId, `seed-11-subscription-${family.familyId}`],
  );
  if (existing.rows[0]) {
    return { subscriptionId: existing.rows[0].membership_subscription_id, reused: true };
  }
  const receipt = await call('POST', `/families/${family.familyId}/orchestration/test-loop/membership/subscriptions`, family.token, {
    page_id: PAGE_ID,
    plan_ref: PLAN_REF,
    plan_version: 1,
    subject_person_id: childId,
    attributes: { seed_batch: '11-families', family_index: index + 1 },
  }, { 'idempotency-key': `seed-11-subscription-${family.familyId}` });
  return {
    subscriptionId: receipt.subscription.membership_subscription_id,
    grants: receipt.grants,
    reused: false,
  };
}

async function applyVariant(family, membership, index) {
  const desired = targetStatuses[index];
  const consult = membership.grants?.find((grant) => grant.benefit_ref === 'BENEFIT_CONSULT');
  if (!membership.reused && desired === 'ACTIVE' && index === 1 && consult) {
    await call('POST', `/families/${family.familyId}/orchestration/test-loop/membership/benefits/consume`, family.token, {
      page_id: PAGE_ID, benefit_grant_id: consult.benefit_grant_id, expected_row_version: consult.row_version,
      units: 1,
    }, { 'idempotency-key': `seed-11-consume-${family.familyId}` });
  }
  if (!membership.reused && desired === 'ACTIVE' && index === 2 && consult) {
    await call('POST', `/families/${family.familyId}/orchestration/test-loop/membership/benefits/revoke`, family.token, {
      page_id: PAGE_ID, benefit_grant_id: consult.benefit_grant_id, expected_row_version: consult.row_version,
    });
  }
  if (['PAUSED', 'EXPIRED', 'CANCELLED'].includes(desired)) {
    await sql(
      `update family_membership_subscriptions
          set status=$2::family_membership_subscription_status,
              cancelled_at=case when $2='CANCELLED' then now() else null end,
              effective_from=case when $2 in ('EXPIRED','CANCELLED') then now() - interval '2 minutes' else effective_from end,
              effective_to=case when $2 in ('EXPIRED','CANCELLED') then now() - interval '1 minute' else effective_to end,
              updated_at=now(), updated_by='seed-11-membership-families'
        where membership_subscription_id=$1`,
      [membership.subscriptionId, desired],
    );
  }
}

async function main() {
  const { tenantId } = await ensureCatalogue();
  const results = [];
  for (let index = 0; index < externalRefs.length; index += 1) {
    const family = await bootstrap(externalRefs[index], index);
    const childId = await ensureChild(family);
    await ensureConsent(family, childId);
    const membership = await ensureMembership(family, childId, tenantId, index);
    await applyVariant(family, membership, index);
    results.push({ index: index + 1, external_ref: family.externalRef, family_id: family.familyId, guardian_id: family.guardianId, child_id: childId, status: targetStatuses[index] });
    console.log(JSON.stringify(results.at(-1)));
  }
  console.log(JSON.stringify({ seeded: true, plan_ref: PLAN_REF, tenant_id: tenantId, count: results.length, families: results }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
