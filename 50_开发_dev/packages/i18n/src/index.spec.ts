import { describe, expect, it } from 'vitest';
import { createFamilyI18n } from './index';

describe('createFamilyI18n (阶段 0 管道验证)', () => {
  it('zh-CN 与 en-US 对同一 key 返回不同文案', () => {
    const zh = createFamilyI18n({ locale: 'zh-CN' });
    const en = createFamilyI18n({ locale: 'en-US' });

    expect(zh.t('common:back')).toBe('返回');
    expect(en.t('common:back')).toBe('Back');
    expect(zh.t('common:back')).not.toBe(en.t('common:back'));
  });

  it('changeLanguage 后同一实例取值随之切换', async () => {
    const instance = createFamilyI18n({ locale: 'zh-CN' });
    expect(instance.t('common:submit')).toBe('提交');

    await instance.changeLanguage('en-US');
    expect(instance.t('common:submit')).toBe('Submit');
  });
});
