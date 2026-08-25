import { describe, expect, it } from 'vitest';
import { consumerRoutes } from '@family/web-platform';

describe('consumer production route registry', () => {
  it('contains the authenticated vertical slice routes', () => {
    expect(consumerRoutes).toContain('/login');
    expect(consumerRoutes).toContain('/select-family');
    expect(consumerRoutes).toContain('/today');
  });
});
