/**
 * FAMILY-GROWTH-VERTICAL-SLICE-001 · 需求分类(确定性,可检视规则;无 ML/无 embeddings/无 LLM)。
 * V1 支持两类:PARENT_CHILD_COMMUNICATION_CONFLICT(可走完整编排:资源候选/推荐/资格判定)、
 * CHILD_ACADEMIC_SUPPORT_NEED(G1-A范围:仅信号识别,orchestration.service.ts 的 confirmIntent
 * 硬闸门仍会拒绝——资源候选/推荐/资格判定未接入,属 G1_B_PLUS 待下一个 Sprint 授权)。
 * 未知需求不臆造类别,返回 null(走安全 unsupported/NO_ACTION)。绝不诊断/贴标签。
 */
import type { GrowthCapabilityKey, GrowthNeedType } from '@family/contracts';

export interface NeedClassification {
  need_type: GrowthNeedType | null;   // null=当前纵切不支持(不臆造)
  required_capability_keys: GrowthCapabilityKey[];
  confidence: number;                 // 0..1(确定性规则命中数的粗粒度映射,非概率模型)
}

// 亲子沟通冲突的确定性触发词(冲突/情绪 + 沟通/开口 语义)。仅用于路由,不作诊断。
const CONFLICT_TERMS = ['吵', '冲突', '摔门', '争', '发脾气', '闹', '不理', '沉默', '顶嘴', '生气', '吼'];
const REOPEN_TERMS = ['重新开口', '怎么说', '沟通', '开口', '聊', '谈', '说话', '和好', '缓和'];

// 学业支持需求的确定性触发词(作业/学习动力/专注 语义)。仅用于路由,不作诊断;
// 与 family-model 题库的 need_refs(CHILD_LEARNING_SUPPORT_NEED 等)是两套独立命名,此处不复用。
const ACADEMIC_TERMS = ['作业', '写作业', '拖延', '不想学', '注意力', '走神', '磨蹭', '学习动力', '厌学', '不爱学习', '开小差'];

function hits(text: string, terms: readonly string[]): number {
  let n = 0;
  for (const t of terms) if (text.includes(t)) n += 1;
  return n;
}

/**
 * 分类家长自述文本。
 * 优先级(冲突词命中优先,不武断二选一——避免弱化已上线的安全相关分类):
 *   冲突/重开口词命中(无论学业词是否命中) → PARENT_CHILD_COMMUNICATION_CONFLICT；
 *   仅学业词命中 → CHILD_ACADEMIC_SUPPORT_NEED；
 *   均不命中 → null。
 */
export function classifyNeed(rawText: string): NeedClassification {
  const text = (rawText ?? '').trim();
  const conflict = hits(text, CONFLICT_TERMS);
  const reopen = hits(text, REOPEN_TERMS);
  const academic = hits(text, ACADEMIC_TERMS);

  if (conflict > 0 || reopen > 0) {
    // 冲突信号 → 需要先降温(DE_ESCALATION);有"重新开口/沟通"意图 → 需要重启对话(COMMUNICATION_REOPENING)。
    const caps: GrowthCapabilityKey[] = [];
    if (conflict > 0) caps.push('DE_ESCALATION');
    if (reopen > 0 || conflict > 0) caps.push('COMMUNICATION_REOPENING');
    const uniqueCaps = Array.from(new Set(caps));
    const confidence = Math.min(1, (conflict + reopen) / 4);
    return { need_type: 'PARENT_CHILD_COMMUNICATION_CONFLICT', required_capability_keys: uniqueCaps, confidence };
  }

  if (academic > 0) {
    const confidence = Math.min(1, academic / 4);
    return { need_type: 'CHILD_ACADEMIC_SUPPORT_NEED', required_capability_keys: ['ACADEMIC_SUPPORT_TRIAGE'], confidence };
  }

  return { need_type: null, required_capability_keys: [], confidence: 0 };
}
