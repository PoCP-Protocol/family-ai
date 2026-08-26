# V5-03 FamilyNow

## 目标
定义 FamilyNow 为 aggregated current-state read model，而非 canonical truth，并建立可追溯、可解释、无总分无排名的家庭当前状态读取契约。

## 范围
规定 FamilyNow 的输入边界（facts/events、perspectives/observations、evidence/hypotheses、actions、service cases、reviews）、source/time/role/provenance 映射、只读投影和 forbidden outputs。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/familynow/`、`50_开发_dev/architecture/platform/` 中明确命名的 FamilyNow/Evidence Graph 设计，以及 `50_开发_dev/evals/familynow/` 下的 contract/fixture 测试。不得修改既有文件。

## 依赖
依赖 V5-01 subject isolation、V5-02 authorization planes、V5-00 runtime truth；为 V5-05、V5-06、V5-10 提供只读契约。

## 非目标
不写 canonical ontology、不做 DB persistence、不做 Family Total Score、家庭/儿童 ranking、固定儿童标签、未审阅临床结论或生产 projection。

## 验收
FamilyNow 的只读输入、subject/purpose 过滤、时间与来源追踪明确；fixture 能拒绝总分、排名、固定标签和未审阅临床 claim；projection 明确不产生 Named Action 或 canonical write。

## 回滚
删除或 revert FamilyNow/Evidence Graph contract、架构文档及 fixture/eval；不回滚既有数据、读接口或核心状态。

## 授权门
需 V5-01/V5-02 通过，并经独立 read-model gate 与总架构师书面批准；未通过不得实现生产聚合读取。

## 风险
多来源证据的时间、置信度和 provenance 可能被错误压平；只读投影若被误认作事实会造成决策越权；敏感字段聚合可能扩大披露范围。
