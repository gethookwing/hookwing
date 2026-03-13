/**
 * PROD-87: Dashboard Flow Tests
 *
 * Verifies the API routes that power the customer dashboard:
 * signup → login → endpoints CRUD → events → deliveries → analytics → keys
 *
 * All routes return 503 (no DB) or 401 (no auth) in test env.
 * Tests verify route contracts, auth requirements, response shapes, and method handling.
 */

import { describe, expect, it } from 'vitest';
import app from '../index';

function createApp() {
  return app;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const AUTH_HEADERS = { Authorization: 'Bearer hk_live_testkey1234567890abcdef' };

// ============================================================================
// Signup Flow
// ============================================================================

describe('Dashboard Flow: Signup', () => {
  it('POST /v1/auth/signup should accept valid payload', async () => {
    const res = await createApp().request('/v1/auth/signup', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'securepassword123',
        workspaceName: 'Test Workspace',
      }),
    });
    // 503 (no DB) — but NOT 400 (payload is valid) or 404 (route exists)
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(404);
  });

  it('POST /v1/auth/signup should reject invalid email', async () => {
    const res = await createApp().request('/v1/auth/signup', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'not-an-email', password: 'securepassword123' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/signup should reject missing password', async () => {
    const res = await createApp().request('/v1/auth/signup', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/signup should not require auth', async () => {
    const res = await createApp().request('/v1/auth/signup', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'test@example.com', password: 'pass12345678' }),
    });
    expect(res.status).not.toBe(401);
  });
});

// ============================================================================
// Login Flow
// ============================================================================

describe('Dashboard Flow: Login', () => {
  it('POST /v1/auth/login should accept valid credentials', async () => {
    const res = await createApp().request('/v1/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(404);
  });

  it('POST /v1/auth/login should reject invalid email format', async () => {
    const res = await createApp().request('/v1/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'bad-email', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/login should reject missing fields', async () => {
    const res = await createApp().request('/v1/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/login should not require auth header', async () => {
    const res = await createApp().request('/v1/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    expect(res.status).not.toBe(401);
  });
});

// ============================================================================
// Endpoints CRUD (requires auth)
// ============================================================================

describe('Dashboard Flow: Endpoints', () => {
  it('GET /v1/endpoints should require auth', async () => {
    const res = await createApp().request('/v1/endpoints');
    expect(res.status).toBe(401);
  });

  it('GET /v1/endpoints should accept auth header', async () => {
    const res = await createApp().request('/v1/endpoints', {
      headers: AUTH_HEADERS,
    });
    // Auth middleware tries to validate key against DB — returns 401, 500, or 503 without DB
    expect([401, 500, 503]).toContain(res.status);
  });

  it('POST /v1/endpoints should require auth', async () => {
    const res = await createApp().request('/v1/endpoints', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ url: 'https://example.com/webhook' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /v1/endpoints/:id should require auth', async () => {
    const res = await createApp().request('/v1/endpoints/ep_test123');
    expect(res.status).toBe(401);
  });

  it('PATCH /v1/endpoints/:id should require auth', async () => {
    const res = await createApp().request('/v1/endpoints/ep_test123', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ description: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/endpoints/:id should require auth', async () => {
    const res = await createApp().request('/v1/endpoints/ep_test123', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Events (requires auth)
// ============================================================================

describe('Dashboard Flow: Events', () => {
  it('GET /v1/events should require auth', async () => {
    const res = await createApp().request('/v1/events');
    expect(res.status).toBe(401);
  });

  it('GET /v1/events/:id should require auth', async () => {
    const res = await createApp().request('/v1/events/evt_test123');
    expect(res.status).toBe(401);
  });

  it('GET /v1/events/:id/deliveries should require auth', async () => {
    const res = await createApp().request('/v1/events/evt_test123/deliveries');
    expect(res.status).toBe(401);
  });

  it('POST /v1/events/:id/replay should require auth', async () => {
    const res = await createApp().request('/v1/events/evt_test123/replay', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/events/replay (bulk) should require auth', async () => {
    const res = await createApp().request('/v1/events/replay', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ eventIds: ['evt_1', 'evt_2'] }),
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Deliveries (requires auth)
// ============================================================================

describe('Dashboard Flow: Deliveries', () => {
  it('GET /v1/deliveries should require auth', async () => {
    const res = await createApp().request('/v1/deliveries');
    expect(res.status).toBe(401);
  });

  it('GET /v1/deliveries/:id should require auth', async () => {
    const res = await createApp().request('/v1/deliveries/del_test123');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Analytics (requires auth)
// ============================================================================

describe('Dashboard Flow: Analytics', () => {
  it('GET /v1/analytics/usage should require auth', async () => {
    const res = await createApp().request('/v1/analytics/usage');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/summary should require auth', async () => {
    const res = await createApp().request('/v1/analytics/summary');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// API Keys (requires auth)
// ============================================================================

describe('Dashboard Flow: API Keys', () => {
  it('GET /v1/auth/keys should require auth', async () => {
    const res = await createApp().request('/v1/auth/keys');
    expect(res.status).toBe(401);
  });

  it('POST /v1/auth/keys should require auth', async () => {
    const res = await createApp().request('/v1/auth/keys', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Test Key' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/auth/keys/:id should require auth', async () => {
    const res = await createApp().request('/v1/auth/keys/key_test123', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Public Routes (no auth required)
// ============================================================================

describe('Dashboard Flow: Public Routes', () => {
  it('GET /health should not require auth', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.0.1');
  });

  it('GET /tiers should not require auth', async () => {
    const res = await createApp().request('/tiers');
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('GET /tiers/paper-plane should return tier details', async () => {
    const res = await createApp().request('/tiers/paper-plane');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe('paper-plane');
    expect(body).toHaveProperty('limits');
    expect(body).toHaveProperty('features');
  });

  it('GET /tiers/nonexistent should return 404', async () => {
    const res = await createApp().request('/tiers/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /v1/ingest/:endpointId should not require auth', async () => {
    const res = await createApp().request('/v1/ingest/ep_test123', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ test: true }),
    });
    expect(res.status).not.toBe(401);
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Dashboard Flow: Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await createApp().request('/v1/nonexistent');
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Not found');
  });

  it('should return JSON for all error responses', async () => {
    const routes = ['/v1/nonexistent', '/v1/endpoints', '/v1/events', '/v1/deliveries'];
    for (const url of routes) {
      const res = await createApp().request(url);
      expect(res.headers.get('content-type')).toContain('application/json');
    }
  });

  it('auth errors should include error field', async () => {
    const res = await createApp().request('/v1/endpoints');
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });
});
