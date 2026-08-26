# V5-09 Evaluation Platform

## 目标
建立版本化、可重复的 Family Eval 平台，覆盖安全、主体隔离、授权、结构、可读性及无总分/无排名/无诊断边界，为后续 E2E 提供可信门禁。

## 范围
定义 scenario cards、fixture/synthetic 标记、deterministic runner、schema/policy/security assertions、阈值、报告、专家复核状态和失败分类；连接但不替代既有 evidence 与安全门。

## 唯一文件边界
仅允许新增 `50_开发_dev/evals/platform/`、`50_开发_dev/evals/scenarios/`、`50_开发_dev/reports/v5/evals/` 下明确命名的 runner、scenario、fixture、threshold、report 和测试。不得修改既有文件。

## 依赖
依赖 V5-01 至 V5-08 中稳定的 contract、policy、FTCC、Harness、MCP、workflow 和 knowledge asset；依赖独立 Eval Gate。

## 非目标
不修改生产 runtime/DB/授权登记、不宣称专家结论、不使用独立模型 judge 作为唯一依据、不训练、不自动决策、不建立生产质量或跨家庭效果闭环。

## 验收
场景集可版本化并可重复运行；非法、不安全、subject 越权、结构错误、总分/排名/诊断输出均可 fail；报告区分 synthetic、fixture、internal runtime、待专家复核，阈值和失败证据可追溯。

## 回滚
删除或 revert 新增 scenario、runner、threshold、fixture 和报告；保留既有 eval baseline，不修改生产系统。

## 授权门
需所有被评估 contract 的 owner 认可，并通过独立 Family Eval Gate 与总架构师授权；未通过不得开放 autonomous 或 pilot 能力。

## 风险
fixture 与真实分布不一致会造成虚假通过；阈值漂移会削弱门禁；eval runner 若调用未批准外部模型，可能引入数据泄露和不可重复结果。
