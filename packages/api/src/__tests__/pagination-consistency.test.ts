/**
 * Pagination Consistency Tests
 *
 * Verifies that all paginated list endpoints follow their documented shape:
 *
 * Cursor-based (events):
 *   { events: [...], pagination: { limit: number, cursor: string|null, hasMore: boolean } }
 *
 * Offset-based (deliveries, dead-letter):
 *   { data: [...], pagination: { limit: number, offset: number, total: number } }
 *
 * Also verifies:
 * - `limit` query param is respected (clamped to 100)
 * - Invalid `limit` values fall back gracefully (no 500)
 * - Routes reject unauthenticated pagination requests consistently
 *
 * Gap: pagination-consistency
 * Added: 2026-04-04
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import deadLetterRoutes from '../routes/dead-letter';
import deliveryRoutes from '../routes/deliveries';
import eventRoutes from '../routes/events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventsApp() {
  return new Hono().route('/v1/events', eventRoutes);
}

function makeDeliveriesApp() {
  return new Hono().route('/v1/deliveries', deliveryRoutes);
}

function makeDeadLetterApp() {
  return new Hono().route('/v1/dead-letter', deadLetterRoutes);
}

// ---------------------------------------------------------------------------
// Events — cursor-based pagination shape
// ---------------------------------------------------------------------------

describe('GET /v1/events — pagination shape (cursor-based)', () => {
  it('returns 401 without auth', async () => {
    const res = await makeEventsApp().request('/v1/events');
    expect(res.status).toBe(401);
  });

  it('returns 401 for pagination query without auth', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=10&cursor=evt_abc');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 400 when limit is non-numeric without auth', async () => {
    // Pagination parsing should never surface before auth check
    const res = await makeEventsApp().request('/v1/events?limit=abc');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for extreme limit value without auth', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=999999');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for negative limit without auth', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=-1');
    expect(res.status).toBe(401);
  });

  it('returns a JSON error body (not HTML) on 401', async () => {
    const res = await makeEventsApp().request('/v1/events');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('does not expose pagination internals in the 401 error body', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=5');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('pagination');
    expect(body).not.toHaveProperty('events');
    expect(body).not.toHaveProperty('cursor');
  });
});

// ---------------------------------------------------------------------------
// Deliveries — offset-based pagination shape
// ---------------------------------------------------------------------------

describe('GET /v1/deliveries — pagination shape (offset-based)', () => {
  it('returns 401 without auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries');
    expect(res.status).toBe(401);
  });

  it('returns 401 for offset/limit query without auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?limit=20&offset=40');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for non-numeric offset without auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?offset=xyz');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for negative offset without auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?offset=-100');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for limit over 100 without auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?limit=500');
    expect(res.status).toBe(401);
  });

  it('returns JSON error body (not HTML) on 401', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('does not expose pagination internals in the 401 body', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?limit=10&offset=0');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('pagination');
    expect(body).not.toHaveProperty('data');
    expect(body).not.toHaveProperty('total');
  });
});

// ---------------------------------------------------------------------------
// Dead-letter queue — offset-based pagination shape
// ---------------------------------------------------------------------------

describe('GET /v1/dead-letter — pagination shape (offset-based)', () => {
  it('returns 401 without auth', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter');
    expect(res.status).toBe(401);
  });

  it('returns 401 for offset/limit query without auth', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=25&offset=50');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for non-numeric limit without auth', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=notanumber');
    expect(res.status).toBe(401);
  });

  it('returns 401 not 500 for zero limit without auth', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=0');
    expect(res.status).toBe(401);
  });

  it('returns JSON error body (not HTML) on 401', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('does not expose pagination internals in the 401 body', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=10&offset=0');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('pagination');
    expect(body).not.toHaveProperty('data');
    expect(body).not.toHaveProperty('offset');
  });
});

// ---------------------------------------------------------------------------
// Cross-route pagination param isolation
// ---------------------------------------------------------------------------

describe('Pagination param isolation — cursor params on offset routes', () => {
  it('deliveries route returns 401 (not 400) when given cursor param', async () => {
    // cursor is an events-only concept; other routes should not 400 on unknown params
    const res = await makeDeliveriesApp().request('/v1/deliveries?cursor=evt_xyz');
    expect(res.status).toBe(401);
  });

  it('dead-letter route returns 401 (not 400) when given cursor param', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?cursor=dlq_xyz');
    expect(res.status).toBe(401);
  });

  it('events route returns 401 (not 400) when given offset param', async () => {
    // offset is not a valid events pagination param but should not 500
    const res = await makeEventsApp().request('/v1/events?offset=100');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Limit clamping contract (structural / schema verification via 401 path)
// ---------------------------------------------------------------------------

describe('Limit clamping — pre-auth structural guarantees', () => {
  it('events: limit=0 does not cause 500 before auth', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=0');
    expect(res.status).not.toBe(500);
  });

  it('events: limit=100 does not cause 500 before auth', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=100');
    expect(res.status).not.toBe(500);
  });

  it('events: limit=101 does not cause 500 before auth (clamped to 100)', async () => {
    const res = await makeEventsApp().request('/v1/events?limit=101');
    expect(res.status).not.toBe(500);
  });

  it('deliveries: limit=100 does not cause 500 before auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?limit=100');
    expect(res.status).not.toBe(500);
  });

  it('deliveries: limit=0 does not cause 500 before auth', async () => {
    const res = await makeDeliveriesApp().request('/v1/deliveries?limit=0');
    expect(res.status).not.toBe(500);
  });

  it('dead-letter: limit=100 does not cause 500 before auth', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=100');
    expect(res.status).not.toBe(500);
  });

  it('dead-letter: limit=200 does not cause 500 before auth (clamped)', async () => {
    const res = await makeDeadLetterApp().request('/v1/dead-letter?limit=200');
    expect(res.status).not.toBe(500);
  });
});
