# UI-02/UI-03 Mock规则引擎 vs 真实LLM Gateway 对比验证

**证据等级：E1（内部验证，非外部研究，不可用于自证"LLM更好"这一结论，仅作为下一步决策的输入）**
**溯源：PRIMARY_REAL（本次在隔离git worktree里对真实代码路径的直接观察）**
**验证范围：`packages/family-model` 的 `FamilyEducationModelRuntime.generateUi02AssessmentGatewayDraft`，通过 `AnthropicAiGateway` 连接本地Anthropic兼容网关（`127.0.0.1:15722`）**
**未涉及任何真实家庭数据；全部输入为虚构测试fixture，标注`AI_VERIFY_FIXTURE_FAMILY_NOT_REAL`**

## 一、第一轮：修复前（max_tokens=1024）

Mock（确定性规则引擎）3/3场景成功，但暴露结构性局限：
- 场景A(矛盾信号)：规则引擎不识别题目间矛盾，独立生成互不知情的两条hypothesis
- 场景B(边界情况)：信号稀疏时全部字段返回空数组，无兜底解释
- 场景C(典型情况)：confidence永远硬编码'low'，纯模板拼接文案

Live（真实LLM）3/3全部失败，均为`AiGatewayError [INVALID_JSON]`。

追加诊断复现：用真实4题输入重复调用3次，`output_tokens`精确打满`1024`上限（thinking_tokens占427-754不等），确认根因是`AnthropicAiGateway`(`packages/ai-gateway/src/index.ts:493`)硬编码`max_tokens: 1024`，在opus系列默认开启thinking的情况下，thinking和实际JSON输出共享同一预算，几乎必然截断。

一次更简单输入的复现恰好成功（`output_tokens=914`），输出内容展示了规则引擎做不到的能力：模型自己判断"单题证据不足"并建议"先收集更多相关题目"，`reason_refs`是贴合上下文生成的理由文本而非固定枚举，`action_candidates`有区分度的`priority`字段。

## 二、修复：max_tokens 1024→4096

改动：`packages/ai-gateway/src/index.ts`，`max_tokens: 1024` → `max_tokens: 4096`，附代码注释说明原因和验证依据。

回归验证：`packages/ai-gateway`既有单测38/38全部通过，无回归。

## 三、第二轮：修复后重跑（3场景×2轮=6次）

| 轮次 | 场景 | 结果 |
|---|---|---|
| 1 | A(矛盾信号) | **成功** |
| 1 | B(边界情况) | 失败：`Invalid construct signal boundary: PARENT_CHILD_COMMUNICATION_QUALITY` |
| 1 | C(典型情况) | 失败：`[TIMEOUT] provider timeout after 30000ms` |
| 2 | A(矛盾信号) | 失败：`[TIMEOUT] provider timeout after 30000ms` |
| 2 | B(边界情况) | 失败：`Invalid construct signal boundary: COMMUNICATION_RESPECT_TURN_TAKING` |
| 2 | C(典型情况) | **成功** |

**成功率2/6。max_tokens截断问题确实解决了**（不再出现`INVALID_JSON`），但暴露出两个新问题，性质完全不同：

**1. 超时（2/6）**——纯技术问题，30秒超时对一个需要先thinking再生成结构化JSON的请求偏紧，是参数调优范畴，不涉及价值判断，可以直接放宽timeout配置解决。

**2. Construct命名越界（2/6）——这是fail-closed机制又一次生效，且这次拦下的东西值得认真看**：`assertInterpretationBoundary`（`packages/family-model/src/index.ts:1221`）要求`construct_signals`只能使用题库（`FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK`）里预定义的construct_ref，LLM在信号稀疏（场景B）时自己编了新名字（`PARENT_CHILD_COMMUNICATION_QUALITY`、`COMMUNICATION_RESPECT_TURN_TAKING`），被拦截。**这正是"AI不能凭空发明构念"这条护栏的价值所在**——LLM编的这两个名字看起来完全合理、甚至比题库里现有的名字更精确，但它们没有经过人工评审、没有对应的题库映射和行动候选，一旦放行，就是AI在悄悄扩张自己能"诊断"的范围,不需要任何人批准就能创造新的判断维度。

**成功的那次场景A样本，恰好证明了"该放开的地方"和"该守住的地方"可以共存**：LLM生成了一条新hypothesis `HYP_3_CONTRADICTORY_SIGNAL_COMMUNICATION_VS_RULE_CONFLICT`，复用已有的两个construct_ref组合（没有编造新construct），并附带一段人类可读的判断：

> "Reported low interruption and high willingness to talk co-occur with very frequent device-rule conflict; this pattern is inconsistent enough that it should not be resolved automatically and requires human interpretation rather than being averaged or explained away."

这正是设计场景A想验证的能力——**识别矛盾、不强行调和、明确说"这个需要人来看"**——规则引擎结构上做不到，而这次LLM做到了，且没有越界。

## 四、结论与建议（我的判断，非事实，供你决定）

1. **"AI层能不能比规则引擎强"这个问题的答案是：能，且能在不越界的前提下强**——场景A的样本展示的矛盾识别、自我怀疑、有区分度的优先级，正是这个项目理论框架（Perspective≠Fact / Hypothesis≠Fact）真正需要的表达能力。

2. **目前挡在中间的是两类不同性质的问题**：
   - 超时(纯参数调优，几分钟能改好，不涉及任何价值判断)
   - construct越界(是fail-closed机制刻意设计要拦的东西，不是bug——这次的观察反而印证了这道护栏该继续留着，因为它成功拦下了一个"看起来合理但未经批准的AI自创分类")

3. **不建议因为2/6成功率就得出"LLM不行"或"护栏太严"的结论**——2次超时是配置问题会被修好；2次construct越界恰恰说明护栏在真实攻击面前有效，这本身是好消息，不是要拆的东西；1次场景A的成功已经证明了核心假设：真实LLM能做规则引擎做不到的、有价值的、且守规矩的推理。

4. **建议下一步**：（a）放宽超时到45-60秒解决纯技术问题；（b）如果要让LLM能建议新的construct，应该走一条**新的、显式的"候选construct提案"通道**（比如生成后先进入人工审核队列，被批准后才纳入题库），而不是放宽`assertInterpretationBoundary`直接允许AI自由命名——这是产品/治理层的设计决策，需要你或总架构师拍板，我这次验证不能替你做这个决定，只能把"这道护栏真实拦下了什么"讲清楚。

## 五、本次验证遗留的产物

- 验证脚本：`reports/ai-verify/run-ui02-gateway-comparison.mjs`（隔离worktree内，一次性脚本，非正式测试用例）
- 修复代码：`packages/ai-gateway/src/index.ts`的`max_tokens`改动
- 两轮原始JSON对比结果
- 本报告

目前均只存在于隔离worktree里，未提交、未推送。是否要把max_tokens修复本身（这是一个明确、有测试验证、无回归的bug fix）提交到主分支，由你决定。
