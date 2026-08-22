import { afterEach, describe, expect, it } from 'vitest';
import { createPlatformConsole } from './platform-console.js';

afterEach(() => { document.body.innerHTML = ''; });

describe('运营控制台家庭回执筛选', () => {
  it('filters the current family receipt projection by UI page and receipt status without creating a client-side authorization path', () => {
    const root = document.createElement('div');
    document.body.append(root);
    createPlatformConsole(root, {
      initialProjection: { tenant: { tenant_id: 'tenant-test', tenant_ref: 'TEST', display_name: '测试租户' } },
      initialOperations: {
        operations: [
          { operation_id: 'op-booking', page_id: 'UI-21', operation_kind: 'DOMAIN_COMMAND', fixture_ref: 'booking-1', status: 'CONFIRMED', source: 'DOMAIN_COMMAND_ADAPTER', external_effect: false, created_at: '2026-08-22T00:00:00.000Z' },
          { operation_id: 'op-activity', page_id: 'UI-23', operation_kind: 'EVENT_REGISTRATION', fixture_ref: 'event-1', status: 'CANCELLED', source: 'TEST_FIXTURE', external_effect: false, created_at: '2026-08-21T00:00:00.000Z' },
        ],
      },
    });

    root.querySelector<HTMLButtonElement>('[data-page="operations"]')?.click();
    expect(root.textContent).toContain('咨询预约');
    expect(root.textContent).toContain('亲子活动');

    const pageFilter = root.querySelector<HTMLSelectElement>('#receiptPageFilter');
    expect(pageFilter).not.toBeNull();
    if (!pageFilter) throw new Error('receipt page filter missing');
    pageFilter.value = 'UI-21';
    pageFilter.dispatchEvent(new Event('change'));
    const filteredRows = root.querySelector('.receipt-panel tbody')?.textContent;
    expect(filteredRows).toContain('咨询预约');
    expect(filteredRows).not.toContain('亲子活动');

    const statusFilter = root.querySelector<HTMLSelectElement>('#receiptStatusFilter');
    expect(statusFilter).not.toBeNull();
    if (!statusFilter) throw new Error('receipt status filter missing');
    statusFilter.value = 'CANCELLED';
    statusFilter.dispatchEvent(new Event('change'));
    expect(root.textContent).toContain('当前筛选没有家庭回执。');
  });
});
