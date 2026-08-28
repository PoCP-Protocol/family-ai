# Batch 2 域调研 - NestJS 现状事实(Family/Relationship/Consent/GrowthIntent/GrowthPlan/Intervention/Action/Outcome)

DOC_KIND = RESEARCH_NOTE (事实调研,非方案)
TASK_REF = FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001, Batch 2 预研
SCOPE = architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md 第8节 Batch 2
DATE = 2026-08-28
STATUS = FACT_FINDING_ONLY 不含迁移方案/设计建议,仅报告 NestJS 现状
SOURCE_ROOT = 50_开发_dev/apps/api/src/modules/family/, 50_开发_dev/database/migrations/

本文只记录 NestJS 侧代码与数据库迁移中的既成事实(方法签名、校验规则、状态机、约束),供后续
Plan 阶段单独使用。不对 Python 版本做任何设计判断。

---

## 0. 涉及的核心 service 文件清单(本次调研范围内)

- family.service.ts (2293 行): Family/Person/Relationship/LifeStage/Consent/GrowthOnboarding/Perspective/GrowthProfileDraft/GrowthProfileConfirm
- family-permission.ts (33 行): 共享权限断言(多个 service 复用)
- growth-hypothesis.service.ts (198 行): Assessment到GrowthIntent桥接(CONFIRM/DISMISS 决策)
- growth-priority.service.ts (476 行): GrowthPriority 草案与确认("GrowthIntent 生命周期"实际落地处)
- journey-plan.service.ts (455 行): 90天 JourneyPlan(GrowthPlan 对应真实实现)
- intervention.service.ts (408 行): InterventionEpisode 启动 + 7天 GrowthAction 生成
- intervention.policy.ts (55 行): Intervention 静态卡片、7天文案模板
- growth-action.service.ts (511 行): GrowthAction 今日读取/完成/执行状态机
- growth-action.policy.ts (13 行): 完成态白名单
- growth-review.service.ts (594 行): OutcomeObservation / GrowthReview / NextStepDecision / Timeline
- growth-subject.resolver.ts (182 行): 从 onboarding 唯一解析 child/guardian(多个 service 共用)
- normal-safety-route.policy.ts (40 行): "普通安全路由"断言(多个 service 共用的安全闸门)
- reflection-safety.policy.ts (36 行): 反思文本的正则安全信号扫描

关键事实: assertRequiredGrowthConsents(consent 三件套校验)在 5 个文件中逐字复制粘贴
(family.service.ts / journey-plan.service.ts / intervention.service.ts /
growth-priority.service.ts / growth-action.service.ts),每处实现完全相同,没有共享成 shared 模块。
growth-review.service.ts 里也有第 6 处相同实现(本文档统计为 6 处)。

---

## 1. Family / Relationship

### 1.1 核心方法(family.service.ts)

- createFamily(request, meta): Promise<CreateFamilyResponse>
- addParent(request, meta): Promise<AddParentResponse>
- addChild(request, meta): Promise<AddChildResponse>
- createRelationship(request, meta): Promise<CreateFamilyRelationshipResponse>
- assignLifeStage(request, meta): Promise<AssignLifeStageResponse>
- getFamilyAggregate(familyId, actorId): Promise<FamilyAggregateResponse> (委托给 FamilyAggregateRepository)

### 1.2 逐条校验链路

createFamily:
1. hashCreateFamilyRequest 对 display_name + idempotency_key 做 sha256,用于幂等重放比对。
2. lockIdempotencyKey: 向 idempotency_keys 表 insert ... on conflict do nothing,再 select ... for update;若已存在且 action_name/request_hash 不匹配当前请求 -> 409 Idempotency conflict;若已有 response_body -> 直接重放返回,不再执行后续逻辑。
3. insertFamily: insert into families(display_name), status 默认 ACTIVE。
4. 写 audit_logs(action=CreateFamily, resource_type=Family)。
5. 写 CreateFamilyEvent(FamilyCreated,走 outbox_events 或专用事件插入,见 insertCreateFamilyEvent)。
6. storeIdempotencyResponse: 把响应写回 idempotency_keys.response_body。
7. family-permission.ts 的隐含规则: 创建者身份判定依赖 audit_logs 里是否存在该 actor 对该 family 的 CreateFamily 成功审计记录,即"创建者永久拥有管理权限"这条规则完全靠审计日志回查实现,没有单独的 owner 字段。

addParent / addChild(结构几乎相同):
1. 幂等锁(同上模式)。
2. ensureFamilyExists: select family_id from families where family_id=$1 for share;不存在 -> 404 family_not_found。
3. assertFamilyManagePermission(见1.4) -> 不满足 -> 403。
4. insertParentPerson: insert into persons(family_id, person_type=PARENT, parent_role, display_name, account_id);insertChildPerson: insert into persons(family_id, person_type=CHILD, display_name, birth_date)。
   - DB 层约束 parent_role_only_for_parent: person_type=PARENT 时 parent_role 必须非空;person_type=CHILD 时必须为空。这条约束在 service 代码里没有额外校验,完全依赖数据库 CHECK 兜底。
5. 写 audit_logs(AddParent/AddChild, resource_type=Person)。
6. 写 FamilyMemberAdded 事件(insertFamilyMemberAddedEvent,带 PARENT/CHILD 标记)。
7. 存幂等响应。

createRelationship:
1. 幂等锁。
2. ensureFamilyExists。
3. assertFamilyManagePermission。
4. getRelationshipPersons: 一次查询取 person_a_id、person_b_id 两人;任一不存在 -> 404 person_not_found。
5. assertRelationshipInvariant(纯内存校验,无 DB):
   - person_a_id === person_b_id -> 400 relationship_self_link_not_allowed。
   - personA.family_id !== family_id 或 personB.family_id !== family_id -> 400 relationship_persons_must_belong_to_same_family。
   - 若 relationship_type 是 PARENT_CHILD 或 GUARDIAN_CHILD,则要求 personA.person_type=PARENT 且 personB.person_type=CHILD(方向性强制,A必须是家长,B必须是孩子);不满足 -> 400 relationship_direction_invalid。
6. assertRelationshipNotDuplicate:
   - isSymmetricRelationship(type) 判定 SPOUSE/SIBLING 为对称关系。
   - 查询: 对称关系类型下同时检查(A,B)和(B,A)两个方向是否已存在;非对称类型(PARENT_CHILD/GUARDIAN_CHILD/OTHER)只检查(A,B)方向。
   - 存在 -> 409 relationship_already_exists。
