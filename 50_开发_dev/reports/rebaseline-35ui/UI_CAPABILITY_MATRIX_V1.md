# UI CAPABILITY MATRIX V1 — 35 UI → 用户旅程 → 业务能力

```text
DOC_KIND    = ARCHITECTURE_ARTIFACT (交付物 1/4)
TASK        = FAMILY-35UI-ARCHITECTURE-REBASELINE-001
RULING      = governance/ARCHITECTURE_DRIVER_35UI_REBASELINE_001.md
DATE        = 2026-08-22
SOURCE      = apps/mobile/lib/family/ui-registry.ts (FAMILY_SCREENS, 权威第一手来源)
METHOD      = UI → Journey → Capability (方法链第一段)
COVERAGE    = 35/35 UI (UI-01 ～ UI-35)
```

> 本矩阵**不做推断**。每个 UI 的功能点、所属 loop/tab、主行动与跳转目标(`primaryTarget`)
> 均取自 `ui-registry.ts` 的 `FAMILY_SCREENS` 定义。旅程链路由 `primaryTarget` 的实际跳转反推;
> 业务能力由 `featurePoints + primaryAction` 归纳。

---

## 一、页面 → Tab / Loop 分布(来自 registry 真实字段)

| Tab (导航) | UI |
|---|---|
| **today** 首页 | UI-01, UI-09, UI-10, UI-35 |
| **growth** 成长 | UI-02, UI-03, UI-04, UI-05, UI-07, UI-08, UI-11, UI-12, UI-29 |
| **discover** 发现 | UI-13, UI-14, UI-15, UI-16, UI-17, UI-25, UI-26, UI-27, UI-28 |
| **services** 服务 | UI-19, UI-20, UI-21, UI-22, UI-23, UI-24, UI-31, UI-34 |
| **mine** 我的 | UI-06, UI-18, UI-30, UI-32, UI-33 |

| Loop (业务闭环) | UI |
|---|---|
| **成长** | UI-01, UI-09, UI-10, UI-11, UI-33 |
| **计划** | UI-04, UI-05, UI-35 |
| **评估** | UI-02, UI-03, UI-07, UI-08, UI-29 |
| **服务** | UI-19, UI-20, UI-21, UI-22, UI-23, UI-24, UI-31, UI-34 |
| **商业** | UI-06, UI-13, UI-14, UI-15, UI-16, UI-17, UI-18, UI-30, UI-32 |
| **社区** | UI-12, UI-25, UI-26, UI-27, UI-28 |

---

## 二、UI Capability Matrix(主表)

功能点(featurePoints)与主行动(primaryAction)取自 registry;旅程(→ primaryTarget)为页面实际跳转。

