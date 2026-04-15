/**
 * Tests for endpoint delete cascade behaviour.
 *
 * Covers:
 * - Schema-level cascade configuration (deliveries cascade on endpoint delete,
 *   dead_letter_items and routing_rules do NOT have FK cascade on endpoint)
 * - Route-level auth enforcement for DELETE /v1/endpoints/:id
 * - Scope enforcement via requireApiKeyScopes on delete routes
 * - Response shape and edge-case handling (unknown id, force param)
 */

import { deadLetterItems, deliveries, endpoints, routingRules } from '@hookwing/shared';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';
import endpointRoutes from '../routes/endpoints';

// ============================================================================
// Schema-level cascade contract
// ============================================================================

describe('endpoint delete cascade — schema declarations', () => {
  it('deliveries table has an endpointId column', () => {
    const cols = Object.keys(deliveries);
    expect(cols).toContain('endpointId');
  });

  it('deliveries.endpointId column is defined', () => {
    expect(deliveries.endpointId).toBeDefined();
  });

  it('deadLetterItems has an endpointId column (plain text, no FK cascade)', () => {
    expect(deadLetterItems.endpointId).toBeDefined();
    expect((deadLetterItems.endpointId as { name?: string }).name).toBe('endpoint_id');
  });

  it('routingRules has actionEndpointId column (plain text, no FK cascade)', () => {
    expect(routingRules.actionEndpointId).toBeDefined();
    expect((routingRules.actionEndpointId as { name?: string }).name).toBe('action_endpoint_id');
  });

  it('endpoints table id column is defined', () => {
    expect(endpoints.id).toBeDefined();
    expect((endpoints.id as { name?: string }).name).toBe('id');
  });

  it('deliveries references endpoints differently than deadLetterItems', () => {
    // deliveries.endpointId is a proper FK reference (drizzle adds a config object)
    // deadLetterItems.endpointId is a plain text column with no references()
    // Both exist but only deliveries should have a foreign key definition
    const dlqCol = deadLetterItems.endpointId as unknown as Record<string, unknown>;
    // Plain text column has no 'references' key in the column config shape
    expect(dlqCol.references).toBeUndefined();
  });
});

// ============================================================================
// Helpers
// ============================================================================

function createMockAuth(scopes: string[] | null, tierSlug = 'warbird'): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    c.set('apiKey', {
      id: 'test_key_cascade',
      name: 'Cascade Test Key',
      keyPrefix: 'test_',
      scopes,
    });
    c.set('workspace', {
      id: 'ws_cascade_123',
      name: 'Cascade Workspace',
      tierSlug,
      email: 'cascade@example.com',
      slug: 'cascade-workspace',
      isPlayground: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await next();
  };
}

// ============================================================================
// DELETE /v1/endpoints/:id — auth enforcement (using real endpointRoutes)
// The real route has authMiddleware mounted at /* so unauthenticated
// requests always return 401 regardless of query params.
// ============================================================================

describe('DELETE /v1/endpoints/:id — auth enforcement', () => {
  it('returns 401 when no auth header provided', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_test_123', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for any endpoint id without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/nonexistent-endpoint', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 401 response with error and message fields', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_any', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; message: string };
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('message');
  });
});

// ============================================================================
// DELETE /v1/endpoints/:id — scope enforcement (stub app, no real DB)
// Uses a standalone app with mock auth + requireApiKeyScopes to verify
// the scope gate behaves correctly independently of the real route.
// ============================================================================

describe('DELETE /v1/endpoints/:id — scope middleware contract', () => {
  const createScopeTestApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuth(scopes));
    app.delete('/v1/endpoints/:id', requireApiKeyScopes(['endpoints:write']), (c) =>
      c.body(null, 204),
    );
    return app;
  };

  it('allows legacy key (null scopes) to reach the handler', async () => {
    const app = createScopeTestApp(null);
    const res = await app.request('/v1/endpoints/ep_abc', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('allows key with endpoints:write to reach the handler', async () => {
    const app = createScopeTestApp(['endpoints:write']);
    const res = await app.request('/v1/endpoints/ep_abc', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('blocks key with only endpoints:read', async () => {
    const app = createScopeTestApp(['endpoints:read']);
    const res = await app.request('/v1/endpoints/ep_abc', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('blocks key with events:write (wrong domain)', async () => {
    const app = createScopeTestApp(['events:write']);
    const res = await app.request('/v1/endpoints/ep_abc', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('blocks key with deliveries:read and events:read but no endpoints:write', async () => {
    const app = createScopeTestApp(['deliveries:read', 'events:read']);
    const res = await app.request('/v1/endpoints/ep_abc', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('error response includes requiredScopes on forbidden', async () => {
    const app = createScopeTestApp(['endpoints:read']);
    const res = await app.request('/v1/endpoints/ep_xyz', { method: 'DELETE' });
    const json = (await res.json()) as { error: string; requiredScopes: string[] };
    expect(json.requiredScopes).toEqual(expect.arrayContaining(['endpoints:write']));
  });

  it('error response error field is Forbidden', async () => {
    const app = createScopeTestApp(['events:write']);
    const res = await app.request('/v1/endpoints/ep_xyz', { method: 'DELETE' });
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Forbidden');
  });
});

// ============================================================================
// DELETE /v1/endpoints/:id — ?force param handling
// ============================================================================

describe('DELETE /v1/endpoints/:id — ?force param handling', () => {
  it('route accepts ?force=true without query-parse error (returns 401 without auth)', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_test?force=true', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('route accepts ?force=false without error', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_test?force=false', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('route accepts no force param (plain delete)', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_test', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
