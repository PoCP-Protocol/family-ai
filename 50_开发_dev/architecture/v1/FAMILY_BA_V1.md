# Family Business Architecture V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24

## 核心业务链

```text
Family
→ Need / Concern
→ Understanding
→ Family Decision
→ Growth Priority
→ Program or Journey Enrollment
→ Daily Action
→ Reflection / Service Record
→ Milestone / Outcome Candidate
```

## 业务边界

| 边界 | 规则 |
| --- | --- |
| 家庭真相 | 只能由领域 Named Action 形成或改变 |
| 测评与解读 | 输入是 Perspective，输出是 Hypothesis/Recommendation |
| 21 天 Program | 是 ProgramEnrollment + Daily Action + Service/Growth Record，不是独立 UI 页面 |
| 90 天 Journey | 必须来自家庭确认后的 Growth Priority |
| 专家服务 | 预约意向、真人确认、服务记录和效果结论分离 |
| 商业 | Recommendation 不得被 margin/commission 排序 |
| 社区 | 默认 private first，公开传播必须单独确认和审核 |

## 禁止事项

- 不做 Family Total Score。
- 不做家庭 Ranking。
- 不把服务完成当作 Outcome。
- 不把 Recommendation 自动升级成 Decision 或 Action。
- 不把 AI 文本写成核心 Ontology。