import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/family-api-adapter.js'), 'utf8');

describe('Family API tenant-scoped Web adapter', () => {
  it('uses the unified tenant-scoped UI projection read endpoint', () => {
    expect(source).toContain("getTenantScopedUiProjection: () => read('/tenant-scoped/ui-projection')");
  });

  it('uses bearer-only credentials when a short-lived bearer is supplied', () => {
    expect(source).toContain("credentials: bearerToken ? 'omit' : 'include'");
    expect(source).toContain('Authorization: `Bearer ${bearerToken}`');
  });
});
