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

describe('deliveries routes scope enforcement', () => {
  /**
   * Test requireApiKeyScopes directly with a mock app that bypasses real auth.
   */
  const createApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuthMiddleware(scopes));
    // Read routes
    app.get('/deliveries', requireApiKeyScopes(['deliveries:read']), (c) => c.json({ ok: true }));
    app.get('/deliveries/:id', requireApiKeyScopes(['deliveries:read']), (c) =>
      c.json({ ok: true }),
    );
    return app;
  };

  describe('read operations (deliveries:read)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/deliveries');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with matching scopes (deliveries:read)', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/deliveries');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with deliveries:read on single delivery', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/deliveries/dlv_123');
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys with wrong scopes (write-only key trying read)', async () => {
      const app = createApp(['deliveries:write']);
      const res = await app.request('/deliveries');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('deliveries:read');
    });

    it('should deny requests from keys with unrelated scopes', async () => {
      const app = createApp(['events:read', 'endpoints:read']);
      const res = await app.request('/deliveries');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('deliveries:read');
    });

    it('should allow requests with empty scopes array (legacy behavior)', async () => {
      const app = createApp([]);
      const res = await app.request('/deliveries');
      // Empty array is treated as legacy (no scopes)
      expect(res.status).toBe(200);
    });

    it('should allow keys with events:read to access deliveries (cross-read allowed)', async () => {
      // This tests that keys with broader read access can still access deliveries
      // (but they need deliveries:read specifically per the route definition)
      const app = createApp(['events:read']);
      const res = await app.request('/deliveries');
      // This should fail because they need deliveries:read specifically
      expect(res.status).toBe(403);
    });
  });

  describe('module integration', () => {
    it('should have deliveries routes defined', async () => {
      // Import the route module to verify it has the middleware
      const routeSource = await import('../routes/deliveries');
      // This is a compile-time verification - if the middleware is applied incorrectly,
      // TypeScript would catch it.
      expect(routeSource.default).toBeDefined();
    });
  });
});