7. insertFamilyRelationship: 插入记录;捕获唯一约束冲突(23505)也转换成同一 409(双重防护:应用层查重 + DB 唯一索引兜底)。
8. 写审计 + FamilyRelationshipCreated 事件。

assignLifeStage:
1. 幂等锁 -> ensureFamilyExists -> assertFamilyManagePermission。
2. assertChildBelongsToFamily: 查 persons 表;不存在 -> 404 child_not_found;family_id 不匹配 -> 400 child_must_belong_to_family;person_type != CHILD -> 400 life_stage_subject_must_be_child。
3. getActiveLifeStageAssignment: 查当前 effective_to is null 的记录,for update(悲观锁,防并发写)。
4. assertLifeStageTemporalTransition(纯内存):
   - 若当前 active 分配的 life_stage_code 与请求相同 -> 409 life_stage_assignment_already_active。
   - 若 request.effective_from <= activeAssignment.effective_from -> 400 life_stage_effective_from_must_be_after_active_assignment(新分配必须严格晚于旧分配的生效时间)。
5. closeActiveLifeStageAssignment: 把旧记录的 effective_to 设为新记录的 effective_from(软终止,非删除)。
6. insertLifeStageAssignment: 唯一约束 uq_active_life_stage(child_id 上 WHERE effective_to IS NULL 的部分唯一索引,保证每个孩子同一时刻只有一条 active 分配)冲突 -> 409。
7. normalizeSource: 来源字符串裁剪到 64 字符,空白则回落为 api。
8. 写审计 + LifeStageAssigned 事件。

### 1.3 数据模型(对应 0001_family_identity.sql)

- families: family_id pk, display_name, status enum(ACTIVE/INACTIVE/ARCHIVED), primary_contact_person_id fk指向persons(延迟约束), version, created_at, updated_at
- persons: person_id pk, family_id fk, person_type enum(PARENT/CHILD), parent_role enum(MOTHER/FATHER/GUARDIAN/OTHER_GUARDIAN)仅PARENT非空, display_name, birth_date, account_id, created_at, updated_at - CHECK parent_role_only_for_parent
- family_relationships: relationship_id pk, family_id fk, person_a_id fk, person_b_id fk, relationship_type enum(PARENT_CHILD/SPOUSE/SIBLING/GUARDIAN_CHILD/OTHER), created_at - CHECK relationship_not_self;唯一索引 uq_relationship_directional;0004 追加对称唯一索引 uq_relationship_symmetric_pair(对 SPOUSE/SIBLING 用 LEAST/GREATEST 防反向重复)。
- life_stage_assignments: assignment_id pk, family_id fk, child_id fk, life_stage_code enum(EARLY_ADOLESCENCE_12_15,当前仅一个枚举值), effective_from, effective_to nullable, source varchar(64) default MANUAL, created_at - CHECK life_stage_time(effective_to IS NULL OR effective_to > effective_from);部分唯一索引 uq_active_life_stage(child_id) WHERE effective_to IS NULL。
- family_memberships(0018): family_id + person_id 唯一;role enum(OWNER_GUARDIAN/GUARDIAN/ADULT_MEMBER/CHILD_SUBJECT);status enum(INVITED/ACTIVE/REVOKED/LEFT)。这是 tenancy-v2 引入的新权限判定层,与 family.service.ts 内基于 audit_logs 的旧判定并存(见1.4)。

### 1.4 权限判定(family-permission.ts,被多个 service 复用)

assertFamilyManagePermission(client, familyId, actorId) - 两条通过条件之一即可,否则 403 actor_has_family_manage_permission:
1. legacy: audit_logs 中存在该 actor 对该 family 的 CreateFamily 成功审计记录(即该 actor 是该 family 的创建者)。
2. tenancy: family_memberships 中存在 family_id 匹配、person_id 匹配 actorId、status=ACTIVE、role 属于 OWNER_GUARDIAN 或 GUARDIAN 的记录。

注意: growth-review.service.ts 里有一份独立复制的 assertFamilyManagePermission,只实现了 legacy 判断(审计日志),没有走 tenancy 分支,这是 Batch 2 中发现的一处实现不一致(该文件未 import 共享的 family-permission.ts)。

---
## 2. Consent

### 2.1 核心方法(family.service.ts)

- grantConsent(request, meta): Promise<GrantConsentResponse>

没有 withdrawConsent / WithdrawConsent 端点 - 全仓库搜索无匹配。撤回逻辑只存在于
grantConsent 内部: 授予新同意前,若同一(family_id, subject_person_id, purpose)已有
status=GRANTED 的记录,会先把旧记录状态改为 EXPIRED(不是 WITHDRAWN)。
即: 当前实现里 WITHDRAWN 是一个已定义但从未被代码写入的枚举值,唯一被程序写入的终止态是
EXPIRED(发生在被新授予覆盖时)。

### 2.2 逐条校验链路(grantConsent)

1. 幂等锁。
2. ensureFamilyExists。
3. assertFamilyManagePermission。
4. getConsentPersons: 一次查询取 guardian_person_id 与 subject_person_id 对应的 person;任一不存在 -> 404 guardian_not_found / 404 subject_not_found。
5. assertActorIsGuardian(guardian, actorId)(纯内存): guardian.account_id 必须非空且等于 actorId;不满足 -> 403 actor_must_match_guardian_account。
6. assertGuardianAuthorizedForSubject:
   - guardian.family_id 或 subject.family_id 与请求 family_id 不一致 -> 400 consent_persons_must_belong_to_family。
   - guardian.person_type 不是 PARENT -> 403 guardian_not_authorized。
   - subject.person_type 不是 CHILD -> 400 consent_subject_must_be_child。
   - 查 family_relationships 表要求存在guardian到subject方向、relationship_type 属于 PARENT_CHILD 或 GUARDIAN_CHILD 的记录;不存在 -> 403 guardian_not_authorized。
7. getActiveConsent: 查当前 status=GRANTED 的记录,for update(悲观锁)。
8. assertConsentPreconditions(纯内存): 若已存在 active consent 且 policy_version 与请求相同 -> 409 consent_already_granted(同版本重复授予被拒绝;不同版本允许升级重授予)。
9. expireActiveConsent: 若存在旧 active consent,把 status 改为 EXPIRED(不设置 withdrawn_at,因为 DB 的 withdrawn_time_consistent CHECK 只约束 status=WITHDRAWN 时必须有 withdrawn_at,EXPIRED 不受此约束)。
10. insertConsent: 插入 status=GRANTED, granted_at=now();捕获唯一约束冲突(错误码23505,对应0005的部分唯一索引)转换为 409 consent_already_granted。
11. 写审计 + ConsentGranted 事件。

