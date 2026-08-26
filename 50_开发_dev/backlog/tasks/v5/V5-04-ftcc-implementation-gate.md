# V5-04 FTCC Implementation Gate (CONTRACT_ONLY / NOT_RUNTIME_AUTHORIZED)

status: CONTRACT_ONLY_PROPOSED_FOR_REVIEW

## 目标
把 `FamilyTrustedContextCapsule`（FTCC）从概念要求收敛为可审阅的 implementation gate，保证每次受控上下文传递均满足 purpose、最小披露、生命周期和人工安全约束。

## 范围
定义 FTCC v1 字段与生命周期：requester、recipient、subject、purpose、consent snapshot、provenance、expiry、risk flags、human gate、trace ID；定义 parent、teacher、school、provider、operations 的 recipient-specific capsule 差异及拒绝规则。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/ftcc/`、`50_开发_dev/architecture/platform/` 中明确命名的 FTCC 文档、schema-like contract、静态 gate/fixture 与 `50_开发_dev/evals/ftcc/` 测试。不得修改既有文件。

## 依赖
依赖 V5-01 subject isolation、V5-02 authorization planes、V5-03 FamilyNow；不得绕过 Consent、Purpose Grant、Minor Safety 和 Human Gate。

## 非目标
不实现 capsule service、token 签发、DB 表、migration、真实学校/provider 连接、模型调用或生产 agent 上下文注入。

## 验收
最小字段、recipient-specific 最小披露、provenance/expiry/risk/human gate/trace 规则完整；缺字段、过期、目的不符、主体不符和高风险无人工 gate 均被拒绝；明确禁止 agent/provider 直连 DB。

## 回滚
删除或 revert 新增 FTCC contract、文档、gate 和 fixture；不触及既有 Consent、授权、数据和 runtime。

## 授权门
需 V5-01 至 V5-03 分项通过，并获得 FTCC implementation gate 书面批准；未通过不得把 FTCC 宣称为可用 runtime 能力。

## 风险
capsule 复制和转发可能突破 recipient boundary；expiry/撤回快照不一致会造成过期授权继续生效；高风险标记缺失会绕过人工审查。
