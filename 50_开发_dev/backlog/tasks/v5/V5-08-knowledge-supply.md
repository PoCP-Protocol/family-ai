# V5-08 Knowledge Supply

## 目标
建立 approved source、knowledge/skill registry、检索引用和 small-model readiness 资产，使知识供给具备 provenance、rights、版本、评估和回滚证据。

## 范围
定义 source/skill registry、dataset manifest、model card、retrieval citation、license/rights、evidence level、review status、eval threshold 和 rollback template；复用知识层唯一 evidence 实现。

## 唯一文件边界
仅允许新增 `50_开发_dev/knowledge/`、`50_开发_dev/docs/model/`、`50_开发_dev/evals/knowledge/`、`50_开发_dev/reports/v5/knowledge/` 下明确命名的 registry、manifest、model-card、eval 和报告。不得修改既有文件。

## 依赖
依赖 V5-02 authorization、V5-03 FamilyNow、V5-04 FTCC、现有 `20_知识_knowledge/` evidence.py 及专家审阅能力。

## 非目标
不训练或部署模型、不预训练 family education LLM、不接入未授权 provider、不写生产知识库、不使用自家素材/产出证明自身、不建立跨家庭学习闭环。

## 验收
每项 source/skill/model asset 均有 provenance、rights、version、review、eval、rollback 字段；检索结果携带 source refs 和 evidence level；model card 明确未训练/未部署状态；验证不另写 evidence 等级实现。

## 回滚
删除或 revert 新增 registry、manifest、model-card、eval 和 report；不删除原始证据、不修改知识层既有实现。

## 授权门
需 Knowledge/Skill gate、数据权利/隐私审阅及模型训练/部署分项授权；未通过不得把 readiness 资产作为生产能力。

## 风险
来源权利或 provenance 不完整会导致不可用知识；检索引用丢失会把 hypothesis 误写为 fact；小模型能力边界不明可能绕过 Model Gateway 或安全门。
