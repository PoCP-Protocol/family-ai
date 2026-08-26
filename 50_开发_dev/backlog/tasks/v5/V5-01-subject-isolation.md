# V5-01 Subject Isolation

## 目标
建立 child、parent、teacher、school、provider、operations 的 canonical subject boundary，确保任何上下文、查询和评估都不能退化为全局 child super-profile。

## 范围
定义 subject identity、subject scope、multi-child isolation、跨主体引用与最小上下文规则；盘点并固化未来 API/contract 需要遵守的隔离约束；提供静态 contract/fixture 验证设计。

## 唯一文件边界
仅允许新增或修改 `50_开发_dev/contracts/subject/`、`50_开发_dev/architecture/platform/` 中明确命名的 subject-isolation 文档，以及 `50_开发_dev/evals/subject-isolation/` 下的静态 contract/fixture 测试。不得修改既有文件。

## 依赖
依赖 V5-00 Runtime Truth、现有 Consent/Minor Safety/tenancy 事实及 Domain Spec；为 V5-02、V5-03、V5-04 提供边界输入。

## 非目标
不改生产 API、canonical ontology、数据库 schema 或 migration；不实现跨租户访问、学校/Provider runtime、全局儿童画像、授权登记或 UI。

## 验收
subject、requester、viewer、relationship、purpose 的边界可审阅且无歧义；multi-child fixture 能证明数据不串读；contract 测试拒绝未限定 subject 的读取；文档明确禁止全局 child super-profile。

## 回滚
删除或 revert 本任务新增的 subject contract、架构文档和 fixture/eval 文件；不触及既有运行时代码、数据和授权状态。

## 授权门
需总架构师书面批准 subject isolation contract，并确认可进入 V5-02；未通过前不得实现 runtime 访问控制。

## 风险
现有接口可能隐含宽 subject scope；关系型身份与业务 subject 可能混淆；若把推断 profile 当 canonical subject，将产生隐私泄漏和跨儿童串读风险。

## 执行前研究记录（V5-01 contract-only）

- 目标文件范围已收敛为新增 `evals/subject-isolation/subject-isolation.contract.spec.ts`；不导入生产代码、不连接 DB/API。
- 根 `package.json` 已配置 Vitest 依赖（通过 workspace 的 API 包提供 `vitest`），但根测试脚本不会包含 `evals/`；因此验证使用已安装的 Vitest CLI 直接传入目标文件，并使用纯 TypeScript 测试实现。
- `tsconfig.base.json` 开启 `strict`，目标为 ES2022；测试应保持无隐式 `any`、无运行时外部依赖。
- 当前 `evals/` 下已有 `adversarial/`、`golden/`、`golden_jsonl/`、`safety/`、`specs/` 目录，但没有既有同类 `.spec.ts` 可复用；本任务测试文件自包含最小 subject context 类型与纯函数。
- 设计覆盖：同一 family 允许；缺 subject、跨 family、跨 tenant、recipient scope 不匹配、global child super-profile 拒绝；多 child 只有在每次请求显式指定 child subject 时允许。
- 分解判定：单一 contract 测试文件、单一纯函数与一组彼此相关的隔离规则，属于一个原子工作单元，无需拆分。
