# V5-07 Temporal Workflow

## 目标
形成 21-day、90-day、annual service workflow 的 durable execution 设计和受控 pilot contract，评估 Temporal 等基础设施候选而不提前生产部署。

## 范围
定义 workflow 状态机、暂停/恢复/取消、幂等、人工接管、失败补偿、事件/时间边界和 service case/SLA 关联；明确 pilot 与 production 的隔离和验证证据。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/workflows/`、`50_开发_dev/architecture/workflows/` 和 `50_开发_dev/reports/v5/temporal/` 下明确命名的设计、contract、fixture/eval 资料。不得修改既有文件。

## 依赖
依赖 V5-05 Harness boundary、V5-06 MCP read tools、Named Action/Human Gate/Service Case/SLA 现状；依赖独立 workflow 设计授权。

## 非目标
不部署生产 Temporal、不引入基础设施依赖、不实现自动提醒、真实预约/支付、跨家庭运营或 SLA 成果宣称；不新增 DB migration。

## 验收
状态、转移、暂停/恢复/取消、幂等、人工接管、重试与补偿均可审阅；workflow 只引用批准的 contract；pilot/production 边界、失败证据和回滚路径明确。

## 回滚
删除或 revert workflow contract、设计和 pilot report；不影响现有 service runtime、历史 case 或数据。

## 授权门
需 V5-05/V5-06 相关边界稳定，并获得 durable workflow/pilot 独立书面授权；未通过不得部署或启动真实 workflow。

## 风险
时间推进与重复投递可能造成重复 action；长流程中 consent/FTCC 过期可能继续执行；补偿逻辑若越过 Human Gate 会形成高风险自动化。
