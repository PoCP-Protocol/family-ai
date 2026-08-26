/**
 * FAMILY-SERVICE-PRODUCT-IDENTITY-001 · 服务产品身份元数据(只读展示层,不是执行状态机)。
 * 90天成长方案(family_journey_plans,家庭自主执行,免费)和21天成长营(PRODUCT_PARENT_CHILD_CAMP,
 * 协作者交付,付费)在 UI-01 首页是两个并列独立入口,各自继续走自己已有的技术栈:
 *   90天 → apps/api/.../journey-plan.service.ts (JourneyPlanDto)
 *   21天营 → commerce products (FamilyApiCommerceProductsProjection) + service_collaboration_blueprints
 * 这个文件只提供两者共享的产品身份/阶段词汇,不替换、不合并各自的执行逻辑。
 */

export type ServiceProductStage = 'CONSENSUS' | 'EXECUTION' | 'RETROSPECTIVE';
export const SERVICE_PRODUCT_STAGES: readonly ServiceProductStage[] = ['CONSENSUS', 'EXECUTION', 'RETROSPECTIVE'];

/** 复用各自体系里已经真实存在的 product_ref 字符串,不新造第三个标签体系。 */
export type ServiceProductRef = 'FAMILY_90_DAY_JOURNEY' | 'PRODUCT_PARENT_CHILD_CAMP';

export interface ServiceProductHomeEntry {
  icon: string;
  label: string;
  target_ui: string;
}

export interface ServiceProductIdentity {
  product_ref: ServiceProductRef;
  display_name: string;
  duration_days: number;
  is_paid: boolean; // 90天=false(自主体验,不走购买流程); 21天营=true(commerce产品)
  home_entry: ServiceProductHomeEntry;
  stages: readonly ServiceProductStage[];
}

export const SERVICE_PRODUCT_REGISTRY: readonly ServiceProductIdentity[] = [
  {
    product_ref: 'FAMILY_90_DAY_JOURNEY',
    display_name: 'Family 90天成长方案',
    duration_days: 90,
    is_paid: false,
    home_entry: { icon: 'calendar.fill', label: '90天成长计划', target_ui: 'UI-04' },
    stages: SERVICE_PRODUCT_STAGES,
  },
  {
    product_ref: 'PRODUCT_PARENT_CHILD_CAMP',
    display_name: '21天亲子沟通成长营',
    duration_days: 21,
    is_paid: true,
    home_entry: { icon: 'gift.fill', label: '21天挑战营', target_ui: 'UI-14' },
    stages: SERVICE_PRODUCT_STAGES,
  },
];

export function findServiceProductIdentity(productRef: string): ServiceProductIdentity | null {
  return SERVICE_PRODUCT_REGISTRY.find((entry) => entry.product_ref === productRef) ?? null;
}