### 2.3 数据模型(consents 表,迁移0001加0005)

字段: consent_id 主键, family_id 外键, subject_person_id 外键, guardian_person_id 外键,
purpose 枚举类型consent_purpose,取值范围SERVICE/ASSESSMENT/AI_PERSONALIZATION/GROWTH_TRACKING/
EXPERT_SERVICE/RESEARCH/MODEL_IMPROVEMENT/CONTENT_PUBLICATION,
status 枚举类型consent_status,取值范围GRANTED/WITHDRAWN/EXPIRED,
policy_version varchar64, granted_at 时间戳, withdrawn_at 时间戳可空, created_at 时间戳。
约束withdrawn_time_consistent: status为WITHDRAWN时withdrawn_at必须非空,否则status不能是WITHDRAWN。
索引idx_consents_subject_purpose建在subject_person_id、purpose、status三列上。
部分唯一索引ux_consents_active_subject_purpose建在family_id、subject_person_id、purpose三列上,条件是status等于GRANTED(来自迁移0005)。

purpose 枚举有8个值,但 Growth 域实际只强制检查其中3个(见2.4小节);其余5个
(AI_PERSONALIZATION、EXPERT_SERVICE、RESEARCH、MODEL_IMPROVEMENT、CONTENT_PUBLICATION)
在本次调研范围内的service代码中未见任何读取或校验引用。
### 2.4 assertRequiredGrowthConsents 函数 - 逐处调用点与校验内容

函数体(6处完全相同的实现,SQL逻辑描述): 查询consents表,条件是family_id匹配、
subject_person_id匹配、purpose属于指定集合、status等于GRANTED。
固定检查的purpose集合: SERVICE、ASSESSMENT、GROWTH_TRACKING(硬编码字面量,各处一致)。
缺失任一 -> 抛出403错误,错误码为missing_required_consent加上逗号分隔的缺失purpose列表。

调用点清单(均以childId即subject.childPersonId作为subject_person_id参数):
1. family.service.ts第286行区域 - getActiveGrowthOnboarding路径内部校验链。
2. family.service.ts第320行区域 - 记录Perspective前。
3. family.service.ts第360行区域 - GrowthProfile确认前(assertGrowthProfileConfirmationPreconditions函数内)。
4. journey-plan.service.ts第111行(createPlan方法)与第154行(confirmPlan方法)。
5. intervention.service.ts第81行(startIntervention方法)。
6. growth-priority.service.ts第109行(confirmGrowthPriority方法)。
7. growth-action.service.ts第143行(completeGrowthAction方法)与第175行(transitionTaskExecution方法)。
8. growth-review.service.ts第55行(recordOutcomeObservation方法)与第83行(completeGrowthReview方法)。

即: Growth域从Onboarding到Outcome的每一个写路径,在执行任何状态变更前都会重新查一次
consent表(不是一次授权、全程复用,而是每次Named Action都独立验证)。

---

## 3. GrowthIntent / GrowthPlan

### 3.1 GrowthIntent的两条并行含义(重要事实)

调研发现代码库中GrowthIntent这个概念名对应两套互不相通的持久化实现:

(A) growth_intents表(迁移0020建表,0041追加字段) - 由growth-hypothesis.service.ts
的decide方法在Assessment域CONFIRM决策时写入。字段包括: intent_id、family_id、
subject_person_id、signal_ref(可空)、need_type、goal_text、required_capability_keys、
status枚举取值OPEN/CLOSED/CANCELLED/SUPERSEDED、close_reason、confirmed_by、confirmed_at、
source_type默认值NEED_SIGNAL、source_ref、evidence_refs数组、
boundary默认值HUMAN_CONFIRMED_INTENT_NOT_OUTCOME。
唯一索引限定在source_type等于ASSESSMENT_HYPOTHESIS且source_ref非空时生效,按
family_id加source_type加source_ref组合唯一 - 同一个hypothesis_ref只能产生一条intent
(幂等靠这条唯一索引,而不是idempotency_keys表)。
这张表在Batch 1(Assessment域)已调研过,本次未见任何后续生命周期管理service,即
status字段目前只在插入时写死为OPEN,没有任何代码把它转换到CLOSED、CANCELLED或
SUPERSEDED - 是一张只有写入路径、没有状态机推进逻辑的表。
decide方法内部的确认逻辑:
先查是否已存在对应家庭、来源类型为ASSESSMENT_HYPOTHESIS、来源引用等于hypothesis_ref
的记录(幂等读取,加行锁);存在则直接复用,不重复插入。
不存在则插入新intent,goal_text取自Assessment侧的need_type描述文本,
required_capability_keys直接抄自family_need_types表的required_capability_keys字段。

(B) growth_priorities表(迁移0003建表,0008大改) - 由growth-priority.service.ts
的confirmGrowthPriority方法写入,这是家长在Onboarding之后确认一个成长优先方向的Named
Action,是Wave2也就是GOLDEN_GROWTH_LOOP里真正驱动后续Intervention和JourneyPlan的表。
这是本次调研认定的GrowthIntent生命周期在Growth域主链路里的真实落地对象(迁移计划第8
节把GrowthIntent和GrowthPlan分列,但实现上growth_priorities同时承担确认后的成长意图
职能,growth_intents表反而是Assessment域侧的独立产物,两者之间没有外键或代码路径互相
引用)。

### 3.2 GrowthPriority确认流程(confirmGrowthPriority方法)逐条校验

