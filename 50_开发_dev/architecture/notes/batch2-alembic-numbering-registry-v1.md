# Batch 2 Alembic 迁移号段/协作规则登记表

```text
DOC_KIND = OPERATIONAL_REGISTRY (非新SSOT,是执行纪律登记)
DATE     = 2026-08-28
STATUS   = ACTIVE — 六域(family/consent/growth_priority/growth_plan/intervention/outcome)
           开始各自写真实SQLAlchemy仓储/Alembic迁移前必须先读这份文档
```

## 0. 现状核实(先说清楚起点,不臆测)

`50_开发_dev/backend/migrations/versions/`下**只有一个文件**:`nestjs_0044_baseline.py`——这是Batch 1(Assessment域)建立的Alembic baseline revision,对应NestJS既有schema(截至SQL migration 0044)的起点,不是"从0044开始编号"的意思,是"承认这个schema现状,后续Alembic revision链从这里长出"。

截至本文档写作时,**六个Batch 2域(family/consent/growth_priority/growth_plan/intervention/outcome)都还没有任何自己的Alembic migration文件**。所以"0053编号冲突"那类问题目前还没有发生——本文档是预防性登记,不是补救。

## 1. Alembic revision机制为什么跟SQL手写编号冲突模式不同

TS侧SQL migration(`50_开发_dev/database/migrations/0001_xxx.sql`、`0002_xxx.sql`...)用的是**手写递增数字前缀**。两个开发者同时看到"当前最大是0052",都建"0053_xxx.sql",文件名冲突——这是纯人工协调失败,数字本身不携带任何依赖信息。

Alembic revision id默认是**自动生成的随机哈希**(如`ae1027a6acf`),不是人工递增数字。冲突不会体现在"两人选了同一个数字"这个层面——两人各自生成的revision id几乎不可能撞车。Alembic真正的协作风险是另一种:**多头(multiple heads)**。

Alembic的迁移历史是一条(或多条)由`down_revision`指针串成的链,不是扁平列表。如果A基于当前head X写了迁移Y(`down_revision = X`),同时B也基于X写了迁移Z(`down_revision = X`),两人各自提交后,历史就分叉成两个head(Y和Z),`alembic upgrade head`会报错"Multiple head revisions are present"——这才是六域并行会真正遇到的问题,形式跟"0053文件名冲突"不同,但本质一样:**两方同时基于同一个"当前最新状态"起步,谁先提交谁的算数,后提交的人需要合并**。

区别在于:Alembic的合并有官方工具支持(`alembic merge`命令,生成一个新的merge revision把两个head汇合成一个),不需要像SQL文件名冲突那样手动改文件名重新排号。但仍然需要**知道自己撞车了**才能去合并——如果没人去跑`alembic heads`检查,多头会一直存在,`upgrade head`会持续报错,直到有人发现并处理。

## 2. 六域协作规则(登记,非新设计)

**规则一:一个域一条链式追加,不并行分叉。**

六个域(family/consent/growth_priority/growth_plan/intervention/outcome)各自的表分属不同schema/表集合(参照`architecture/notes/batch2-domain-research-v1.md`各域的表清单),原则上不会有两个域在同一张表上写迁移,天然不容易冲突。但`down_revision`链是全局唯一的一条(除非显式分支),所以即使表不重叠,两个域的迁移如果都以`nestjs_0044_baseline`为`down_revision`起点,一旦都提交就会分叉。

**规则二:提交Alembic迁移前,先跑`alembic heads`确认当前唯一head,新迁移的`down_revision`必须指向这个最新head,不是`nestjs_0044_baseline`(除非你确实是第一个提交的域)。**

这是"先pull再写"的等价物——不是查数字大小,是查revision链的当前尖端。

**规则三:如果确认发生分叉(两个域各自提交后出现两个head),不要手动瞎改`down_revision`试图拼接,用`alembic merge -m "merge <域A>与<域B>" head1 head2`生成官方合并revision。**

**规则四:每个域的迁移文件命名建议带域名前缀(如`family_0001_xxx.py`/`consent_0001_xxx.py`),纯粹为了人类可读,不是Alembic本身要求的排序依据(排序看revision链,不看文件名)。**

**规则五:合并到`batch2-integration-p0-001`或未来正式的Python-only主干前,合并者必须跑一次`alembic heads`确认结果只有一个head,再跑`alembic upgrade head`(针对测试库)验证链路真的能跑通,不能只看Python代码测试通过就认为migration没问题——Python单测目前全部用Fake repository,不会触发真实的Alembic链路验证。**

## 3. 与TS侧0053教训的对应关系

TS侧教训的核心不是"数字选重了"这个表面问题,是"两人同时基于同一个'当前最新状态'开工,谁也不知道对方在做什么,提交时才发现冲突"。这个根因在Alembic下**依然存在**(六域并行同样是"同时基于同一个最新head开工"),只是冲突的**表现形式**和**修复工具**不同(自动合并 vs 手动改文件名)。所以"六域并行冲突面更大"这个判断本身没错——不是因为Alembic更容易冲突,是因为参与方从"两人"变成"六个并行域",分叉的组合数更多,而且六域是**并行agent各自在独立worktree工作**,互相看不到对方的实时进度,比人类开发者更容易同时撞上同一个head而不自知。

**结论**:Alembic机制本身不能自动避免这类冲突(它只是让冲突"可检测、可合并"),真正的防线是**规则二+规则五**——提交前查head、合并前验证head唯一——这是操作纪律,不是技术自动解决的。

## 4. 当前建议的下一步(登记,不代表本文档已执行)

在#56(各域接入真实SQLAlchemy仓储)任务真正开始写Alembic迁移文件之前,负责该任务的agent/开发者应该:
1. 先跑`cd 50_开发_dev/backend && alembic heads`确认当前唯一head是`nestjs_0044_baseline`。
2. 如果六域要并行各自写迁移,建议**串行提交、每提交一个立刻跑一次`alembic heads`确认仍是单头**,而不是六个域各自独立生成迁移文件后最后一起合并——后者正是"分叉组合数最多"的做法,应该避免。
3. 如果因为并行开发确实产生了多头,按规则三处理,不要手动拼接。
