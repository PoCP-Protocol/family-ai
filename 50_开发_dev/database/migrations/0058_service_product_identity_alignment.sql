-- FAMILY-SERVICE-PRODUCT-IDENTITY-001
-- 21天成长营在协作分配配置(service_collaboration_blueprints.applicable_program_ref)里用的标签
-- 'communication-21day',与它在commerce产品目录/UI-14首页入口里真实使用的身份
-- 'PRODUCT_PARENT_CHILD_CAMP' 是两个互不相干的字符串(此前从未对齐)。这次让它们对上,
-- 并收紧为与 @family/contracts 的 SERVICE_PRODUCT_REGISTRY 一致的封闭枚举,而不是自由字符串。

UPDATE service_collaboration_blueprints
SET applicable_program_ref = 'PRODUCT_PARENT_CHILD_CAMP'
WHERE applicable_program_ref = 'communication-21day';

ALTER TABLE service_collaboration_blueprints
  ADD CONSTRAINT applicable_program_ref_is_registered_product
  CHECK (applicable_program_ref IN ('FAMILY_90_DAY_JOURNEY', 'PRODUCT_PARENT_CHILD_CAMP'));

COMMENT ON COLUMN service_collaboration_blueprints.applicable_program_ref IS
  'Must match a ServiceProductRef in @family/contracts SERVICE_PRODUCT_REGISTRY (packages/contracts/src/service-product.ts).';
