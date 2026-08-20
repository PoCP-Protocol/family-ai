# 商业与权益循环研究摘记（工作文件）

- Microsoft Partner Center 将订阅生命周期区分为 Active、Canceled、Suspended、Expired、Disabled、Deleted，并强调状态、用户可用性与数据保留应分离。[1]
- Google Play 文档要求将真实购买状态以安全后端的权威读取为准，再授予或撤销权益；这一原则支持本项目把 `subscription`、`benefit grant` 和 `ledger` 分离。当前 Dev 范围没有购买凭据、支付回调或外部权益发放，因此只能建立家庭内部的意向、激活和权益预览状态，所有回执应为 `external_effect:false`。[2]

[1] https://learn.microsoft.com/en-us/partner-center/customers/subscription-lifecycle
[2] https://developer.android.com/google/play/billing/lifecycle/subscriptions