1. ensureFamilyExists、assertFamilyManagePermission、幂等锁(哈希覆盖family_id、onboarding_id、draft_id、decision、actor_id)。
2. assertActiveOnboarding: growth_journeys表要求journey_id等于onboarding_id、journey_type等于PARENT_CHILD_COMMUNICATION_CONFLICT、phase等于ONBOARDING、status等于ACTIVE;不满足则返回404错误active_growth_onboarding_not_found。
3. assertNormalSafetyRoute(见第7节安全闸门)。
4. assertNoActiveInterventionEpisode: 查intervention_episodes表该onboarding下是否有status等于ACTIVE的记录;存在则返回409错误active_intervention_episode_exists(有活跃干预时不能改变优先级)。
5. listConfirmedProfiles加buildGrowthPriorityDraft(定义在growth-priority.policy.ts,本次未深入但引用)重新计算候选草案。
6. draft.draft_id与request.draft_id不一致则返回409错误growth_priority_draft_stale(草案必须是最新的,防止基于过期证据确认)。
7. assertDecisionMatchesDraft函数校验draft与request.decision是否匹配,抛错转换为409。
8. 若decision不是NO_PRIORITY_YET: candidate.dimension_id与request.decision不一致则返回409错误growth_priority_decision_not_eligible。
9. GrowthSubjectResolver的resolve方法(见第7节)解析出唯一child。
10. assertRequiredGrowthConsents(见2.4小节)。
11. 若有candidate: supersedeActivePriority把旧ACTIVE改为SUPERSEDED并记录superseded_at为当前时间,再insertPriority插入新记录,version等于前一条的version加1,previous_priority_id链接到被取代的记录,形成版本链。
12. 写审计加GrowthPriorityConfirmed事件。

### 3.3 growth_priorities表结构与约束(迁移0003加0008累积)

字段: priority_id主键、family_id外键、profile_id外键指向growth_profiles、
dimension_id限定取值范围为P03、R03、R04、R05四个之一、
rank字段有约束要求rank等于1或者status等于SUPERSEDED,另有约束要求status不等于ACTIVE或者rank等于1、
confirmed_by_actor_id、confirmed_at、
onboarding_id外键指向growth_journeys(数据库列可空但业务上必填)、
status限定取值ACTIVE或SUPERSEDED默认ACTIVE、
version要求大于等于1、
boundary要求固定等于PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS这个字符串、
reason_codes、evidence_refs、policy_version、
superseded_at可空、previous_priority_id是自引用外键。
唯一索引限定family_id加onboarding_id组合在status等于ACTIVE时唯一。
即: 每个onboarding在任意时刻只能有一条ACTIVE状态的priority(部分唯一索引强制),历史版本通过
previous_priority_id自引用链串起来,从不物理删除或覆盖。

### 3.4 GrowthPlan对应journey-plan.service.ts文件(90天计划)

方法清单:
getActiveProjection方法接收familyId和actorId返回投影;
createPlan方法接收request和meta创建计划;
confirmPlan方法确认计划;
pausePlan方法暂停计划;
reviewCurrentPhase方法评审当前阶段。

计划状态机(family_journey_plans表的status字段):
DRAFT到ACTIVE(PAUSED状态没有直接转回ACTIVE的代码路径,PAUSED只能停留),或者ACTIVE到COMPLETED。
数据库约束要求: status等于DRAFT时confirmed_at和confirmed_by_actor_id都必须为空;
其余状态时两者都必须非空(即一旦confirm就不可逆地记录确认人和确认时间)。

阶段状态机(family_journey_plan_phases表的status字段):
PENDING到ACTIVE到REVIEW_DUE到COMPLETED,或者ACTIVE到REVIEW_DUE到BLOCKED(当
reviewCurrentPhase方法收到的decision不是CONTINUE时)。四个阶段固定为:
SEE阶段(第1到14天,评审到期日为14),
PARENT_FIRST阶段(第15到35天,评审到期日为35),
CO_CREATE阶段(第36到60天,评审到期日为60),
STABILIZE阶段(第61到90天,评审到期日为90)。
这些定义写在代码常量PHASE_DEFINITIONS里,不是数据库驱动的。

createPlan方法逐条校验:
1. ensureFamilyExists、assertFamilyManagePermission、幂等锁。
2. assertActiveOnboardingAndPriority: 联表查询growth_priorities和growth_journeys,要求
priority_id状态为ACTIVE,且对应onboarding的journey_type等于PARENT_CHILD_COMMUNICATION_CONFLICT、
phase等于ONBOARDING、status等于ACTIVE;不满足则返回404错误active_growth_priority_not_found。
3. GrowthSubjectResolver的resolve方法解析child。
4. assertRequiredGrowthConsents。
5. assertNormalSafetyRoute。
6. getCurrentPlanForUpdate: 若该onboarding已有DRAFT、ACTIVE或PAUSED状态的计划,直接返回
现有计划,created标记为false(不报错,视为幂等式的已存在则复用,而不是冲突)。数据库唯一索引
是这条业务规则的兜底。
7. 若无现有计划: 插入family_journey_plans记录,初始状态DRAFT,当前阶段SEE,当前天数1,
总天数90,随后insertPhases函数插入4条phase记录,每个phase的focus_dimensions按阶段规则决定
(SEE和STABILIZE阶段用当前priority的维度;PARENT_FIRST阶段固定为P03和R03两个维度;
CO_CREATE阶段固定为R04和R05两个维度)。
8. 写审计加JourneyPlanCreated事件。

confirmPlan方法逐条校验:
1. 幂等锁,然后getPlanForUpdate加行锁读取。
2. plan.status不是DRAFT则返回409错误journey_plan_not_draft。
3. assertNormalSafetyRoute,然后GrowthSubjectResolver的resolve方法,然后assertRequiredGrowthConsents。
4. 更新plan状态为ACTIVE,写入confirmed_by_actor_id和confirmed_at,version加1。
5. 把phase等于SEE的记录置为ACTIVE,其余phase保持或置为PENDING。
6. createJourneyPlanActions函数: 若该plan尚无growth_actions记录(幂等检查数量为0),
批量插入90条(每天一条)growth_actions记录,action_type固定为JOURNEY_90_DAY_PRACTICE,
assignment_text按当天所属phase从固定模板数组PHASE_ACTION_TEMPLATES里循环取
(每个phase有4条模板文案,按天序号减1再对4取余的方式轮换)。

pausePlan方法逐条校验: plan.status不是ACTIVE则返回409错误journey_plan_not_active;
否则置为PAUSED状态,记录paused_at,version加1。(没有resume恢复方法。)

reviewCurrentPhase方法逐条校验:
1. plan.status不是ACTIVE则返回409错误journey_plan_not_active。
2. 当前phase状态必须是REVIEW_DUE,否则返回409错误journey_phase_review_not_due。
3. decision等于CONTINUE时: 当前phase转为COMPLETED;若有下一个phase,下一个phase转为ACTIVE,
plan的current_phase和current_day前移到下一phase的start_day;若已是最后一个phase即STABILIZE,
plan整体转为COMPLETED,current_day设为90。
4. decision不等于CONTINUE(即ADJUST或其他值)时: 当前phase转为BLOCKED,plan转为PAUSED。
注意: 这里没有对request.decision的枚举值做白名单校验(合约类型层面靠TypeScript类型约束,
但SQL分支只区分CONTINUE和其它一切值)。

