# V5-10 Golden Product E2E

## 目标
在全部前置 gate 独立通过后，以 synthetic/fixture 环境验证 Golden Product E2E 的关键用户旅程、边界约束和 readiness 证据，不把设计或内部验证误写为 production readiness。

## 范围
定义并执行 golden journeys：家庭进入与 FamilyNow、受控 context/read、proposal→human confirmation→Named Action→outcome、service workflow、knowledge citation 和失败/撤回路径；验证 localization/curriculum/partner adapter 的设计兼容性。

## 唯一文件边界
仅允许新增 `50_开发_dev/evals/golden/`、`50_开发_dev/contracts/interop/`、`50_开发_dev/architecture/ecosystem/`、`50_开发_dev/reports/v5/golden/` 下明确命名的 E2E scenario、adapter contract、fixture、报告和测试。不得修改既有文件。

## 依赖
依赖 V5-03 FamilyNow、V5-05/V5-06 Harness/MCP、V5-07 workflow、V5-08 knowledge、V5-09 evaluation platform，以及独立安全/隐私/生态 gate。

## 非目标
不修改生产 schema、不接入真实 school/partner、不做跨租户推荐、不公开试点、不做商业化或全国规模、不宣称未实现能力已完成、不新增 DB migration。

## 验收
golden journeys 可在 synthetic/fixture 环境重复复现；每个外部边界均有 adapter、consent、purpose、subject、rollback 证据；E2E 报告明确区分 design、mock、internal runtime、pilot、production；失败场景 fail-closed 且可追溯。

## 回滚
删除或 revert golden scenarios、interop contracts、ecosystem design、fixtures 和 reports；不回滚真实业务数据、既有契约或运行时。

## 授权门
需 V5-09 通过，并取得 Golden Product E2E、生态/规模、安全/隐私独立书面授权；未通过不得进行真实外部试点或生产 readiness 宣称。

## 风险
端到端 fixture 可能掩盖真实 provider/时序差异；跨边界错误可能泄露 subject 或 consent；readiness 证据被误读为 production evidence 会导致越权发布。
