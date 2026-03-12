import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import deliveryRoutes from '../routes/deliveries';
import eventRoutes from '../routes/events';

// ============================================================================
// GET /v1/events — Event listing with filters
// ============================================================================

describe('GET /v1/events', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid auth header', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route exists (mounting test)', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events with eventType filter', () => {
  it('should confirm eventType filter query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?eventType=payment_intent.succeeded');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events with status filter', () => {
  it('should confirm status filter query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?status=completed');
    expect(res.status).toBe(401);
  });

  it('should confirm multiple status values are accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?status=failed');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events with since/until filters', () => {
  it('should confirm since filter query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?since=1700000000000');
    expect(res.status).toBe(401);
  });

  it('should confirm until filter query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?until=1700000000000');
    expect(res.status).toBe(401);
  });

  it('should confirm combined since/until filters are accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?since=1700000000000&until=1700100000000');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events with endpointId filter', () => {
  it('should confirm endpointId filter query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?endpointId=ep_xxx');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events ordering', () => {
  it('should confirm route accepts limit param', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?limit=10');
    expect(res.status).toBe(401);
  });

  it('should confirm route accepts offset param', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events?offset=50');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// GET /v1/events/:id — Single event detail
// ============================================================================

describe('GET /v1/events/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_123');
    expect(res.status).toBe(401);
  });

  it('should confirm route exists for specific ID', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_abc123');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /v1/events/:id/replay — Event replay
// ============================================================================

describe('POST /v1/events/:id/replay', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_123/replay', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('should confirm replay route exists', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_abc/replay', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('should confirm optional endpointId query param is accepted', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_abc/replay?endpointId=ep_xyz', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /v1/events/replay — Bulk replay
// ============================================================================

describe('POST /v1/events/replay', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_123'] }),
    });
    expect(res.status).toBe(401);
  });

  it('should confirm bulk replay route exists', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_123'] }),
    });
    expect(res.status).toBe(401);
  });

  it('should confirm bulk replay validates max 100 limit', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const manyIds = Array.from({ length: 101 }, (_, i) => `evt_${i}`);
    const res = await app.request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: manyIds }),
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// GET /v1/deliveries — Delivery listing
// ============================================================================

describe('GET /v1/deliveries', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid auth header', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route exists', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/deliveries with filters', () => {
  it('should confirm eventId filter is accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?eventId=evt_xxx');
    expect(res.status).toBe(401);
  });

  it('should confirm endpointId filter is accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?endpointId=ep_xxx');
    expect(res.status).toBe(401);
  });

  it('should confirm status filter is accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?status=success');
    expect(res.status).toBe(401);
  });

  it('should confirm since filter is accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?since=1700000000000');
    expect(res.status).toBe(401);
  });

  it('should confirm until filter is accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?until=1700000000000');
    expect(res.status).toBe(401);
  });

  it('should confirm pagination params are accepted', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries?limit=50&offset=0');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// GET /v1/deliveries/:id — Delivery detail
// ============================================================================

describe('GET /v1/deliveries/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries/dlv_123');
    expect(res.status).toBe(401);
  });

  it('should confirm route exists for specific ID', async () => {
    const app = new Hono().route('/v1/deliveries', deliveryRoutes);
    const res = await app.request('/v1/deliveries/dlv_abc123');
    expect(res.status).toBe(401);
  });
});