refreshJourneyPlanExecution函数(被growth-action.service.ts的completeGrowthAction方法调用):
完成一个journey action后,若该action的day_index大于等于该phase的review_due_day,把phase
状态从ACTIVE推进到REVIEW_DUE(这是唯一把phase推进到REVIEW_DUE的代码路径,触发点是
某天的日常动作被打卡,不是定时任务)。

---
## 4. Intervention

### 4.1 核心方法(intervention.service.ts)

getInterventionCard方法接收familyId和actorId,返回静态卡片(内容硬编码在intervention.policy.ts里)。
getActiveIntervention方法接收familyId、onboardingId、actorId,返回当前活跃的intervention或null。
startIntervention方法接收request和meta,启动一次干预。

没有completeIntervention或cancelIntervention方法 - intervention_episodes表的status字段枚举定义
了ACTIVE、COMPLETED、CANCELLED三态(数据库CHECK约束),但本次调研范围内没有任何代码把status从
ACTIVE转换到COMPLETED或CANCELLED。episode的结束是通过growth-review.service.ts里的
completeGrowthReview方法间接判定完成条件(见第5节),但那只写growth_reviews表,不回写
intervention_episodes.status字段。这是一处状态机不完整的事实(episode永远停留在ACTIVE状态)。

### 4.2 startIntervention方法逐条校验

1. ensureFamilyExists、assertFamilyManagePermission、幂等锁(哈希内容包含family_id、onboarding_id、priority_id、intervention_code、actor_id)。
2. getActivePriorityForStart函数:
   - 若request.intervention_code不等于常量INTERVENTION_CODE(值为LISTEN_BEFORE_RESPOND),返回409错误intervention_code_not_supported(当前唯一支持的intervention_code硬编码为字面量比较,DTO层的start-intervention.dto.ts也把该字段的合法值锁定为字面量LISTEN_BEFORE_RESPOND,双重锁死)。
   - 联表查询growth_priorities和growth_profiles: 要求priority_id状态为ACTIVE,dimension_id等于R03(硬编码只支持R03一个维度,也就是说P03、R04、R05的priority无法启动这个intervention),且对应profile的status等于WORKING并且confirmed_at非空;不满足则返回404错误active_growth_priority_not_found。
3. GrowthSubjectResolver的resolve方法,然后assertRequiredGrowthConsents。
4. assertNormalSafetyRoute。
5. assertNoActiveInterventionEpisode: 同一family加onboarding组合已有status等于ACTIVE的episode,返回409错误active_intervention_episode_exists(数据库唯一索引兜底)。
6. insertInterventionEpisode: intervention_id固定为字符串INTERVENTION-001(常量),intervention_code固定为LISTEN_BEFORE_RESPOND(常量),planned_days固定为7(常量),policy_version固定为M2_105_DETERMINISTIC_V1(常量)。
7. buildGrowthActionAssignments函数接收startedAt: 从intervention.policy.ts里的LISTEN_BEFORE_RESPOND_ASSIGNMENTS固定7条中文文案数组,按天序号1到7生成到期日等于开始日加(天序号减1)天(按UTC日历天计算)。
8. insertGrowthActions函数: 批量插入7条growth_actions记录,action_type固定为LISTEN_BEFORE_RESPOND_DAILY_ACTION,关联intervention_episode_id字段。
9. 写审计加InterventionStarted事件。

### 4.3 intervention_episodes表结构(迁移0020)

字段: episode_id主键、family_id外键、onboarding_id外键指向growth_journeys、priority_id外键指向growth_priorities、
intervention_id外键指向interventions表(该表当前仅有INTERVENTION-001这一行数据)、
intervention_code要求固定等于字符串LISTEN_BEFORE_RESPOND、
status限定取值ACTIVE、COMPLETED、CANCELLED三者之一,默认ACTIVE、
started_by_actor_id、started_at、
planned_days要求固定等于7、
policy_version。
唯一索引限定family_id加onboarding_id组合在status等于ACTIVE时唯一。
interventions表当前只有一行种子数据(迁移0020里用插入并在冲突时更新的方式写入),即
整个平台目前只定义了一种intervention。

---
## 5. Action / Outcome

### 5.1 GrowthAction核心方法(growth-action.service.ts)

getTodayAction方法接收familyId和actorId,返回今日待办action或null。
listTodayActions方法(用于UI-01,最多返回3条),返回今日相关的所有actions。
listCompletedJourneyActions方法(最多返回12条),返回已完成的journey actions。
completeGrowthAction方法接收request和meta,完成一次打卡。
transitionTaskExecution方法接收已验证的request和meta,转换执行状态。

### 5.2 GrowthAction的双重状态机

第一层状态机(status字段和completion_status字段,业务终态,一旦写入不可逆):
PENDING状态转到COMPLETED、PARTIAL或NOT_COMPLETED三者之一(一次性转换,getCompletableGrowthAction函数用
行锁锁定并要求当前status必须是PENDING,否则返回409错误growth_action_already_checked_in)。

第二层状态机(execution_status字段,迁移0042引入的更细粒度交互态,允许中间态往返):
NOT_STARTED状态收到START动作转为IN_PROGRESS,IN_PROGRESS状态收到PAUSE动作转为PAUSED,
PAUSED状态收到RESUME动作转回IN_PROGRESS。
NOT_STARTED、IN_PROGRESS、PAUSED三个状态都可以收到CANCEL动作转为CANCELLED。
COMPLETED、PARTIAL、NOT_COMPLETED、CANCELLED四个状态都是终态,不允许任何转换。
assertExecutionTransition函数用一个映射表精确定义了每个当前状态允许的下一步动作集合;
不在集合内则返回409错误task_transition_not_allowed加上当前状态和请求动作。CANCEL转换会
同时把status字段置为NOT_COMPLETED(这是唯一一处execution_status变更连带影响status的分支)。

### 5.3 completeGrowthAction方法逐条校验

