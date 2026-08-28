# UI-13 / UI-14 商城缺口复核评估（只读调研）

日期：2026-08-28
范围：只读调研，未改代码。对照 `50_开发_dev/governance/FAMILY_34_UI_FRONTEND_BACKEND_CONSISTENCY_MATRIX_001.md` 第30-31行对 UI-13（商城首页）/UI-14（商品详情）的 `UI_READY_BACKEND_GAP` 判定做现状核验。

## 结论：判定已过时，缺口基本已被后续开发闭合

矩阵文档写的判定理由是"尚无正式 catalog DTO；客户端不得传价格"（UI-13）和"尚无商品详情 DTO；价格/权益必须服务端派生"（UI-14）。经代码核验，这两条理由**目前均不成立**：

1. **前端已接真实后端调用，不是占位 mock**：
   - `apps/mobile/app/ui/UI-13.tsx` 通过 `familyApi.getCommerceProducts(...)` 拉取目录，渲染 loading/error/retry 状态，无硬编码商品数据。
   - `apps/mobile/app/ui/UI-14.tsx` 通过 `getCommerceProducts` + `getCommerceCustomerProjection` 并行拉取详情与权益状态，购买动作走 `submitCommerceIntent`（带 idempotency-key），价格字段来自 `commerce-entitlements` 的展示层派生，不是客户端直传价格。

2. **后端已有完整的 catalog 读接口与命令接口，且是真实 DB-backed 服务，不是 test-loop 假数据桶**：
   - Contract：`apps/api/src/modules/orchestration/family-commerce-intent.contract.ts` 定义了 `CommerceProductReadModel`（含 `product_ref/product_version/admission_status/source_ref/attributes_schema_version`）、`OrderIntentReceipt`、`FamilyEntitlementReceipt`、`CustomerCommerceProjection`。这正是矩阵所说"尚无"的那份 DTO——它已经存在。
   - Service：`family-commerce-intent.service.ts` 实现了 `products()` / `submit()` / `cancel()` / `customerProjection()`，全部基于真实 SQL 查询（`family_product_offerings`、`family_order_intents`、`family_order_intent_lines`、`family_entitlements`），带幂等键重放、行版本乐观锁、tenant 归属校验、consent 前置校验（`assertTestCommerceEligible`）。
   - Controller 路由：`GET /families/:familyId/orchestration/test-loop/commerce/products`、`POST .../commerce/order-intents`、`POST .../commerce/order-intents/cancel`、`GET .../commerce/customer-projection`，均挂了 `@RequireOrchestrationAction` 权限门。
   - Migration：`apps/api/database/migrations/0031_family_commerce_intent_and_entitlement.sql` 已建 `family_product_offerings`/`family_order_intents`/`family_order_intent_lines`/`family_entitlements` 四张表，含 scope（PLATFORM/TENANT）、生效窗口、唯一索引、行版本、审计字段。**不需要新建表或写新 migration，表已经在**。
   - 集成测试：`family-commerce-intent.integration.spec.ts`（179行）覆盖该链路。

3. **唯一真实限定**：这套 catalog/order-intent/entitlement 链路当前被 `requireDevSyntheticTestLoop()` 强制限定在 DEV/TEST 环境（`fixture_only=true` 约束写在表 CHECK 里），且价格字段确实不在 `family_product_offerings` 直接建模（`price_plan_ref` 是引用，实际价格展示在前端 `commerce-entitlements.ts` 侧派生/写死档位文案，例如 UI-14 的"拼团价 ¥199"兜底文案）。这是一个**真实但范围更小**的缺口：不是"没有 catalog DTO"，而是"catalog 目前只在 DEV/TEST 合成环境可用，且价格展示层仍是前端侧的展示文案而非服务端定价引擎输出"。

## 工作量与依赖判断

- **不需要新建数据库表或新 migration**：`family_product_offerings` 等四张表已存在且结构完备（scope/effective window/row_version/fixture_only 约束齐全）。
- **不需要新建领域模型**：Contract/Service/Controller/Migration/集成测试五件套已经是完整闭环，属于"小改动"级别的收尾，不是"大改动"级别的新造。
- 如果要做的是"让矩阵文档与代码现状一致"：这是**纯文档修正**，工作量是文档编辑，不涉及代码。
- 如果要做的是"把这条 DEV/TEST fixture 链路升级为生产可用的正式定价目录"（即矩阵条目里"建立 catalog read API 与版本/准入字段"这句里隐含的更大意图）：这才是真正剩余的缺口，涉及：
  - 去掉/替换 `requireDevSyntheticTestLoop()` 门控为生产环境的准入策略；
  - 把价格从前端派生文案改为服务端定价字段（`price_plan_ref` 目前只是引用，没有真实定价引擎/价目表落地）；
  - 补充真实支付/外部订单集成（当前 `external_effect` 恒为 `false`，是设计上的"不接支付"）。
  这部分是**领域/合规范围的大改动**，涉及支付、定价策略、准入规则，不是本 Batch 内可以安全做的小改动。

## 建议

1. 优先做的是**文档层修正**：把矩阵第30-31行的判定从 `UI_READY_BACKEND_GAP` 更新为已闭环（或标注为"DEV/TEST fixture 闭环完成，生产定价/支付仍是独立缺口"），避免文档误导后续开发认为要重新建 DTO/表。
2. 如果业务需要把商城从 DEV/TEST fixture 升级为可上生产的真实商城（真定价、真支付、真准入），这应该作为独立的、经过范围确认的新 Task/Sprint 提出，不属于当前 Batch 可以顺手做的小改动，因为它涉及 Coding Constitution 中的 Stop Condition（修改 Consent/Safety 规则、Public API breaking contract 的可能性、涉及未成年人商业场景的权限规则）。
3 本次调研未改动 `family-api-client.ts`、`UI-04.tsx`、`UI-05.tsx`、`UI-21.tsx`，与并行任务无冲突。

## 关键文件（只读引用）

- `apps/mobile/app/ui/UI-13.tsx`
- `apps/mobile/app/ui/UI-14.tsx`
- `apps/mobile/lib/family/family-api-client.ts`（第191-208行，`getCommerceProducts`/`submitCommerceIntent`/`getCommerceCustomerProjection`，只读引用未改动）
- `apps/api/src/modules/orchestration/family-commerce-intent.contract.ts`
- `apps/api/src/modules/orchestration/family-commerce-intent.service.ts`
- `apps/api/src/modules/orchestration/orchestration.controller.ts`（第261-296行路由）
- `apps/api/database/migrations/0031_family_commerce_intent_and_entitlement.sql`
- `apps/api/src/modules/orchestration/family-commerce-intent.integration.spec.ts`
- `50_开发_dev/governance/FAMILY_34_UI_FRONTEND_BACKEND_CONSISTENCY_MATRIX_001.md`（第30-31行，本次核验的判定来源）