| UI | 标题 | Loop | 用户旅程(→ 实际跳转) | 提炼的业务能力 |
|---|---|---|---|---|
| UI-01 | 家庭成长首页 | 成长 | → UI-09(查看今日任务) | 家庭今日聚焦 · 当前旅程摘要 · 里程碑回看 · 成长营入口 · 资源推荐 |
| UI-02 | 家庭测评 | 评估 | → UI-03(开始选择场景) | 场景化测评采集 · 家长视角说明 · 测评证据形成 |
| UI-03 | 家庭成长解读 | 评估 | → UI-04(查看成长方案) | AI 诊断解读 · 事实/视角/建议分离 · 下一步建议 |
| UI-04 | 90 天成长方案 | 计划 | → UI-05(查看陪跑安排) | 成长计划编排(四阶段)· Program 模板实例化 |
| UI-05 | 90 天陪跑 | 计划 | → UI-09(查看今日任务) | 陪跑运行 · 本周任务 · 阶段复盘 · 陪伴记录 · 家长社群 |
| UI-06 | 我的会员 | 商业 | → UI-30(查看年度方案) | 会员权益查看 · 服务额度 · 有效期(消费者视图 A) |
| UI-07 | 成长测评入口 | 评估 | → UI-02(进入家庭测评) | 测评发现与推荐 · 同意说明 · 历史记录 |
| UI-08 | 成长报告 | 评估 | → UI-29(查看成长成果) | 阶段成长报告 · 过程记录 · 证据来源 · 待确认内容 |
| UI-09 | 今日成长任务 | 成长 | (行动闭环,无跳转) | 每日行动执行 · 为什么做/怎么说 · 完成与反思打卡 |
| UI-10 | 孩子成长小助手 | 成长 | (孩子端练习) | 孩子友好参与 · 表达选择 · 可见性说明 · 需要帮助 |
| UI-11 | 我们的成长节奏 | 成长 | → UI-08(查看阶段回顾) | 成长节奏(仅与自身过去比)· 参与度 · 暂停恢复 · 自身变化 |
| UI-12 | 成长故事卡 | 社区 | → UI-28(查看家庭小记) | 家庭时刻保存 · 私有优先 · 分享草稿 · 家庭确认 |
| UI-13 | 家庭成长商城 | 商业 | → UI-14(查看推荐方案) | 资源发现(按场景)· 课程/工具/会员/服务 · 已有权益 |
| UI-14 | 成长方案详情 | 商业 | → UI-32(保存方案意向) | 资源详情 · 适用/交付/投入/证据边界 · 意向保存 |
| UI-15 | 邀请有礼 | 商业 | (创建邀请草稿) | 单层邀请 · 成长权益 · 隐私提示 · 邀请记录 |
| UI-16 | 家庭同行计划 | 商业 | (保存参与意向) | 同行意向 · 参与规则 · 取消恢复 |
| UI-17 | 成长积分 | 商业 | (查看积分任务) | 积分任务 · 权益账本 · 已领取 · 规则说明 |
| UI-18 | 会员中心 | 商业 | → UI-30(查看年度陪伴) | 会员状态/权益管理 · 服务入口 · 续费意向(消费者视图 B) |
| UI-19 | 名师专区 | 服务 | → UI-20(查看名师详情) | 专家发现(按需要)· 服务方式 · 可用性 |
| UI-20 | 名师详情 | 服务 | → UI-21(填写咨询需求) | 专家档案 · 适用问题 · 服务边界 · 可预约时段 |
| UI-21 | 在线咨询预约 | 服务 | → UI-24(保存咨询意向) | 咨询需求草稿 · 时间偏好 · 家庭同意 · 预约回执 |
| UI-22 | 沙龙活动 | 服务 | → UI-23(查看活动详情) | 活动发现 · 线上/线下 · 主题筛选 |
| UI-23 | 活动详情 | 服务 | → UI-24(保存活动意向) | 活动详情 · 议程/讲师/适用 · 活动意向 |
| UI-24 | 我的咨询与活动 | 服务 | → UI-34(查看服务记录) | 服务意向/安排/完成回看(消费者视图 A) |
| UI-25 | 家长社区 | 社区 | → UI-26(写家庭小记) | 内容/经验浏览 · 阶段群 · 审核经验 · 收藏 |
| UI-26 | 发布家庭小记 | 社区 | → UI-28(保存小记草稿) | 私有草稿创作 · 去标识化 · 可见性控制 · 审核状态 |
| UI-27 | 家庭小记详情 | 社区 | → UI-25(返回社区) | 内容详情 · 作者视角/评论观点/事实来源分离 |
| UI-28 | 我的社区 | 社区 | → UI-26(写家庭小记) | 私有小记/草稿/已发布管理 · 收藏(消费者视图) |
| UI-29 | 成长成果 | 评估 | → UI-33(查看家庭档案) | 成长成果回看 · 过程证据 · 里程碑 · 来源说明 |
| UI-30 | 年度陪伴方案 | 商业 | → UI-32(查看订单与资产) | 长期陪伴节奏 · 权益 · 续费意向(消费者视图 C) |
| UI-31 | 我的服务 | 服务 | → UI-34(查看服务记录) | 统一服务视图(课程/计划/专家/活动)· 进行中/待处理/已完成(消费者视图 B) |
| UI-32 | 订单与资产 | 商业 | → UI-18(查看会员中心) | 意向/权益/报告/资产回看 |
| UI-33 | 家庭档案 | 成长 | → UI-29(查看成长成果) | 家庭成员/角色/同意/可见性管理 · 成长重点(全局上下文源) |
| UI-34 | 服务记录 | 服务 | → UI-31(返回我的服务) | 服务发生/顾问记录/家长反馈分离 · 来源与时间 |
| UI-35 | 21 天智慧父母成长营 | 计划 | → UI-09(查看今天的行动) | 成长营运行 · Program 模板(21天)· Day 7/14/21 小结 |