1. assertCompletableGrowthActionStatus函数(定义在growth-action.policy.ts): completion_status
必须在COMPLETED、PARTIAL、NOT_COMPLETED三者白名单内,否则抛出普通Error(不是NestJS的
HTTPException,这是本次调研发现的一处不一致,其余校验都用BadRequestException等专用异常类型)。
2. 幂等锁、ensureFamilyExists、assertFamilyManagePermission。
3. getCompletableGrowthAction函数: 联查intervention_episodes和family_journey_plans两张表,
要求归属的episode或plan处于ACTIVE状态;action不存在返回404错误growth_action_not_found;
status不等于PENDING返回409错误growth_action_already_checked_in。
4. GrowthSubjectResolver的resolve方法,然后assertRequiredGrowthConsents,然后assertNormalSafetyRoute。
5. assertReflectionSafetyRoute函数接收request.reflection(见第7节reflection安全扫描): 若反思
文本触发任一敏感信号正则,返回403错误reflection_requires_safety_support。
6. updateGrowthActionCompletion函数: status字段和completion_status字段写入同一个值,
execution_status字段同步设为同一值,reflection_boundary字段固定写入字符串
REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME。
7. refreshJourneyPlanExecution函数(仅当journey_plan_id字段非空时生效,见第3.4节末尾)。
8. 写审计加GrowthActionCompleted事件。

### 5.4 growth_actions表结构(迁移0003累积0008、0020、0035、0036、0042)

关键字段: action_id、family_id、journey_id(M1时期遗留的旧字段)、intervention_id、
dimension_id、action_type、instruction、
status限定取值ASSIGNED、PENDING、COMPLETED、PARTIAL、NOT_COMPLETED,
onboarding_id、priority_id、intervention_episode_id、
day_index限定范围1到90(随迁移0036从原来的1到7放宽)、
assignment_text、due_date、completion_status、
reflection、reflection_boundary(限定等于REFLECTION_IS_RAW_MATERIAL_NOT_OUTCOME或者为空)、
boundary(限定等于ACTION_IS_NOT_OUTCOME)、
journey_plan_id、
journey_phase限定取值SEE、PARENT_FIRST、CO_CREATE、STABILIZE之一或者为空、
execution_status限定取值NOT_STARTED、IN_PROGRESS、PAUSED、COMPLETED、PARTIAL、
NOT_COMPLETED、CANCELLED之一、
started_at、paused_at、cancelled_at、
row_version要求大于0。
唯一索引: intervention_episode_id加day_index组合在两者都非空时唯一;
journey_plan_id加day_index组合在两者都非空时唯一(同一个episode或plan下每天只能有一条action)。
另有约束要求journey_plan_id和journey_phase必须同时为空或者同时非空(配对约束)。

### 5.5 Outcome对应growth-review.service.ts

方法清单:
recordOutcomeObservation方法记录一次观察;
completeGrowthReview方法完成一次评审;
recordNextStepDecision方法记录下一步决策;
getTimeline方法返回时间线。

recordOutcomeObservation方法逐条校验:
1. 幂等锁、ensureFamilyExists、assertFamilyManagePermission(本文件里的独立实现,只走
legacy审计日志判定,见第1.4节的不一致提示)。
2. getEpisode函数: 联查intervention_episodes和growth_priorities取出dimension_id;
不存在返回404错误intervention_episode_not_found。
3. GrowthSubjectResolver的resolve方法,然后assertRequiredGrowthConsents,然后assertNormalSafetyRoute。
4. assertObservationSubject函数: 若request.subject_person_id不等于解析出的childPersonId,
返回409错误observation_subject_mismatch(观察对象必须是resolver解析出的唯一孩子)。
5. assertObservationObserver函数: 查persons表的person_type字段;
当perspective_type等于PARENT_OBSERVATION时要求observer的person_type是PARENT且在
guardianPersonIds列表内,否则返回409错误parent_observation_observer_mismatch;
当perspective_type等于CHILD_OBSERVATION时要求observer的person_type是CHILD且
observer_person_id等于subject_person_id(孩子只能观察自己),否则返回409错误
child_observation_observer_mismatch。
6. insertOutcomeObservation函数: boundary字段固定为OBSERVATION_IS_NOT_FACT_OR_CAUSAL_EFFECT
(数据库CHECK兜底),observation_text字段长度受数据库CHECK限制在1到2000字符之间。
7. 写审计加OutcomeObservationRecorded事件。

completeGrowthReview方法逐条校验:
1. 幂等锁、ensureFamilyExists、assertFamilyManagePermission。
2. getEpisode函数,然后GrowthSubjectResolver的resolve方法,然后assertRequiredGrowthConsents,
然后assertNormalSafetyRoute。
3. assertReviewNotCompleted函数: growth_reviews表按intervention_episode_id唯一
(数据库唯一索引兜底),已存在则返回409错误growth_review_already_completed。
4. listEpisodeActionStatuses函数取该episode下所有growth_actions记录的status和completion_status字段。
5. assertReviewEligible函数:
判定条件一是actions数量等于7并且每一条的status都不是PENDING(7条全部已打卡);
判定条件二是开始时间加7天计划天数已经到期(相对当前时间)。
两个条件都不满足才返回409错误growth_review_not_eligible(即允许提前全部打卡完成,或者7天
到期后不管打卡与否两种情况下完成review,不要求两个条件同时满足)。
6. buildActionSummary函数: total_actions固定为7,completed、partial、not_completed分别按
completion_status分类计数,missing等于7减去已打卡数量。
7. buildReviewLimitations函数(纯规则推导,无AI):
missing大于0则加入MISSING_CHECK_INS;
observations数组为空则加入NO_OUTCOME_OBSERVATION;
只有家长观察没有孩子观察则加入PARENT_OBSERVATION_ONLY;反之只有孩子观察没有家长观察则加入
CHILD_OBSERVATION_ONLY;两者都有则加入PARENT_CHILD_DIVERGENCE(这三个判断分支互斥,集合去重,
不会同时出现矛盾的标记)。
8. insertGrowthReview函数: status字段固定写入COMPLETED(数据库CHECK只允许这一个值,
意味着这张表事实上没有未完成的中间态,一插入即终态)。
9. 写审计加GrowthReviewCompleted事件。

