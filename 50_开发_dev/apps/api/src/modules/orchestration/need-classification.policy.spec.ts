import { describe, expect, it } from 'vitest';
import { classifyNeed } from './need-classification.policy';

describe('FAMILY-GROWTH-VERTICAL-SLICE-001 classifyNeed — G1-A academic need branch', () => {
  it('命中学业触发词 → CHILD_ACADEMIC_SUPPORT_NEED + ACADEMIC_SUPPORT_TRIAGE', () => {
    const cls = classifyNeed('孩子每天写作业都拖延,坐不住,注意力老是走神');
    expect(cls.need_type).toBe('CHILD_ACADEMIC_SUPPORT_NEED');
    expect(cls.required_capability_keys).toEqual(['ACADEMIC_SUPPORT_TRIAGE']);
    expect(cls.confidence).toBeGreaterThan(0);
  });

  it('不命中任何触发词 → null,不臆造类别', () => {
    const cls = classifyNeed('今天天气不错,一起去公园玩了');
    expect(cls.need_type).toBeNull();
    expect(cls.required_capability_keys).toEqual([]);
    expect(cls.confidence).toBe(0);
  });

  it('冲突词与学业词同时命中 → 冲突词优先,不返回学业类型(避免弱化既有安全相关分类)', () => {
    const cls = classifyNeed('他不想写作业,我一提就跟我吵,还摔门');
    expect(cls.need_type).toBe('PARENT_CHILD_COMMUNICATION_CONFLICT');
    expect(cls.required_capability_keys).toContain('DE_ESCALATION');
  });

  it('重开口词(非冲突词)与学业词同时命中 → 仍归入沟通冲突分支(现状优先规则同样覆盖 reopen)', () => {
    const cls = classifyNeed('想和孩子聊聊作业拖延的事,不知道怎么开口');
    expect(cls.need_type).toBe('PARENT_CHILD_COMMUNICATION_CONFLICT');
  });

  it('仅学业词命中,不含任何冲突/重开口词', () => {
    const cls = classifyNeed('孩子最近厌学,写作业很磨蹭');
    expect(cls.need_type).toBe('CHILD_ACADEMIC_SUPPORT_NEED');
  });
});
