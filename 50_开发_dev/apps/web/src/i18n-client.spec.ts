import { describe, expect, it } from 'vitest';
import { i18n, t, setLocale, getLocale } from './i18n-client';

describe('i18n-client（阶段 0 管道验证，web 端）', () => {
  it('默认 zh-CN 与切换后的 en-US 对同一 key 返回不同文案', async () => {
    expect(getLocale()).toBe('zh-CN');
    expect(t('common:cancel')).toBe('取消');

    await setLocale('en-US');
    expect(getLocale()).toBe('en-US');
    expect(t('common:cancel')).toBe('Cancel');

    await setLocale('zh-CN');
    expect(t('common:cancel')).toBe('取消');
  });

  it('i18n 实例可直接被裸调用（不依赖任何框架绑定）', () => {
    expect(typeof i18n.t).toBe('function');
    expect(i18n.t('common:loading')).toBe('加载中...');
  });
});