recordNextStepDecision方法逐条校验:
1. 幂等锁、ensureFamilyExists、assertFamilyManagePermission。
2. getReview函数: review不存在返回404错误growth_review_not_found。
3. assertDecisionNotRecorded函数: next_step_decisions表按review_id唯一(数据库唯一索引兜底),
已存在则返回409错误next_step_decision_already_recorded。
4. insertNextStepDecision函数: decision字段受数据库CHECK限定只能取CONTINUE、ADJUST、PAUSE、
REVIEW_REQUIRED四者之一;rationale字段可空,数据库CHECK限制长度不超过2000字符。
注意: 这个决策记录写入后不会触发任何下游状态变更(不会推进JourneyPlan的phase,不会关闭
intervention episode),是一张纯记录表,其decision字段的业务含义目前只是被Timeline展示,
没有被任何service读取消费。
5. 写审计加NextStepDecisionRecorded事件。

getTimeline方法: 五个子查询联合(INTERVENTION_STARTED事件、GROWTH_ACTION_COMPLETED事件即
仅取completion_status非空的动作、OUTCOME_OBSERVATION_RECORDED事件、GROWTH_REVIEW_COMPLETED
事件、NEXT_STEP_DECISION_RECORDED事件),按发生时间和事件类型排序合并,boundary字段固定标注
TIMELINE_IS_PROVENANCE_NOT_SCORE_OR_RANKING。这是唯一一个跨5张表聚合读取的只读投影方法。

### 5.6 outcome_observations、growth_reviews、next_step_decisions三张表结构(迁移0009)

outcome_observations表字段: observation_id主键、family_id外键、subject_person_id外键、
observer_person_id外键、intervention_episode_id外键、
perspective_type限定PARENT_OBSERVATION或CHILD_OBSERVATION、
observation_text长度限定1到2000字符、
action_refs、reflection_refs、evidence_refs、limitations四个jsonb字段、
observed_at、boundary固定等于OBSERVATION_IS_NOT_FACT_OR_CAUSAL_EFFECT、policy_version。

growth_reviews表字段: review_id主键、family_id外键、onboarding_id外键、
intervention_episode_id外键且唯一、priority_id外键、
dimension_id限定P03、R03、R04、R05之一、
status固定只能等于COMPLETED、
action_summary、observation_ids、limitations三个jsonb字段、
boundary固定等于REVIEW_IS_NOT_PROFILE_MUTATION_OR_DIAGNOSIS、policy_version、
completed_by_actor_id、completed_at。

next_step_decisions表字段: decision_id主键、family_id外键、review_id外键且唯一、
intervention_episode_id外键、
decision限定CONTINUE、ADJUST、PAUSE、REVIEW_REQUIRED之一、
rationale长度不超过2000字符、
boundary固定等于NEXT_STEP_DECISION_IS_NOT_NEXT_ACTION、policy_version、
decided_by_actor_id、decided_at。

---
## 6. GrowthHypothesis到GrowthIntent桥接(Assessment域与本Batch的接口面)

growth-hypothesis.service.ts属于Batch 1(Assessment域)已调研范围,但因为它是唯一写入
growth_intents表的代码路径,本次为Batch 2交叉记录其关键校验:
1. decide方法入参校验: idempotency_key必填,assessment_session_id必须是合法UUID,
hypothesis_ref非空,decision_type必须是CONFIRM或DISMISS二者之一。
2. 使用Postgres咨询锁(pg_advisory_xact_lock函数,锁键由tenantId、familyId、hypothesisRef
三者拼接哈希而来): 这是全仓库唯一一处用Postgres咨询锁而非行锁做并发控制的地方,
锁粒度是tenant加family加hypothesis三元组。
3. 幂等读: 查family_growth_hypothesis_decisions表,按tenant_id、family_id、decision_type、
idempotency_key四者组合查找;若request_hash不匹配则返回409错误idempotency_key_payload_mismatch。
4. assertScope函数: tenant_family_bindings表要求status等于ACTIVE且当前时间落在
effective_from到effective_to区间内,否则返回403错误tenant_family_scope_denied;随后调用
assertFamilyManagePermission(复用共享版本)。
5. assertAssessmentConsent函数: 单独查consents表,条件是purpose等于ASSESSMENT且
status等于GRANTED(注意这里只检查ASSESSMENT一个purpose,不是assertRequiredGrowthConsents
的三件套,是本次调研发现的第二处consent校验口径不一致)。
6. CONFIRM分支: 先查是否已有对应家庭、来源类型ASSESSMENT_HYPOTHESIS、来源引用等于
hypothesis_ref的intent记录(加行锁),存在则复用;不存在才插入新intent。
7. DISMISS分支: intent保持为空,receipt的outcome字段设为NO_ACTION(不创建任何记录,
只写审计和outbox事件)。

---

## 7. 跨域共享的安全和一致性闸门

### 7.1 GrowthSubjectResolver的resolve方法(被growth-priority、intervention、journey-plan、
growth-action、growth-review五个service共用)

逐条校验:
1. assertCanonicalOnboarding函数: growth_journeys表要求journey_type等于
PARENT_CHILD_COMMUNICATION_CONFLICT、phase等于ONBOARDING、status等于ACTIVE;不满足则
返回404错误active_growth_onboarding_not_found。
2. getProfileContext函数(仅当传入profileId或priorityId时触发): 若priorityId存在,联查
growth_priorities和growth_profiles取出profile;若只有profileId,直接查growth_profiles;
查不到则返回404错误growth_priority_not_found或者growth_profile_not_found。
3. 从growth_events表(GrowthOnboardingStarted事件)加perspectives表两个来源收集child候选
集合: 事件payload里的child_id字段,以及类型为CHILD_PERSPECTIVE且subject是CHILD的
perspective记录的subject_person_id字段。
4. 若候选集合大小不等于1: 大小为0返回409错误growth_subject_unresolved,大小大于1返回
409错误growth_subject_ambiguous(多孩家庭如果provenance数据不干净会在这里报错,不会静默
选第一个孩子,这是wave2端到端测试E2E-W2-08专门验证的行为)。
5. 校验解析出的person确实是person_type等于CHILD,否则返回409错误growth_subject_is_not_child。
6. 从family_relationships表查该孩子所有PARENT_CHILD或GUARDIAN_CHILD方向的监护人集合;
为空则返回409错误growth_subject_guardian_unresolved;事件里记录的guardian不在这个集合里
则返回409错误growth_subject_guardian_mismatch。
7. 若有profile上下文: assertProfileBelongsToOnboarding函数(联查evidence_records和
perspectives校验profile的证据链确实来自该onboarding);profile的subject_relationship_id
若存在必须能在上一步查到的relationship集合中找到对应记录,否则返回409错误
growth_profile_relationship_mismatch或者growth_profile_subject_mismatch。

