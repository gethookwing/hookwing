/**
 * Tests for event replay endpoints
 *
 * Routes covered:
 *   POST /v1/events/:id/replay   — Replay a single event
 *   POST /v1/events/replay       — Bulk replay (up to 50 events)
 *   GET  /v1/events/:id/deliveries — Delivery history for a specific event
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import eventRoutes from '../routes/events';

const makeApp = () => new Hono().route('/v1/events', eventRoutes);

// ============================================================================
// POST /v1/events/:id/replay — Single event replay
// ============================================================================

describe('POST /v1/events/:id/replay', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/evt_abc123/replay', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with malformed token', async () => {
    const res = await makeApp().request('/v1/events/evt_abc123/replay', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should return JSON error on 401', async () => {
    const res = await makeApp().request('/v1/events/evt_abc123/replay', {
      method: 'POST',
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/events/evt_abc123/replay', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });

  it('should require events:write scope (reflected as 401 without key)', async () => {
    // Without a valid key, we get 401 (auth required before scope check)
    const res = await makeApp().request('/v1/events/evt_test/replay', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should accept request with content-type header', async () => {
    const res = await makeApp().request('/v1/events/evt_test/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    // Still 401 (no auth) but route is reachable
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /v1/events/replay — Bulk replay
// ============================================================================

describe('POST /v1/events/replay (bulk)', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_1', 'evt_2'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventIds: ['evt_1'] }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_1'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error on 401', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_1'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should not be confused with single-event replay (different routes)', async () => {
    const singleRes = await makeApp().request('/v1/events/evt_123/replay', {
      method: 'POST',
    });
    const bulkRes = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_123'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Both should return 401 (auth required), not 404
    expect(singleRes.status).toBe(401);
    expect(bulkRes.status).toBe(401);
  });

  it('should return 401 with empty body', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// GET /v1/events/:id/deliveries — Delivery history for event
// ============================================================================

describe('GET /v1/events/:id/deliveries', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/deliveries');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/deliveries', {
      headers: { Authorization: 'Bearer bad_key' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/events/evt_abc/deliveries');
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error on 401', async () => {
    const res = await makeApp().request('/v1/events/evt_test/deliveries');
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should require events:read scope (returns 401 without key)', async () => {
    const res = await makeApp().request('/v1/events/evt_test/deliveries', {
      headers: { Authorization: 'Bearer invalid_key' },
    });
    expect(res.status).toBe(401);
  });

  it('should handle various event ID formats', async () => {
    const res = await makeApp().request('/v1/events/evt_01h7z9ab3cdef456/deliveries');
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
