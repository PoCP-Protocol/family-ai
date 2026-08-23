import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlatformConsole } from './platform-console.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); window.localStorage.clear(); document.body.innerHTML = ''; });

describe('运营控制台家庭回执筛选', () => {
  it('filters and exports the current family receipt projection without creating a client-side authorization or external sharing path', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    createPlatformConsole(root, {
      initialProjection: { tenant: { tenant_id: 'tenant-test', tenant_ref: 'TEST', display_name: '测试租户' } },
      initialOperations: {
        operations: [
          { operation_id: 'op-booking', page_id: 'UI-21', operation_kind: 'DOMAIN_COMMAND', fixture_ref: 'booking-1', status: 'CONFIRMED', source: 'DOMAIN_COMMAND_ADAPTER', authorization_status: 'FAMILY_SCOPE_AUTHORIZED', external_effect: false, created_at: '2026-08-22T00:00:00.000Z' },
          { operation_id: 'op-activity', page_id: 'UI-23', operation_kind: 'EVENT_REGISTRATION', fixture_ref: 'event-1', status: 'CANCELLED', source: 'TEST_FIXTURE', authorization_status: 'FAMILY_SCOPE_AUTHORIZED', external_effect: false, created_at: '2026-08-21T00:00:00.000Z' },
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

    const resetPage = root.querySelector<HTMLSelectElement>('#receiptPageFilter');
    const resetStatus = root.querySelector<HTMLSelectElement>('#receiptStatusFilter');
    if (!resetPage || !resetStatus) throw new Error('receipt filters missing after redraw');
    resetPage.value = 'ALL'; resetPage.dispatchEvent(new Event('change'));
    root.querySelector<HTMLSelectElement>('#receiptStatusFilter')!.value = 'ALL';
    root.querySelector<HTMLSelectElement>('#receiptStatusFilter')!.dispatchEvent(new Event('change'));

    const sourceFilter = root.querySelector<HTMLSelectElement>('#receiptSourceFilter');
    const authorizationFilter = root.querySelector<HTMLSelectElement>('#receiptAuthorizationFilter');
    const toDate = root.querySelector<HTMLInputElement>('#receiptToDate');
    if (!sourceFilter || !authorizationFilter || !toDate) throw new Error('advanced receipt filters missing');
    sourceFilter.value = 'TEST_FIXTURE'; sourceFilter.dispatchEvent(new Event('change'));
    expect(root.querySelector('.receipt-panel tbody')?.textContent).toContain('亲子活动');
    expect(root.querySelector('.receipt-panel tbody')?.textContent).not.toContain('咨询预约');

    root.querySelector<HTMLSelectElement>('#receiptSourceFilter')!.value = 'ALL';
    root.querySelector<HTMLSelectElement>('#receiptSourceFilter')!.dispatchEvent(new Event('change'));
    root.querySelector<HTMLInputElement>('#receiptToDate')!.value = '2026-08-21';
    root.querySelector<HTMLInputElement>('#receiptToDate')!.dispatchEvent(new Event('change'));
    expect(root.querySelector('.receipt-panel tbody')?.textContent).toContain('亲子活动');
    expect(root.querySelector('.receipt-panel tbody')?.textContent).not.toContain('咨询预约');

    root.querySelector<HTMLInputElement>('#receiptToDate')!.value = '';
    root.querySelector<HTMLInputElement>('#receiptToDate')!.dispatchEvent(new Event('change'));
    root.querySelector<HTMLSelectElement>('#receiptAuthorizationFilter')!.value = 'FAMILY_SCOPE_AUTHORIZED';
    root.querySelector<HTMLSelectElement>('#receiptAuthorizationFilter')!.dispatchEvent(new Event('change'));
    expect(root.querySelector('.receipt-panel tbody')?.textContent).toContain('家庭范围已授权');

    const createObjectURL = vi.fn(() => 'blob:test-receipts');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    root.querySelector<HTMLButtonElement>('#receiptExport')?.click();
    expect(root.textContent).toContain('正在生成表格…');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    expect(root.dataset.receiptExportAudit).toBe('LOCAL_CSV:2');
    expect(root.textContent).toContain('未发送、分享或通知任何外部对象。');
  });

  it('supports quick dates, saved filters, time pagination and a server-backed follow-up note without client-side authorization', async () => {
    const root = document.createElement('div'); document.body.append(root);
    const updateFollowUp = vi.fn(async () => ({ follow_up_status: 'PENDING_FOLLOW_UP', operator_note: '请顾问在本周内回看。', follow_up_updated_at: '2026-08-22T10:00:00.000Z' }));
    const operations: Array<{ operation_id: string, page_id: string, operation_kind: string, fixture_ref: string, status: 'CONFIRMED', source: 'DOMAIN_COMMAND_ADAPTER', authorization_status: 'FAMILY_SCOPE_AUTHORIZED', external_effect: false, created_at: string }> = Array.from({ length: 11 }, (_, index) => ({
      operation_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      page_id: index % 2 ? 'UI-23' : 'UI-21', operation_kind: 'DOMAIN_COMMAND', fixture_ref: `fixture-${index + 1}`,
      status: 'CONFIRMED', source: 'DOMAIN_COMMAND_ADAPTER', authorization_status: 'FAMILY_SCOPE_AUTHORIZED', external_effect: false, created_at: `2026-08-${String(22 - index % 7).padStart(2, '0')}T12:00:00.000Z`,
    }));
    createPlatformConsole(root, { initialProjection: { tenant: { tenant_id: 'tenant-test', tenant_ref: 'TEST', display_name: '测试租户' } }, initialOperations: { operations }, updateFamilyOperationFollowUp: updateFollowUp });
    root.querySelector<HTMLButtonElement>('[data-page="operations"]')?.click();
    expect(root.textContent).toContain('共 11 条 · 第 1/2 页');
    root.querySelector<HTMLButtonElement>('#receiptNextPage')?.click();
    expect(root.textContent).toContain('第 2/2 页');
    root.querySelector<HTMLButtonElement>('#receiptRecent7')?.click();
    const expectedRecentFrom = new Date(); expectedRecentFrom.setDate(expectedRecentFrom.getDate() - 7);
    expect(root.querySelector<HTMLInputElement>('#receiptFromDate')?.value).toBe(expectedRecentFrom.toISOString().slice(0, 10));
    root.querySelector<HTMLSelectElement>('#receiptPageFilter')!.value = 'UI-21';
    root.querySelector<HTMLSelectElement>('#receiptPageFilter')!.dispatchEvent(new Event('change'));
    root.querySelector<HTMLButtonElement>('#receiptSavePreset')?.click();
    expect(window.localStorage.getItem('family-operation-receipt-filters-v1')).toContain('UI-21');
    root.querySelector<HTMLSelectElement>('#receiptPageFilter')!.value = 'ALL';
    root.querySelector<HTMLSelectElement>('#receiptPageFilter')!.dispatchEvent(new Event('change'));
    root.querySelector<HTMLButtonElement>('#receiptRestorePreset')?.click();
    expect(root.querySelector<HTMLSelectElement>('#receiptPageFilter')?.value).toBe('UI-21');
    const operationId = operations[0].operation_id;
    const status = root.querySelector<HTMLSelectElement>(`[data-followup-status="${operationId}"]`);
    const note = root.querySelector<HTMLTextAreaElement>(`[data-followup-note="${operationId}"]`);
    if (!status || !note) throw new Error('follow-up controls missing');
    status.value = 'PENDING_FOLLOW_UP'; note.value = '请顾问在本周内回看。';
    root.querySelector<HTMLButtonElement>(`[data-save-followup="${operationId}"]`)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateFollowUp).toHaveBeenCalledWith(operationId, { follow_up_status: 'PENDING_FOLLOW_UP', operator_note: '请顾问在本周内回看。' });
    expect(root.textContent).toContain('已记录人工跟进状态与备注。');
    expect(root.querySelector<HTMLTextAreaElement>(`[data-followup-note="${operationId}"]`)?.value).toBe('请顾问在本周内回看。');
  });
});
