import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

/**
 * Create a mock auth middleware that bypasses actual auth but sets the apiKey context.
 */
function createMockAuthMiddleware(
  scopes: string[] | null,
  tierSlug = 'fighter-jet',
): MiddlewareHandler {
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
      tierSlug,
      email: 'test@example.com',
      slug: 'test-workspace',
      isPlayground: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await next();
  };
}

describe('custom domains routes scope enforcement', () => {
  /**
   * Test requireApiKeyScopes directly with a mock app.
   * This tests the scope enforcement for custom domain routes.
   */
  const createApp = (scopes: string[] | null, tierSlug = 'fighter-jet') => {
    const app = new Hono<{ Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue } }>();
    app.use('*', createMockAuthMiddleware(scopes, tierSlug));
    // Read routes - require domains:read
    app.get('/domains', requireApiKeyScopes(['domains:read']), (c) => c.json({ ok: true }));
    app.get('/domains/:id', requireApiKeyScopes(['domains:read']), (c) => c.json({ ok: true }));
    // Write routes - require domains:write
    app.post('/domains', requireApiKeyScopes(['domains:write']), (c) => c.json({ ok: true }));
    app.delete('/domains/:id', requireApiKeyScopes(['domains:write']), (c) =>
      c.json({ ok: true }),
    );
    return app;
  };

  describe('read operations (domains:read)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/domains');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with matching scopes', async () => {
      const app = createApp(['domains:read']);
      const res = await app.request('/domains');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with domains:read on single item', async () => {
      const app = createApp(['domains:read']);
      const res = await app.request('/domains/cd_123');
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys with wrong scopes (write-only key trying read)', async () => {
      const app = createApp(['domains:write']);
      const res = await app.request('/domains');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('domains:read');
    });

    it('should deny requests from keys with unrelated scopes', async () => {
      const app = createApp(['endpoints:read']);
      const res = await app.request('/domains');
      expect(res.status).toBe(403);
    });

    it('should allow requests with empty scopes array (legacy behavior)', async () => {
      const app = createApp([]);
      const res = await app.request('/domains');
      // Empty array is treated as legacy (no scopes)
      expect(res.status).toBe(200);
    });
  });

  describe('write operations (domains:write)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/domains', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with domains:write scope', async () => {
      const app = createApp(['domains:write']);
      const res = await app.request('/domains', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys without domains:write', async () => {
      const app = createApp(['domains:read']);
      const res = await app.request('/domains', { method: 'POST' });
      expect(res.status).toBe(403);
    });

    it('should allow delete with domains:write', async () => {
      const app = createApp(['domains:write']);
      const res = await app.request('/domains/cd_123', { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should deny delete without domains:write', async () => {
      const app = createApp(['domains:read']);
      const res = await app.request('/domains/cd_123', { method: 'DELETE' });
      expect(res.status).toBe(403);
    });
  });
});

describe('tier gating for custom domains feature', () => {
  /**
   * Test that custom domains feature gating works correctly.
   * Fighter Jet tier only should have access.
   */
  const createCustomDomainApp = (tierSlug: string) => {
    const app = new Hono<{ Variables: { workspace: { tierSlug: string } } }>();
    app.use('*', createMockAuthMiddleware(['domains:read', 'domains:write'], tierSlug));

    // This simulates the tier check in custom-domains routes
    app.get('/domains', async (c, next): Promise<Response> => {
      const workspace = c.get('workspace') as { tierSlug: string };
      const { getTierBySlug, isFeatureEnabled } = await import('@hookwing/shared');
      const tier = getTierBySlug(workspace.tierSlug);

      if (!tier || !isFeatureEnabled(tier, 'custom_domains')) {
        return c.json(
          {
            error: 'Custom domains require Fighter Jet tier',
            currentTier: workspace.tierSlug,
            requiredTier: 'fighter-jet',
          },
          403,
        );
      }

      await next();
      return c.json({ ok: true });
    });

    return app;
  };

  it('should block custom domains for Paper Plane tier', async () => {
    const app = createCustomDomainApp('paper-plane');
    const res = await app.request('/domains');
    expect(res.status).toBe(403);
    const json = (await res.json()) as {
      error: string;
      currentTier?: string;
      requiredTier?: string;
    };
    expect(json.error).toBe('Custom domains require Fighter Jet tier');
    expect(json.currentTier).toBe('paper-plane');
    expect(json.requiredTier).toBe('fighter-jet');
  });

  it('should block custom domains for Warbird tier', async () => {
    const app = createCustomDomainApp('warbird');
    const res = await app.request('/domains');
    expect(res.status).toBe(403);
    const json = (await res.json()) as {
      error: string;
      currentTier?: string;
      requiredTier?: string;
    };
    expect(json.error).toBe('Custom domains require Fighter Jet tier');
    expect(json.currentTier).toBe('warbird');
    expect(json.requiredTier).toBe('fighter-jet');
  });

  it('should allow custom domains for Fighter Jet tier', async () => {
    const app = createCustomDomainApp('fighter-jet');
    const res = await app.request('/domains');
    expect(res.status).toBe(200);
  });
});

describe('module exports', () => {
  it('should export customDomainRoutes', async () => {
    const mod = await import('../routes/custom-domains');
    expect(mod.default).toBeDefined();
  });
});
