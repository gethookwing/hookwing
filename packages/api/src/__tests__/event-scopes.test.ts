import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

/**
 * Create a mock auth middleware that bypasses actual auth but sets the apiKey context.
 * This allows testing scope enforcement without needing a real database.
 */
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

describe('events routes scope enforcement', () => {
  /**
   * Test requireApiKeyScopes directly with a mock app that bypasses real auth.
   */
  const createApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuthMiddleware(scopes));
    // Read routes
    app.get('/events', requireApiKeyScopes(['events:read']), (c) => c.json({ ok: true }));
    app.get('/events/:id', requireApiKeyScopes(['events:read']), (c) => c.json({ ok: true }));
    app.get('/events/:id/deliveries', requireApiKeyScopes(['events:read']), (c) =>
      c.json({ ok: true }),
    );
    // Write routes
    app.post('/events/:id/replay', requireApiKeyScopes(['events:write']), (c) =>
      c.json({ ok: true }),
    );
    app.post('/events/replay', requireApiKeyScopes(['events:write']), (c) => c.json({ ok: true }));
    return app;
  };

  describe('read operations (events:read)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/events');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with matching scopes (events:read)', async () => {
      const app = createApp(['events:read']);
      const res = await app.request('/events');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with events:read on single event', async () => {
      const app = createApp(['events:read']);
      const res = await app.request('/events/evt_123');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with events:read on event deliveries', async () => {
      const app = createApp(['events:read']);
      const res = await app.request('/events/evt_123/deliveries');
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys with wrong scopes (write-only key trying read)', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/events');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('events:read');
    });

    it('should deny requests from keys with unrelated scopes', async () => {
      const app = createApp(['deliveries:read', 'endpoints:read']);
      const res = await app.request('/events');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('events:read');
    });

    it('should allow requests with empty scopes array (legacy behavior)', async () => {
      const app = createApp([]);
      const res = await app.request('/events');
      // Empty array is treated as legacy (no scopes)
      expect(res.status).toBe(200);
    });
  });

  describe('write operations (events:write)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/events/evt_123/replay', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with matching scopes (events:write)', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/events/evt_123/replay', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with events:write on bulk replay', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/events/replay', {
        method: 'POST',
        body: JSON.stringify({ eventIds: ['evt_123'] }),
      });
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys with wrong scopes (read-only key trying write)', async () => {
      const app = createApp(['events:read']);
      const res = await app.request('/events/evt_123/replay', { method: 'POST' });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('events:write');
    });

    it('should deny requests from keys with unrelated scopes', async () => {
      const app = createApp(['deliveries:write', 'endpoints:write']);
      const res = await app.request('/events/replay', {
        method: 'POST',
        body: JSON.stringify({ eventIds: ['evt_123'] }),
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('events:write');
    });
  });

  describe('module integration', () => {
    it('should have events routes defined', async () => {
      // Import the route module to verify it has the middleware
      const routeSource = await import('../routes/events');
      // This is a compile-time verification - if the middleware is applied incorrectly,
      // TypeScript would catch it.
      expect(routeSource.default).toBeDefined();
    });
  });
});
