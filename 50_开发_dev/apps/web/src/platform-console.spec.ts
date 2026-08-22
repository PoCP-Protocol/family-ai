import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/platform-console.js'), 'utf8');
const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

describe('正式多租户 Web 控制台', () => {
  it('将控制台保留为显式运营入口，家庭门户作为默认 Web 入口', () => {
    expect(main).toContain("createPlatformConsole");
    expect(main).toContain("searchParams.get('product') === 'console'");
    expect(main).toContain("searchParams.get('product') === 'family' || !searchParams.get('product')");
    expect(main).toContain('mountFamilyPortal');
    expect(main).toContain("searchParams.get('product') === 'growth-onboarding'");
    expect(main).toContain("searchParams.get('product') === 'test-loop'");
  });

  it('呈现家庭、交付、服务、内容、资产、运营和租户工作台', () => {
    for (const label of ['家庭工作台', '成长交付', '专家与服务', '内容与社群', '会员与资产', '运营工作台', '租户设置']) {
      expect(source).toContain(label);
    }
  });

  it('明确复用现有租户授权边界而不在前端创建新本体', () => {
    expect(source).toContain('tenant_family_bindings');
    expect(source).toContain('tenant_policy_profiles');
    expect(source).toContain('Family Scope Guard');
    expect(source).toContain('不在 Web 端创建平行的 tenant 或 IAM 本体');
  });

  it('不把前端租户参数当作授权，并保持受控外部效果边界', () => {
    expect(source).toContain('不在 Web 端自行裁决高风险策略');
    expect(source).toContain('实际写入仍由现有 Family API、角色、租户与家庭范围策略校验');
    expect(source).not.toMatch(/paymentIntent|Share\.share|Linking\.openURL/);
  });

  it('仅在已有 Bearer 家庭会话时加载统一 tenant-scoped 投影，并保留无会话开发预览', () => {
    expect(main).toContain('createFamilyApiAdapter');
    expect(main).toContain('getTenantScopedUiProjection');
    expect(main).toContain('familyId && bearerToken');
    expect(source).toContain('loadTenantScopedProjection');
    expect(source).toContain('tenant/family 双重范围校验');
    expect(source).toContain('不会在前端生成或放大任何授权');
  });

  it('在同一家庭会话下提供受控回执的页面和状态筛选，不伪造无会话运营数据', () => {
    expect(main).toContain('loadFamilyOperations');
    expect(main).toContain('getExperienceCustomerProjection');
    expect(source).toContain('receiptPageFilter');
    expect(source).toContain('receiptStatusFilter');
    expect(source).toContain('receiptPageLabel');
    expect(source).toContain('建立真实家庭会话后，可按页面和状态查看当前家庭的受控回执。');
    expect(source).toContain("item.source === 'DOMAIN_COMMAND_ADAPTER'");
  });
});
