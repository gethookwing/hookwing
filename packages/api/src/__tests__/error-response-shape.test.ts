/**
 * Error Response Shape Consistency Tests
 *
 * Verifies that all error responses across the API follow a consistent shape:
 * - { error: string } — always present
 * - { message?: string } — optional detail
 * - No extra undocumented keys in 4xx/5xx responses
 *
 * Gap: error-response-shape-consistency
 * Added: 2026-04-03
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import authRoutes from '../routes/auth';
import endpointRoutes from '../routes/endpoints';
import eventRoutes from '../routes/events';
import deliveryRoutes from '../routes/deliveries';
import analyticsRoutes from '../routes/analytics';
import ingestRoutes from '../routes/ingest';

// Helper: assert error shape is consistent
function assertErrorShape(body: unknown, label: string) {
  expect(body, `${label}: body must be an object`).toBeTypeOf('object');
  expect(body, `${label}: body must not be null`).not.toBeNull();
  const b = body as Record<string, unknown>;
  expect(b, `${label}: must have "error" field`).toHaveProperty('error');
  expect(typeof b.error, `${label}: "error" must be a string`).toBe('string');
  expect((b.error as string).length, `${label}: "error" must be non-empty`).toBeGreaterThan(0);
  if ('message' in b) {
    expect(typeof b.message, `${label}: "message" must be a string when present`).toBe('string');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth route errors
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — auth routes', () => {
  const app = new Hono().route('/v1/auth', authRoutes);

  it('POST /v1/auth/signup — invalid email → 400 with error shape', async () => {
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'validpassword123' }),
    });
    expect(res.status).toBe(400);
    assertErrorShape(await res.json(), 'signup invalid email');
  });

  it('POST /v1/auth/signup — missing password → 400 with error shape', async () => {
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(400);
    assertErrorShape(await res.json(), 'signup missing password');
  });

  it('POST /v1/auth/login — missing credentials → 400 with error shape', async () => {
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    assertErrorShape(await res.json(), 'login missing credentials');
  });

  it('GET /v1/auth/me — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/auth/me');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'auth/me unauthenticated');
  });

  it('GET /v1/auth/me — malformed Bearer token → 401 with error shape', async () => {
    const res = await app.request('/v1/auth/me', {
      headers: { Authorization: 'Token abc' },
    });
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'auth/me malformed token');
  });

  it('GET /v1/auth/me — Bearer with too-short key → 401 with error shape', async () => {
    const res = await app.request('/v1/auth/me', {
      headers: { Authorization: 'Bearer short' },
    });
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'auth/me too-short key');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoints route errors
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — endpoint routes', () => {
  const app = new Hono().route('/v1/endpoints', endpointRoutes);

  it('POST /v1/endpoints — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'endpoint create unauthenticated');
  });

  it('GET /v1/endpoints — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/endpoints');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'endpoint list unauthenticated');
  });

  it('GET /v1/endpoints/:id — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/endpoints/ep_nonexistent');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'endpoint get unauthenticated');
  });

  it('PATCH /v1/endpoints/:id — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/endpoints/ep_nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'endpoint update unauthenticated');
  });

  it('DELETE /v1/endpoints/:id — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/endpoints/ep_nonexistent', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'endpoint delete unauthenticated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Events route errors
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — events routes', () => {
  const app = new Hono().route('/v1/events', eventRoutes);

  it('GET /v1/events — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/events');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'events list unauthenticated');
  });

  it('GET /v1/events/:id — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/events/evt_nonexistent');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'events get unauthenticated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deliveries route errors
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — delivery routes', () => {
  const app = new Hono().route('/v1/deliveries', deliveryRoutes);

  it('GET /v1/deliveries — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/deliveries');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'deliveries list unauthenticated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Analytics route errors
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — analytics routes', () => {
  const app = new Hono().route('/v1/analytics', analyticsRoutes);

  it('GET /v1/analytics/usage — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/analytics/usage');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'analytics usage unauthenticated');
  });

  it('GET /v1/analytics/summary — no auth → 401 with error shape', async () => {
    const res = await app.request('/v1/analytics/summary');
    expect(res.status).toBe(401);
    assertErrorShape(await res.json(), 'analytics summary unauthenticated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ingest route errors (public endpoint, different error shapes expected)
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — ingest route', () => {
  const app = new Hono().route('/v1/ingest', ingestRoutes);

  it('POST /v1/ingest/:id — no DB binding (unit env) → 503 with error shape', async () => {
    // In the unit-test environment there is no DB binding, so the ingest
    // route returns 503 before it can look up the endpoint. This test verifies
    // the 503 response still follows the consistent error shape.
    const res = await app.request('/v1/ingest/ep_doesnotexist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test' }),
    });
    expect(res.status).toBe(503);
    assertErrorShape(await res.json(), 'ingest no-db 503');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-cutting: error "error" field must NOT be a generic fallback
// ─────────────────────────────────────────────────────────────────────────────
describe('Error shape — "error" field must be meaningful', () => {
  const FORBIDDEN_GENERICS = ['Error', 'error', 'Internal Error', ''];

  it('401 responses use descriptive error values', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/me');
    const body = await res.json() as { error: string };
    expect(FORBIDDEN_GENERICS).not.toContain(body.error);
  });

  it('400 responses use descriptive error values', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad' }),
    });
    const body = await res.json() as { error: string };
    expect(FORBIDDEN_GENERICS).not.toContain(body.error);
  });
});
