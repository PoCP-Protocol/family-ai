import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';

describe('TENANCY-T3 provider foundation', () => {
  let pool: pg.Pool;
  let tenantId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    pool = createTestPool();
    const tenant = await pool.query<{ tenant_id: string }>(
      `insert into tenants(tenant_ref, display_name, tenant_type, status)
       values ('T3_TEST_TENANT', 'T3 Test Tenant', 'PARTNER', 'ACTIVE')
       on conflict (tenant_ref) do update set status='ACTIVE'
       returning tenant_id`,
    );
    tenantId = tenant.rows[0].tenant_id;
  });

  beforeEach(async () => {
    await pool.query(`delete from provider_admissions where tenant_id=$1`, [tenantId]);
    await pool.query(`delete from organization_tenant_bindings where tenant_id=$1`, [tenantId]);
    await pool.query(`delete from teacher_affiliations where organization_id in (select organization_id from organizations where organization_ref like 'T3_%')`);
    await pool.query(`delete from provider_profiles where provider_ref like 'T3_%'`);
    await pool.query(`delete from teacher_profiles where teacher_ref like 'T3_%'`);
    await pool.query(`delete from organizations where organization_ref like 'T3_%'`);
    await pool.query(`delete from individual_parties where party_id in (select party_id from parties where display_name like 'T3_%')`);
    await pool.query(`delete from parties where display_name like 'T3_%'`);
  });

  afterAll(async () => { await pool.end(); });

  it('keeps organization and teacher identities separate from Family data ownership', async () => {
    const orgParty = await pool.query<{ party_id: string }>(
      `insert into parties(party_kind, display_name) values ('ORGANIZATION','T3_Organization') returning party_id`,
    );
    const organization = await pool.query<{ organization_id: string }>(
      `insert into organizations(party_id, organization_ref, legal_name, organization_type, status)
       values ($1,'T3_ORG','T3 Organization','EDUCATION_PROVIDER','ACTIVE') returning organization_id`,
      [orgParty.rows[0].party_id],
    );
    await pool.query(
      `insert into organization_tenant_bindings(organization_id, tenant_id) values ($1,$2)`,
      [organization.rows[0].organization_id, tenantId],
    );

    const teacherParty = await pool.query<{ party_id: string }>(
      `insert into parties(party_kind, display_name) values ('INDIVIDUAL','T3_Teacher') returning party_id`,
    );
    await pool.query(`insert into individual_parties(party_id) values ($1)`, [teacherParty.rows[0].party_id]);
    const teacher = await pool.query<{ teacher_profile_id: string }>(
      `insert into teacher_profiles(party_id, teacher_ref, public_display_name, status)
       values ($1,'T3_TEACHER','T3 Teacher','ADMITTED') returning teacher_profile_id`,
      [teacherParty.rows[0].party_id],
    );
    const provider = await pool.query<{ provider_profile_id: string }>(
      `insert into provider_profiles(owner_party_id, provider_kind, provider_ref, display_name, status)
       values ($1,'INDIVIDUAL','T3_PROVIDER','T3 Teacher Provider','ACTIVE') returning provider_profile_id`,
      [teacherParty.rows[0].party_id],
    );
    await pool.query(
      `insert into teacher_affiliations(teacher_profile_id, organization_id, affiliation_type, status)
       values ($1,$2,'CONTRACTOR','ACTIVE')`,
      [teacher.rows[0].teacher_profile_id, organization.rows[0].organization_id],
    );
    await pool.query(
      `insert into provider_admissions(provider_profile_id, tenant_id, status, admission_ref)
       values ($1,$2,'ADMITTED','T3_ADMISSION')`,
      [provider.rows[0].provider_profile_id, tenantId],
    );

    const visible = await pool.query(
      `select tp.teacher_ref
         from teacher_profiles tp
         join provider_profiles pp on pp.owner_party_id=tp.party_id
         join provider_admissions pa on pa.provider_profile_id=pp.provider_profile_id
        where pa.tenant_id=$1 and pa.status='ADMITTED'`,
      [tenantId],
    );
    expect(visible.rows.map((row) => row.teacher_ref)).toEqual(['T3_TEACHER']);
    const familyColumns = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_name in ('families','tenant_family_bindings')`,
    );
    expect(familyColumns.rows.map((row) => row.table_name).sort()).toEqual(['families', 'tenant_family_bindings']);
  });
});