---

## 三、从旅程链路反推的四条端到端 Journey(与决策文件 §十一 对齐)

由 `primaryTarget` 的真实跳转反推,页面确实已连成闭环:

- **Journey A 测评→AI诊断→下一步**: UI-07 → UI-02 → UI-03 → UI-04 → (UI-01/UI-05/UI-09)
  registry 实链: `UI07→UI02`,`UI02→UI03`,`UI03→UI04`,`UI04→UI05`,`UI05→UI09`
- **Journey B 成长营→每日行动→阶段复盘**: UI-35 → UI-09 →(打卡)→ UI-11 → UI-08 → UI-29
  registry 实链: `UI35→UI09`,`UI11→UI08`,`UI08→UI29`
- **Journey C AI帮助→真人服务**: UI-01/UI-03 →(需要)→ UI-19 → UI-20 → UI-21 → UI-24 → UI-34
  registry 实链: `UI19→UI20`,`UI20→UI21`,`UI21→UI24`,`UI24→UI34`,`UI34→UI31`
- **Journey D 资源→权益→服务**: UI-13 → UI-14 → UI-32 →(权益)→ UI-18 → UI-30
  registry 实链: `UI13→UI14`,`UI14→UI32`,`UI32→UI18`,`UI18→UI30`,`UI30→UI32`

---

## 四、能力去重观察(供交付物 2/3 合并业务真相)

registry 已用 `baseline` 与 `primaryTarget` 暴露出"多消费者视图共享同一业务真相"的信号:

- **会员/权益视图**: UI-06 · UI-18 · UI-30 · UI-32 → 同一 `Membership/Subscription/Entitlement` 真相
- **服务视图**: UI-24 · UI-31 · UI-34 → 同一 `ServiceCase/ServiceDelivery/ServiceRecord` 真相
- **Program 视图**: UI-04(90天)· UI-05(陪跑)· UI-35(21天营)· UI-09(每日任务)→ 同一 `Program/Stage/Action/CheckIn/Review`,仅 Program Template 不同
- **测评/诊断视图**: UI-07(入口)· UI-02(测评)· UI-03(解读)· UI-08(报告)· UI-29(成果)→ 同一 Growth Intelligence 证据链
- **社区视图**: UI-12(故事卡)· UI-25(社区)· UI-26(发布)· UI-27(详情)· UI-28(我的)→ 同一 `Content/FamilyNote/CommunityPost`,Private First

> 结论符合决策边界:**35 页 = 35 Projection 候选,但业务真相远少于 35 套**。
> 下一交付物(Domain Ownership Matrix)将把每个 UI 归到七域中唯一的 Domain Owner。

---

## 五、验收自检(本交付物范围内)

```text
35_UI_COVERAGE          = 35/35  PASS
SOURCE_IS_FIRST_HAND    = ui-registry.ts FAMILY_SCREENS  PASS(未凭空推断)
JOURNEY_FROM_REAL_LINK  = primaryTarget 反推  PASS
CAPABILITY_DEDUP_SIGNAL = 已标注(会员/服务/Program/测评/社区)  PASS
NEXT                    = DOMAIN_OWNERSHIP_MATRIX_V1(交付物 2/4)
```
