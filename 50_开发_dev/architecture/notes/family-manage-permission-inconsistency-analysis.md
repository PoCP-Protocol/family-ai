# assertFamilyManagePermission 实现不一致分析

DOC_KIND = ANALYSIS_NOTE(仅分析判断,不含代码改动)
TASK_REF = 承接 batch2-domain-research-v1.md 第1.4节发现的不一致
SCOPE = 50_开发_dev/apps/api/src/modules/family/ (NestJS) + 50_开发_dev/backend/domains/assessment/ (Python 迁移侧)
DATE = 2026-08-28
STATUS = 仅报告事实与判断,未执行任何代码合并/删除/修复

---

## 0. 结论摘要(先说要点)

- 全仓库对 assertFamilyManagePermission 不是"两处"而是"五处函数体":1 处共享实现
  (family-permission.ts,权威版本,含两条通过条件),另外 4 个文件各自声明了同名的本地
  函数。其中 3 个是"桥接壳"(内部原样调用共享实现,行为等价、只是没删掉这层包装),
  1 个(growth-review.service.ts)是真正独立、行为不同的重复实现,只做了共享版本两条
  通过条件中的第 1 条(legacy 审计日志判定创建者),完全没有第 2 条(family_memberships
  表 ACTIVE OWNER_GUARDIAN/GUARDIAN 判定)。
- 这不是"名字撞了但语义不同"的无意义重复,也不是纯粹的历史遗留复制粘贴 —— 它是
  同一权限语义的两版实现,新版(tenancy-v2 家庭成员桥接)只推广到了 4 个文件,漏了
  growth-review.service.ts 这一个。语义本应完全一致(同一个函数名、同一份文档注释描述
  的判定逻辑),差异纯粹是"迁移没做全"造成的行为分裂,不是业务上故意要不同规则。
- 判定为可能的安全/权限漏洞(细节见第3节):在 growth-review.service.ts 覆盖的4个
  端点(RecordOutcomeObservation / CompleteGrowthReview / RecordNextStepDecision /
  GetFamilyTimeline)上,一个通过 family_memberships 表被判定为 ACTIVE
  OWNER_GUARDIAN/GUARDIAN、但并非该家庭 CreateFamily 审计记录里的创建者的合法家庭成员,
  会被这4个端点错误拒绝(403)。这是功能性缺陷(过度拒绝,漏判有权限的人),不是
  "让无权限者通过"的越权放行漏洞 —— 方向是保守/收紧而非放宽,不构成立即的数据泄露或越权
  访问风险,但违反了"同一权限规则在所有端点应一致生效"的预期,且随着 tenancy-v2 家庭成员制
  推广(而非依赖审计日志创建者判定)成为主流路径,该文件的4个端点会逐渐对越来越多的合法
  用户返回错误的403。

---

## 1. 五处函数体对照表

| # | 文件 | 行号 | 类型 | 通过条件1(legacy 审计日志) | 通过条件2(tenancy family_memberships) | 异常类型/错误码 |
|---|------|------|------|---|---|---|
| A(权威) | family-permission.ts | 14-32 | 共享实现,被 export | 有 | 有 | ForbiddenException('actor_has_family_manage_permission') |
| B | family.service.ts | 627-630 | 本地同名函数,桥接壳,内部 return sharedAssertFamilyManagePermission(...) | 委托A | 委托A | 委托A |
| C | growth-action.service.ts | ~255行区 | 本地同名函数,桥接壳,委托A | 委托A | 委托A | 委托A |
| D | growth-priority.service.ts | 204行区 | 本地同名函数,桥接壳,委托A | 委托A | 委托A | 委托A |
| E | growth-review.service.ts | 171-179 | 本地独立实现,非桥接 | 有(唯一判定条件) | 无,完全没有这段查询 | ForbiddenException('actor_has_family_manage_permission')(错误码字符串相同,但判定逻辑不同) |

逐字函数体摘录如下(为避免文档渲染问题,以缩进代替代码围栏,SQL 字符串引号已保留):

A(权威,family-permission.ts):

    export async function assertFamilyManagePermission(client: pg.PoolClient, familyId: string, actorId: string): Promise<void> {
      const audit = await client.query(
        `select audit_id from audit_logs where family_id = $1 and actor_id = $2 and action_name = $3 and result = 'SUCCESS' limit 1`,
        [familyId, actorId, CREATE_FAMILY_ACTION],
      );
      if ((audit.rowCount ?? 0) >= 1) return;

      const membership = await client.query(
        `select 1 from family_memberships
          where family_id = $1 and person_id::text = $2 and status = 'ACTIVE'
            and role in ('OWNER_GUARDIAN','GUARDIAN')
          limit 1`,
        [familyId, actorId],
      );
      if ((membership.rowCount ?? 0) >= 1) return;

      throw new ForbiddenException('actor_has_family_manage_permission');
    }

