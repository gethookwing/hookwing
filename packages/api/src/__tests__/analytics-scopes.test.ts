import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

function createMockAuthMiddleware(scopes: string[] | null): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    c.set('apiKey', {
      id: 'test_key_123',
      name: 'Test Key',
      keyPrefix: 'test_key_',
      scopes,
    });
    c.set('workspace', {
      id: 'ws_test_123',
      name: 'Test Workspace',
      tierSlug: 'paper-plane',
    });
    await next();
  };
}

describe('analytics scope enforcement', () => {
  const createApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuthMiddleware(scopes));
    app.get('/usage', requireApiKeyScopes(['analytics:read']), (c) => c.json({ ok: true }));
    app.get('/summary', requireApiKeyScopes(['analytics:read']), (c) => c.json({ ok: true }));
    return app;
  };

  it('allows legacy key (null scopes) to access usage', async () => {
    const app = createApp(null);
    const res = await app.request('/usage');
    expect(res.status).toBe(200);
  });

  it('allows legacy key (null scopes) to access summary', async () => {
    const app = createApp(null);
    const res = await app.request('/summary');
    expect(res.status).toBe(200);
  });

  it('allows key with analytics:read scope', async () => {
    const app = createApp(['analytics:read']);
    const res = await app.request('/usage');
    expect(res.status).toBe(200);
  });

  it('forbids key with wrong scope from usage', async () => {
    const app = createApp(['endpoints:read']);
    const res = await app.request('/usage');
    expect(res.status).toBe(403);
  });

  it('forbids key with wrong scope from summary', async () => {
    const app = createApp(['events:read']);
    const res = await app.request('/summary');
    expect(res.status).toBe(403);
  });

  it('allows key with empty scopes array (legacy)', async () => {
    const app = createApp([]);
    const res = await app.request('/usage');
    expect(res.status).toBe(200);
  });
});
