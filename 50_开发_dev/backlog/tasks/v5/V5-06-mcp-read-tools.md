# V5-06 MCP Read Tools

## 目标
为 FamilyHarnessAdapter 定义受控 MCP read tools，使模型只获得经过 subject、purpose、FTCC 和 policy 过滤的 Family domain context。

## 范围
定义 read-only 工具的名称、输入输出、scope、分页/时间边界、provenance、错误和拒绝语义；覆盖 family context、FamilyNow、growth episode、interventions、perspectives、recent actions、service options 等受控读取。

## 唯一文件边界
仅允许新增 `50_开发_dev/contracts/mcp/`、`50_开发_dev/architecture/orchestration/` 中明确命名的 MCP read contract，以及 `50_开发_dev/evals/mcp-read/` 下的 mock/contract tests。不得修改既有文件。

## 依赖
依赖 V5-02 authorization planes、V5-03 FamilyNow、V5-04 FTCC、V5-05 Harness boundary；依赖 Family-owned policy/context boundary。

## 非目标
不接入真实 MCP provider、不实现写工具、不允许 raw SQL/任意表查询、不做 Codex 直连、不实现通用自主 agent 或生产多 agent 编排。

## 验收
每个工具均声明 subject/purpose/recipient/FTCC 要求和 read-only 性质；测试覆盖 denied、expired、wrong-purpose、cross-subject、empty/partial context；工具集合不包含 SQL、table update、ontology mutation 或 generic patch。

## 回滚
删除或 revert MCP read contract、mock tool definitions 和 eval；停用受控 read path，不触及数据库和既有 API。

## 授权门
需 V5-05 通过，并经 MCP/Harness 安全 gate 与总架构师批准；未通过不得向任何 agent 暴露 MCP read tools。

## 风险
工具参数不足可能形成越权枚举；错误信息可能泄露敏感 subject；缓存、分页和重试若不绑定 FTCC，可能返回过期或错误 recipient 的内容。
