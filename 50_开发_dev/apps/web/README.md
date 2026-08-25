# Family AI Web 控制台

> **TRANSITIONAL_VISUAL_PROTOTYPE**：此目录保留用于迁移期视觉回归和历史开发验证，不是正式生产入口。正式产品入口是独立部署的 `apps/consumer-web`（Consumer Web）与 `apps/ops-web`（Operations Web），不依赖 `?product=family` 或 `?product=console`。

## 目标

这是 Family AI 的桌面优先 Web 前端，用于家庭成长运营、服务供给、内容审核、权益资产和租户管理兼容入口。它与移动 App 共用 Family API、共享契约、家庭范围授权和现有多租户数据结构；Web 不复制业务本体。

## 启动

```bash
cd 50_开发_dev
pnpm --filter @family/web dev
```

默认端口为 `4173`，避免与 Family API 的 `3000` 端口冲突。可通过 `WEB_PORT=4174 pnpm --filter @family/web dev` 覆盖端口。

## 当前 Web 页面

默认入口是 `?product=console`。它包含家庭工作台、成长交付、专家服务、内容与社群、权益资产、运营工作台和租户设置八个桌面模块。历史开发验证壳仍可通过 `?product=test-loop`、`?product=principal` 或 `?product=waf` 访问。

## 现有多租户复用规则

开发演示可通过 `tenantId` 与 `role` 查询参数切换显示视图，例如：

```text
?product=console&tenantId=tenant_bangyang&role=TENANT_OPERATOR
```

这只改变前端演示视图，**不能**授予权限。正式运行时必须由既有 Bearer、账户成员资格、`tenant_family_bindings`、`tenant_policy_profiles`、Family Scope Guard 和服务端对象级策略决定实际租户、家庭、供给和操作范围。

## 下一步 API 适配

在不创建新租户模型的前提下，为 Web 控制台增加或复用 tenant-scoped read projections：当前角色/租户上下文、家庭队列、成长交付、服务队列、内容审核、权益资产和运营指标。所有写入继续通过已有 Named Action、审计、同意和外部效果适配边界。
