import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

function createMockAuthMiddleware(scopes: string[] | null): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    c.set('apiKey', {
      id: 'test_key_auth_scopes',
      name: 'Test Key',
      keyPrefix: 'hk_test_',
      scopes,
    });
    c.set('workspace', {
      id: 'ws_test_123',
      name: 'Test Workspace',
      tierSlug: 'stealth-jet',
    });
    await next();
  };
}

const createApp = (scopes: string[] | null) => {
  const app = new Hono();
  app.use('*', createMockAuthMiddleware(scopes));
  app.get('/me', requireApiKeyScopes(['workspace:read']), (c) => c.json({ ok: true }));
  app.get('/keys', requireApiKeyScopes(['keys:read']), (c) => c.json({ ok: true }));
  app.post('/keys', requireApiKeyScopes(['keys:write']), (c) => c.json({ ok: true }));
  app.delete('/keys/:id', requireApiKeyScopes(['keys:write']), (c) => c.json({ ok: true }));
  app.post('/2fa/setup', requireApiKeyScopes(['workspace:write']), (c) => c.json({ ok: true }));
  return app;
};

describe('auth scope enforcement comprehensive', () => {
  it('allows workspace:read keys to access /me', async () => {
    const res = await createApp(['workspace:read']).request('/me');
    expect(res.status).toBe(200);
  });

  it('forbids keys:read-only keys from accessing /me', async () => {
    const res = await createApp(['keys:read']).request('/me');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; requiredScopes?: string[] };
    expect(body.error).toBe('Forbidden');
    expect(body.requiredScopes).toContain('workspace:read');
  });

  it('allows keys:read keys to list API keys', async () => {
    const res = await createApp(['keys:read']).request('/keys');
    expect(res.status).toBe(200);
  });

  it('forbids workspace:read keys from listing API keys', async () => {
    const res = await createApp(['workspace:read']).request('/keys');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { requiredScopes?: string[] };
    expect(body.requiredScopes).toContain('keys:read');
  });

  it('allows keys:write keys to create API keys', async () => {
    const res = await createApp(['keys:write']).request('/keys', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('forbids keys:read keys from creating API keys', async () => {
    const res = await createApp(['keys:read']).request('/keys', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { requiredScopes?: string[] };
    expect(body.requiredScopes).toContain('keys:write');
  });

  it('allows keys:write keys to delete API keys', async () => {
    const res = await createApp(['keys:write']).request('/keys/key_123', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('forbids workspace:write keys from deleting API keys', async () => {
    const res = await createApp(['workspace:write']).request('/keys/key_123', { method: 'DELETE' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { requiredScopes?: string[] };
    expect(body.requiredScopes).toContain('keys:write');
  });

  it('allows workspace:write keys to access 2FA setup', async () => {
    const res = await createApp(['workspace:write']).request('/2fa/setup', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('forbids workspace:read keys from accessing 2FA setup', async () => {
    const res = await createApp(['workspace:read']).request('/2fa/setup', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { requiredScopes?: string[] };
    expect(body.requiredScopes).toContain('workspace:write');
  });

  it('allows legacy keys without scopes on all auth management routes', async () => {
    const app = createApp(null);
    const responses = await Promise.all([
      app.request('/me'),
      app.request('/keys'),
      app.request('/keys', { method: 'POST' }),
      app.request('/keys/key_123', { method: 'DELETE' }),
      app.request('/2fa/setup', { method: 'POST' }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });
});
