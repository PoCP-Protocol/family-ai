# V5-02 Authorization Planes

## 目标
定义 Family、School、Partner、Operations 四类 authorization planes 与 Purpose Grant 语义，使访问权限、目的、主体、最小上下文和审计边界可独立验证。

## 范围
固化 trust zone、actor/role、purpose、consent、scope、expiry、audit 和 fail-closed 规则；定义 provider 与 agent 不得直连 DB 的边界；为 FTCC 和受控 read tools 提供授权输入。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/authorization/`、`50_开发_dev/policies/v5/` 中明确命名的 authorization/purpose contract、静态 policy fixture 与 `50_开发_dev/evals/authorization-planes/` 测试。不得修改既有文件。

## 依赖
依赖 V5-01 Subject Isolation、V5-00 Runtime Truth、现有 Consent 和 Minor Safety 约束；被 V5-04、V5-05、V5-06 消费。

## 非目标
不实现 IAM、真实跨 trust-zone 访问、学校/Provider 接入、支付或生产授权登记；不新增数据库表、migration、token 服务或 runtime middleware。

## 验收
四类 trust zone、Purpose Grant 最小字段和决策结果明确；允许、拒绝、过期、撤回、未知目的均有 fail-closed fixture；contract 明确 agent/provider 无 DB 直接访问；授权决策可追踪到 subject、purpose 和 consent snapshot。

## 回滚
删除或 revert 新增的 authorization/policy contract、fixture 和 eval 文件；保留既有授权实现与历史审计数据不变。

## 授权门
需总架构师批准四平面与 Purpose Grant 语义，并通过隐私/未成年人安全审阅；未授权不得进入真实跨域访问。

## 风险
trust zone 与既有 tenancy 语义可能重叠；purpose 过宽会导致过度披露；撤回、过期和人工 gate 的优先级不清会形成 fail-open 缺口。
