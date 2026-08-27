import { afterEach, describe, expect, it } from 'vitest';
import { FAMILY_UI_IDS } from '@family/contracts';
import { createConsumerExperience } from './consumer-shell.js';
import { createOperationsExperience } from './operations-shell.js';
import { SCREEN_BY_ID, WEB_PRIMARY_NAV, WEB_UI_SCREENS } from './web-ui-registry.js';

afterEach(() => { document.body.innerHTML = ''; window.location.hash = ''; });
describe('Web 双端 V1', () => {
  it('覆盖 34 个 UI、五个家庭工作区并保持语义路由唯一', () => {
    expect(WEB_UI_SCREENS.map((screen) => screen.id)).toEqual([...FAMILY_UI_IDS]);
    expect(new Set(WEB_UI_SCREENS.map((screen) => screen.route)).size).toBe(34);
    expect(new Set(WEB_UI_SCREENS.map((screen) => screen.tab))).toEqual(new Set(WEB_PRIMARY_NAV.map((item) => item.id)));
    expect(SCREEN_BY_ID.has('UI-35')).toBe(false);
  });
  it('mounts consumer default shell and keeps domain boundary copy', () => {
    const root = document.createElement('main'); document.body.append(root);
    const app = createConsumerExperience(root);
    expect(root.dataset.clientSurface).toBe('consumer-web-v2'); expect(root.dataset.uiBaseline).toBe('34'); expect(root.textContent).toContain('今晚一件事');
    expect(root.querySelector('[aria-label="成长主题"]')).toBeTruthy();
    expect(root.textContent).not.toMatch(/设计预览|工作区|Named Action|UI-01/);
    root.querySelector('[data-topic="情绪支持"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('[data-topic="情绪支持"]')?.classList.contains('is-active')).toBe(true);
    root.querySelector('[data-nav="growth"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(app.getCurrentScreen().id).toBe('UI-02'); expect(root.textContent).toContain('不生成总分、排名或永久标签'); app.destroy();
  });
  it('mounts distinct operations shell with ten workspaces', () => {
    const root = document.createElement('main'); document.body.append(root); const app = createOperationsExperience(root);
    expect(root.dataset.clientSurface).toBe('operations-web-v2'); expect(root.querySelectorAll('[data-ops-route]').length).toBe(10); expect(root.textContent).toContain('运营总览'); app.navigate('assessment'); expect(root.textContent).toContain('测评与 AI 质量');
  });
});