B/C/D(桥接壳,三处逐字相同,以 family.service.ts 为例):

    // 桥接:委托共享 family-permission(创建者 或 ACTIVE OWNER/GUARDIAN 成员)。
    async function assertFamilyManagePermission(client: pg.PoolClient, familyId: string, actorId: string): Promise<void> {
      return sharedAssertFamilyManagePermission(client, familyId, actorId);
    }

E(growth-review.service.ts,独立实现 —— 关键差异):

    async function assertFamilyManagePermission(client: pg.PoolClient, familyId: string, actorId: string): Promise<void> {
      const result = await client.query(
        `select audit_id
         from audit_logs
         where family_id = $1 and actor_id = $2 and action_name = $3 and result = 'SUCCESS'
         limit 1`,
        [familyId, actorId, CREATE_FAMILY_ACTION],
      );
      if (result.rowCount !== 1) throw new ForbiddenException('actor_has_family_manage_permission');
    }

(该文件顶部未 import { assertFamilyManagePermission } from './family-permission',只 import 了
FamilyRepository / GrowthSubjectResolver / assertNormalSafetyRoute,印证这是完全独立、
未共享的重复代码,而非笔误引用错文件。)

---

## 2. 差异清单(E 相对 A/B/C/D 的行为差异)

| 维度 | A/B/C/D(共享+桥接) | E(growth-review.service.ts 独立版) | 有无业务意义 |
|---|---|---|---|
| 判定条件数 | 2条(legacy 审计 OR tenancy 成员) | 1条(仅 legacy 审计) | 无 —— 无任何注释/文档表明 Outcome 域应比其它域收紧权限 |
| family_memberships 表 | 查询 | 完全不查询 | 无 —— 该表(迁移0018)是全平台统一的家庭成员权限层,其它4处及 Python 迁移侧都已用 |
| role in (OWNER_GUARDIAN,GUARDIAN) | 有 | 不适用(无此分支) | 无 |
| status = ACTIVE 成员过滤 | 有 | 不适用 | 无 |
| person_id::text = actorId 的非UUID容错比较 | 有 | 不适用 | 无 |
| 结果判定写法 | (audit.rowCount ?? 0) >= 1 | result.rowCount !== 1(等价于 === 1 才通过) | 无实质差异(两者在 limit 1 场景下行为一致) |
| 异常类型与错误码字符串 | ForbiddenException(actor_has_family_manage_permission) | 相同 | 无差异 —— 调用方/前端看到的错误码完全一样,无法从错误信息察觉两者判定逻辑不同 |
| 边界条件(family不存在等) | 由调用方 ensureFamilyExists 前置处理,两版一致 | 同上,一致 | 无差异 |

结论:没有发现任何有意义的业务语义差异。唯一的差异就是 E 版本缺了 tenancy-v2 引入的
第二条通过条件,是一次平台级权限判定升级(从"审计日志推断创建者"升级为"支持家庭成员制,
允许 ACTIVE OWNER_GUARDIAN/GUARDIAN 成员而非只有创建者本人管理家庭")覆盖不全的产物 ——
family.service.ts 的注释"桥接:委托共享 family-permission(创建者 或 ACTIVE OWNER/GUARDIAN
成员)"和 family-aggregate.repository.ts 里的注释"桥接:创建者 或 ACTIVE OWNER/GUARDIAN
成员"都明确写出了这次升级的目的,而 growth-review.service.ts 显然没跟上这次升级。

---

## 3. 调用方清单(哪些 controller/service 依赖哪个版本)

### 依赖 A(权威共享实现,直接 import)
- assessment.service.ts(第167行,assertScope路径内)
- dev-flow-receipt.service.ts(第57、108行)
- family-aggregate.repository.ts(第14行,getFamilyAggregate只读聚合查询的权限门)
- growth-hypothesis.service.ts(第144行,Assessment→GrowthIntent 决策桥接 decide 方法)
- intervention.service.ts(第41、49、69行 —— startIntervention)
- journey-plan.service.ts(第85、101、146、182、205行 —— createPlan/confirmPlan等5处)

