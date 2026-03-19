import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

/**
 * Create a mock auth middleware that bypasses actual auth but sets the apiKey context.
 */
function createMockAuthMiddleware(
  scopes: string[] | null,
  tierSlug = 'warbird',
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

describe('dead letter routes scope enforcement', () => {
  /**
   * Test requireApiKeyScopes directly with a mock app.
   * This tests the scope enforcement for DLQ routes.
   */
  const createApp = (scopes: string[] | null, tierSlug = 'warbird') => {
    const app = new Hono<{ Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue } }>();
    app.use('*', createMockAuthMiddleware(scopes, tierSlug));
    // Read routes - require deliveries:read
    app.get('/dead-letter', requireApiKeyScopes(['deliveries:read']), (c) => c.json({ ok: true }));
    app.get('/dead-letter/:id', requireApiKeyScopes(['deliveries:read']), (c) =>
      c.json({ ok: true }),
    );
    // Write routes - require events:write
    app.post('/dead-letter/:id/replay', requireApiKeyScopes(['events:write']), (c) =>
      c.json({ ok: true }),
    );
    app.delete('/dead-letter/:id', requireApiKeyScopes(['events:write']), (c) =>
      c.json({ ok: true }),
    );
    return app;
  };

  describe('read operations (deliveries:read)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/dead-letter');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with matching scopes', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/dead-letter');
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with deliveries:read on single item', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/dead-letter/dlq_123');
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys with wrong scopes (write-only key trying read)', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/dead-letter');
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; requiredScopes?: string[] };
      expect(json.error).toBe('Forbidden');
      expect(json.requiredScopes).toContain('deliveries:read');
    });

    it('should deny requests from keys with unrelated scopes', async () => {
      const app = createApp(['endpoints:read']);
      const res = await app.request('/dead-letter');
      expect(res.status).toBe(403);
    });

    it('should allow requests with empty scopes array (legacy behavior)', async () => {
      const app = createApp([]);
      const res = await app.request('/dead-letter');
      // Empty array is treated as legacy (no scopes)
      expect(res.status).toBe(200);
    });
  });

  describe('write operations (events:write)', () => {
    it('should allow requests from legacy keys (no scopes)', async () => {
      const app = createApp(null);
      const res = await app.request('/dead-letter/dlq_123/replay', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should allow requests from keys with events:write scope', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/dead-letter/dlq_123/replay', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should deny requests from keys without events:write', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/dead-letter/dlq_123/replay', { method: 'POST' });
      expect(res.status).toBe(403);
    });

    it('should allow delete with events:write', async () => {
      const app = createApp(['events:write']);
      const res = await app.request('/dead-letter/dlq_123', { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should deny delete without events:write', async () => {
      const app = createApp(['deliveries:read']);
      const res = await app.request('/dead-letter/dlq_123', { method: 'DELETE' });
      expect(res.status).toBe(403);
    });
  });
});

describe('tier gating for DLQ feature', () => {
  /**
   * Test that DLQ feature gating works correctly.
   * Paper Plane tier should not have access, Warbird and above should.
   */
  const createDlqApp = (tierSlug: string) => {
    const app = new Hono<{ Variables: { workspace: { tierSlug: string } } }>();
    app.use('*', createMockAuthMiddleware(['deliveries:read', 'events:write'], tierSlug));

    // This simulates the tier check in dead-letter routes
    app.get('/dlq', async (c, next): Promise<Response> => {
      const workspace = c.get('workspace') as { tierSlug: string };
      const { getTierBySlug, isFeatureEnabled } = await import('@hookwing/shared');
      const tier = getTierBySlug(workspace.tierSlug);

      if (!tier || !isFeatureEnabled(tier, 'dead_letter_queue')) {
        return c.json(
          {
            error: 'Forbidden',
            message:
              'Dead Letter Queue is not available on your current plan. Upgrade to Warbird or higher to access this feature.',
            upgradeRequired: true,
            currentTier: workspace.tierSlug,
            requiredTier: 'warbird',
          },
          403,
        );
      }

      await next();
      return c.json({ ok: true });
    });

    return app;
  };

  it('should block DLQ for Paper Plane tier', async () => {
    const app = createDlqApp('paper-plane');
    const res = await app.request('/dlq');
    expect(res.status).toBe(403);
    const json = (await res.json()) as {
      error: string;
      upgradeRequired?: boolean;
      currentTier?: string;
      requiredTier?: string;
    };
    expect(json.error).toBe('Forbidden');
    expect(json.upgradeRequired).toBe(true);
    expect(json.currentTier).toBe('paper-plane');
    expect(json.requiredTier).toBe('warbird');
  });

  it('should allow DLQ for Warbird tier', async () => {
    const app = createDlqApp('warbird');
    const res = await app.request('/dlq');
    expect(res.status).toBe(404); // 404 because route doesn't exist, but not 403
  });

  it('should allow DLQ for Fighter Jet tier', async () => {
    const app = createDlqApp('fighter-jet');
    const res = await app.request('/dlq');
    expect(res.status).toBe(404); // 404 because route doesn't exist, but not 403
  });
});

describe('module exports', () => {
  it('should export deadLetterRoutes', async () => {
    const mod = await import('../routes/dead-letter');
    expect(mod.default).toBeDefined();
  });
});
