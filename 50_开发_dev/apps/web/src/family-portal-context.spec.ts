import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

describe('Family portal intervention and context projection', () => {
  it('renders approved intervention status without creating a second family experience', () => {
    expect(source).toContain('data-family-portal-interventions');
    expect(source).toContain('adapter.getInterventionLibrary()');
    expect(source).toContain("adapter.resolveFamilyContext(childId, 'GROWTH_GUIDANCE')");
    expect(source).toContain('行动仍需家长确认');
    expect(source).toContain("appRoot.dataset.platformCore = 'existing-family-api'");
  });
});