### 依赖 B(桥接壳,效果=A)
- family.service.ts 全部10处调用(第77/102/127/155/184/208/279/315/341/357/386/413行)
  —— 覆盖 createFamily/addParent/addChild/createRelationship/assignLifeStage/
  Onboarding/Perspective/GrowthProfile 确认等所有 Family 域写路径。

### 依赖 C(桥接壳,效果=A)
- growth-action.service.ts 全部5处调用(第49/73/102/131/165行)
  —— 覆盖 GrowthAction 的今日读取/完成/任务执行状态转移。

### 依赖 D(桥接壳,效果=A)
- growth-priority.service.ts 全部2处调用(第42、65行)
  —— 覆盖 GrowthPriority 草案确认。

### 依赖 E(独立实现,行为与A不同 —— 唯一受影响的调用方)
- growth-review.service.ts 全部4处调用(第45、73、105、123行):
  - recordOutcomeObservation(第45行)—— OutcomeObservation 写入
  - completeGrowthReview(第73行)—— GrowthReview 完成
  - recordNextStepDecision(第105行)—— NextStepDecision 写入
  - 第123行区域的读路径(FamilyTimeline 相关,依 batch2 笔记第5节)

Python 迁移侧(50_开发_dev/backend/domains/assessment/):
permission_policy.py + sqlalchemy_repository.py + fake_repository.py 是对 A(权威2条件版)
的逐字端口(_assert_family_manage_permission 方法名完全对应两条通过条件),测试文件
test_family_manage_permission.py 专门覆盖了这两条通过条件与拒绝路径。Python 侧目前没有
移植 growth-review.service.ts 域,因此尚未产生"该迁移哪个版本"的选择问题 —— 但如果后续
Batch 迁移到 GrowthReview/Outcome 域时按 batch2 笔记字面翻译 growth-review.service.ts 现状,
会把这个不一致原样搬进 Python 版本(需要在那次迁移的 Plan 阶段明确指出应该向 A 版本对齐,
而不是照抄 E 版本)。

---

## 4. 安全风险判断(醒目标记)

不建议判定为"可以安全立即修复的安全漏洞",理由如下,但建议尽快在下一个迁移/维护
窗口把 E 对齐为委托 A —— 这是一个功能性权限判定不一致缺陷,方向是"过度收紧"
(合法家庭成员被误拒),而不是"意外放宽"(未授权者被误放行)。

判断依据:
1. 不是越权放行:E 版本比 A 版本审核更严格(少了一条通过条件,不会多放行任何人)。
   不存在"攻击者利用这个不一致获得本不该有的权限"的路径。
2. 是功能性缺陷:随着平台从"审计日志推断创建者"向"family_memberships 家庭成员制"迁移
   (tenancy-v2,迁移0018),越来越多的合法家庭管理者(尤其是后来被加入、而非最初创建家庭
   的 OWNER_GUARDIAN/GUARDIAN)会在调用 recordOutcomeObservation /
   completeGrowthReview / recordNextStepDecision 时被错误拒绝(403
   actor_has_family_manage_permission),即使他们在其它所有 Family/Growth 端点上都能正常操作。
   这是一个用户可感知的功能性 Bug,不是数据泄露/越权访问类安全漏洞。
3. 之所以不在本文档里建议"立即修复"或自行动手改代码:
   - 任务要求本文档只做分析,不做代码合并/修复。
   - growth-review.service.ts 覆盖的 Outcome 域是家庭教育关怀链路里较敏感的一环
     (OutcomeObservation/GrowthReview 涉及对孩子的观察记录),即便方向是"收紧不是放宽",
     改动权限判定逻辑仍建议走正常评审流程,而非在一次"仅分析"任务里顺手改掉。
4. 如果后续要修复,预期动作是:在 growth-review.service.ts 里删除本地独立实现,改为
   import { assertFamilyManagePermission } from './family-permission'(与 B/C/D 三处
   的桥接写法完全一致),使其与其它4个文件在语义上重新统一为 A。

---

## 5. 参考:与本次调研强相关的已有文档定位

- 50_开发_dev/architecture/notes/batch2-domain-research-v1.md 第1.4节(初次发现此不一致,
  本文档是其展开的独立分析)。
- 50_开发_dev/backend/domains/assessment/OUTBOX_VERIFICATION_NOTES.md、
  50_开发_dev/backend/domains/assessment/tests/test_family_manage_permission.py:
  Python 迁移侧已经对"两条通过条件"做了显式的单测覆盖,可作为未来修复 E 时的验证参照
  (若要给 NestJS 侧补测试,可参照该 Python 测试的用例设计:分别覆盖 legacy 通过、tenancy
  通过、两者都不满足的拒绝路径)。
