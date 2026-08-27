# Family Scenario Architecture V1

状态: `EXECUTION_BASELINE`
日期: 2026-08-24
范围: Family AI 从页面驱动升级为场景驱动的工程基线。

## 场景分层

Family V1 以八个一级场景组织产品、数据、应用和 AI 能力。学校、老师、服务商、机构端只列为 future extension，不进入本轮实现口径。

| 场景 | 业务意图 | 用户侧承载 |
| --- | --- | --- |
| SCENE-01 Family Entry & FamilyNow | 家庭进入系统，看到今天最值得做的一件事 | UI-01、UI-09、UI-11、UI-12 |
| SCENE-02 Assessment & Problem Understanding | 家庭表达困扰并理解支持方向 | UI-02、UI-03、UI-07、UI-08 |
| SCENE-03 21-Day First Change | 通过 21 天 Program 完成低剂量第一改变 | UI-14、UI-09、UI-31、UI-34 |
| SCENE-04 90-Day Growth Journey | 进入确认后的长期成长旅程 | UI-04、UI-05、UI-09、UI-10、UI-11、UI-12、UI-29 |
| SCENE-05 Daily AI Companion | 在具体场景中获得受控 AI 陪练 | UI-01、UI-03、UI-09、UI-10 |
| SCENE-06 Expert/Human Service | 从 AI/内容升级到真人服务和记录 | UI-19 至 UI-24、UI-31、UI-34 |
| SCENE-07 Content/Community/Growth Story | 私有记录、内容阅读和受控分享 | UI-12、UI-25 至 UI-28 |
| SCENE-08 Commerce/Membership/Family Asset | 商品、会员、权益、订单、资产与档案 | UI-06、UI-13 至 UI-18、UI-30、UI-32、UI-33 |

## 执行规则

1. 任一新功能必须先映射到一个场景；不能映射时先补场景定义。
2. 每个场景必须完成 BA、DA、AA、TA/AI 四层解构后才进入开发。
3. UI-01..UI-34 是唯一产品页面基线；UI-35 已删除，21-Day Program 只通过既有 UI 链路承载。
4. AI 能力只能输出解释、假设、建议或草稿；核心状态必须通过 Named Action 写入。
5. 高风险家庭场景必须进入 Human Gate，不允许由模型自由文本闭环。