# CAMP21 Development Asset Pack 001

## Scope

- target_id: camp21-product-detail
- feature_ref: CAMP21_PRODUCT_DETAIL
- ui_ref: UI-14
- product_ref: PRODUCT_PARENT_CHILD_CAMP
- runtime_url: http://localhost:8081/ui/UI-14?productRef=PRODUCT_PARENT_CHILD_CAMP

## Factory Assets

- factory manifest: `factory/development-factory.manifest.json`
- factory runner: `tools/run-development-factory.mjs`
- UI harness: `tools/run-camp21-ui-harness.mjs`
- runtime browser evidence: `reports/factory/browser-evidence/camp21-product-detail.latest.json`
- runtime screenshot: `reports/factory/browser-evidence/camp21-product-detail-8081.latest.png`
- latest factory report: `reports/factory/camp21-development-factory.latest.md`
- latest factory machine report: `reports/factory/camp21-development-factory.latest.json`

## Verified Runtime Text

- 商品详情
- 21天亲子沟通挑战营
- 改善亲子关系，从有效沟通开始
- ¥399
- 拼团价 ¥199 (3人成团)
- 会员价 ¥179 (会员再享95折)
- 视频课程
- 每日打卡
- 社群交流
- 专家答疑
- 立即购买
- 发起拼团

## Development Boundaries

- allowed: SubmitCommerceIntent
- allowed: local bookmark/support no-op state
- forbidden: payment SDK invocation
- forbidden: external order placement
- forbidden: external support notification
- forbidden: automatic family ranking or total score

## Factory Command

```bash
pnpm --dir .\50_开发_dev run factory -- --target camp21-product-detail
```

## Result

The target is now developed and guarded through the generic Family Development Factory rather than a one-off page script.