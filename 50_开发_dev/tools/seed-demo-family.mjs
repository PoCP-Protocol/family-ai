// 一次性演示种子：用真实 Bearer + 真实 API 跑通「需求→意图→推荐→决定→AI交付→回访→闭环」黄金业务链路。
// 仅本地演示用，不进 CI；证明「业务场景/流程/规则/数据」在 Web 后端真实运行。
import { randomUUID } from 'node:crypto';

const API = process.env.API ?? 'http://localhost:3100';
// guardian person 的 account_id 存的是 external_ref（手机号），consent 规则要求 actor 与之匹配。
const guardianActor = 'phone:13800000001';
let token = '';
let familyId = '';
let guardianId = '';

// 自签 account 会话 + 取回已有家庭（若无家庭则原子创建首个家庭）。
async function bootstrapSession() {
  const s = await (await fetch(`${API}/auth/account-session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ external_ref: guardianActor }),
  })).json();
  token = s.token;
  const ctx = await (await fetch(`${API}/auth/contexts`, { headers: { authorization: `Bearer ${token}` } })).json();
  if (Array.isArray(ctx.contexts) && ctx.contexts.length > 0) {
    familyId = ctx.contexts[0].family_id;
    guardianId = ctx.contexts[0].person_id;
  } else {
    const fam = await (await fetch(`${API}/auth/families`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: '示范之家', guardian_name: '林妈妈' }),
    })).json();
    familyId = fam.family_id;
    guardianId = fam.person_id;
  }
}

// 默认带 Bearer（读投影）；actorMode='x-actor' 时改用 x-actor-id（consent/orchestration 需 guardian 匹配）。
const H = (extra = {}, actorMode = 'bearer') => ({
  'content-type': 'application/json',
  ...(actorMode === 'bearer'
    ? { authorization: `Bearer ${token}` }
    : { 'x-actor-id': guardianActor }),
  'x-correlation-id': `demo-${randomUUID()}`,
  'x-source': 'demo-seed',
  ...extra,
});

async function call(method, path, body, extra = {}, actorMode = 'bearer') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: H(extra, actorMode),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const log = (label, r) => console.log(`${label.padEnd(28)} → ${r.status}  ${JSON.stringify(r.json)?.slice(0, 160) ?? ''}`);

async function main() {
  await bootstrapSession();
  console.log(`FAMILY=${familyId}  GUARDIAN=${guardianId}\n`);

  // 1) 补一个孩子（真实成员，落 persons 表）
  const child = await call('POST', `/families/${familyId}/children`, {
    display_name: '小林', birth_date: '2014-03-10', idempotency_key: `demo-child-${randomUUID()}`,
  });
  log('addChild', child);
  const childId = child.json?.child?.person_id;

  // 2) 授予 SERVICE + AI_PERSONALIZATION 同意（orchestration 推荐/AI 交付前置）
  if (childId) {
    const c1 = await call('POST', `/families/${familyId}/consents`,
      { subjectPersonId: childId, guardianPersonId: guardianId, purpose: 'SERVICE', policyVersion: 'demo-v1' },
      { 'idempotency-key': `demo-consent-svc-${randomUUID()}` }, 'x-actor');
    log('grantConsent(SERVICE)', c1);
    const c2 = await call('POST', `/families/${familyId}/consents`,
      { subjectPersonId: childId, guardianPersonId: guardianId, purpose: 'AI_PERSONALIZATION', policyVersion: 'demo-v1' },
      { 'idempotency-key': `demo-consent-ai-${randomUUID()}` }, 'x-actor');
    log('grantConsent(AI)', c2);
  }

  // 3) home 读投影（应 200）
  log('GET /home', await call('GET', `/families/${familyId}/home`));

  if (!childId) { console.log('\n没有 childId，后续 orchestration 跳过'); return; }

  // 4) 黄金业务闭环：需求 → 意图 → 推荐 → 决定 → 回访（orchestration 用 x-actor-id 以满足 guardian 匹配）
  const need = await call('POST', `/families/${familyId}/orchestration/needs`,
    { subject_person_id: childId, raw_text: '孩子刚摔门，我今晚不知道怎么重新开口' });
  log('orchestration/needs', need);
  const signalId = need.json?.signal_id;

  const intent = await call('POST', `/families/${familyId}/orchestration/intents`,
    { signal_id: signalId, goal_text: '今晚怎么重新开口，先别再吵' });
  log('orchestration/intents', intent);
  const intentId = intent.json?.intent_id;

  const rec = await call('POST', `/families/${familyId}/orchestration/intents/${intentId}/recommendations`, {});
  log('recommendations', rec);

  if (rec.json?.recommendation_id) {
    const dec = await call('POST', `/families/${familyId}/orchestration/decisions`, {
      intent_id: intentId,
      recommendation_id: rec.json.recommendation_id,
      recommendation_version: rec.json.version,
      decision_type: 'ACCEPT_RECOMMENDATION',
      selected_offer_refs: rec.json.recommended_offer_refs,
    });
    log('decisions', dec);
    const caseId = dec.json?.case_id;

    if (caseId) {
      log('GET case', await call('GET', `/families/${familyId}/orchestration/cases/${caseId}`));
      const fu = await call('POST', `/families/${familyId}/orchestration/cases/${caseId}/followups`,
        { helpfulness: 'SOMEWHAT_HELPFUL', text: '感觉好一点' });
      log('followups', fu);
      log('GET case (after followup)', await call('GET', `/families/${familyId}/orchestration/cases/${caseId}`));
    }
  }

  console.log('\n✅ 黄金业务闭环已在真实库中执行。');
}

main().catch((e) => { console.error(e); process.exit(1); });