### 7.2 assertNormalSafetyRoute函数(被growth-priority、intervention、journey-plan、
growth-action、growth-review共用)

1. 查growth_events表里最新一条GrowthOnboardingStarted事件的payload中的
safety_disposition.severity和safety_disposition.disposition两个字段;必须严格是
severity等于LOW并且disposition等于NORMAL,否则返回403错误normal_safety_route_not_verified
(onboarding起点的安全评估结果必须正常才能进入Growth主链路)。
2. 额外查该onboarding下所有perspectives记录: 若任何一条的safety_disposition为空对象或者
disposition不等于NORMAL或者severity不等于LOW,同样返回403错误(任何一次后续perspective
记录出现异常安全信号,都会永久阻断该onboarding的后续Growth写操作,不是一次性判定)。

### 7.3 assertReflectionSafetyRoute函数和assessReflectionSafety函数(定义在
reflection-safety.policy.ts)

正则扫描(大小写不敏感)5类信号: SELF_HARM对应自杀自伤类关键词,HARM_TO_OTHERS对应伤害
他人,ABUSE对应虐待性侵,VIOLENCE对应家暴持刀,SEVERE_CRISIS对应活不下去或立即报警。
命中任一信号则交给assessStructuredSafetySignals函数(定义在safety-assessment.policy.ts,
Batch 1已调研过的共享函数)计算disposition;disposition不等于NORMAL则返回403错误
reflection_requires_safety_support。这是纯规则和正则匹配,不调用任何AI模型。

---

## 8. HTTP契约层(DTO校验,逐个字段级规则示例)

四个抽样DTO文件的共同模式: 手写字段白名单(用Set集合定义允许的字段名,多一个字段就整体
返回400错误Invalid schema,不是忽略未知字段)加正则校验UUID格式(要求是UUID版本1到5,
variant限定为8、9、a、b这几个字符)。

create-family-relationship.dto.ts: 白名单只有person_a_id、person_b_id、relationship_type、
idempotency_key四个字段;relationship_type必须在5个枚举值内;idempotency_key长度限定
1到128字符。

grant-consent.dto.ts: 字段用驼峰命名法(subjectPersonId、guardianPersonId、purpose、
policyVersion,与其余多数DTO的下划线命名风格不一致,这是HTTP body字段命名风格在本模块
内不统一的事实);purpose必须在8个枚举值内;policyVersion长度限定1到64字符。

start-intervention.dto.ts: 白名单仅有priority_id和intervention_code两个字段;
intervention_code只接受字面量字符串LISTEN_BEFORE_RESPOND(不是枚举集合校验,是严格等号比较)。

complete-growth-action.dto.ts: 白名单有completion_status、reflection、occurred_at三个字段;
reflection字段校验用trim后长度大于2000才报错(即允许空字符串,只限制上限,数据库层反而对
outcome_observations表的observation_text字段要求下限为1,这两处对反思观察文本是否可为空
的下限要求不一致);occurred_at字段用日期解析函数校验是否为合法日期字符串。

---

## 9. 总结(供规模评估参考,仅事实,不含设计建议)

本次调研覆盖Batch 2全部8个域名义分组(Family、Relationship、Consent、GrowthIntent、
GrowthPlan、Intervention、Action、Outcome),实际对应13个service、policy、resolver源文件
(合计约4650行TypeScript)加约15个数据库迁移文件中的表结构变更(迁移编号0001、0003、0004、
0005、0008、0009、0018、0020、0035、0036、0041、0042等)。

复杂度量级(按方法数和独立校验规则数粗略计数,逐条列出的规则数不含DTO字段级校验):

Family和Relationship(family.service.ts的4个核心方法加family-permission.ts): 4个Named
Action方法,约20条业务规则(含3处唯一约束兜底、1处方向性关系强制、1处对称非对称关系去重
逻辑)。

Consent: 1个Named Action方法(grantConsent,没有withdraw方法),约10条规则,外加6处重复
实现的assertRequiredGrowthConsents函数(三个purpose硬编码)分布在其余全部域的写路径入口,
是跨域复用度最高但耦合方式最脆弱(复制粘贴而非共享模块)的一条规则。

GrowthIntent和GrowthPlan: growth_intents表(Assessment侧写入,无生命周期推进代码)与
growth_priorities表(Growth主链路的真实确认意图载体,含版本链)两套并行实现;
journey-plan.service.ts共5个方法、约15条规则,含4阶段硬编码状态机和90天action批量生成逻辑。

Intervention: 3个方法(1个只读卡片、1个只读查询、1个写方法),约8条规则,但
intervention_episodes表的status状态机不完整(没有COMPLETED或CANCELLED的转换代码路径),
当前平台仅支持1种intervention(LISTEN_BEFORE_RESPOND,硬编码贯穿DTO、service、policy、
数据库CHECK四层)。

Action: growth-action.service.ts共5个方法,双重状态机(status和completion_status终态
不可逆,加execution_status的5态转换表),约12条规则。

Outcome: growth-review.service.ts共4个方法,约18条规则,含5表联合的Timeline只读投影和
7天到期或全部打卡二择一的复合完成条件判定。

跨域共享的三个安全和一致性闸门(GrowthSubjectResolver、assertNormalSafetyRoute、
assertReflectionSafetyRoute)本身即构成约15条独立校验规则,且被6个以上写路径复用,是
Python移植时唯一一次实现多处复用做得对的部分(其余共享逻辑多为复制粘贴)。

粗略总量: 约25个Named Action或只读投影方法,90条以上可独立列出的校验或状态机规则,
15张核心表(外加若干枚举类型和部分唯一索引),6处逐字复制的consent校验函数,2处
assertFamilyManagePermission实现不一致,1处状态机不完整(intervention episode没有终止
路径),2处consent校验口径不一致(三个purpose套餐对比单一ASSESSMENT purpose)。相较Batch 1
(Assessment域,单一service文件、约10个方法量级),Batch 2的方法总数和跨文件重复逻辑规模
明显更大,主要复杂度不在单个方法内部,而在于以下三点: 第一,6处重复的consent校验函数需要
先合并成单一事实源才能可靠移植;第二,GrowthIntent概念存在两套互不关联的持久化实现,
移植前必须先在Plan阶段明确Python侧只保留哪一套语义;第三,3个跨域共享闸门(Subject
Resolver、Safety Route、Reflection Safety)在各service方法内被调用的先后顺序和前置行锁
的粒度范围不完全一致,移植时需要逐方法核对而非假设统一模式。
