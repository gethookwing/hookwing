import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import ingestRoutes from '../routes/ingest';

const makeApp = () => new Hono().route('/v1/ingest', ingestRoutes);

describe('POST /v1/ingest/:endpointId', () => {
  it('should be accessible without auth (public route)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test', {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
    });
    // No DB in test env → 503, but NOT 401 (route is public)
    expect(res.status).not.toBe(401);
  });

  it('should return 503 when DB is not configured', async () => {
    const res = await makeApp().request('/v1/ingest/ep_123', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    });
    expect(res.status).toBe(503);
  });

  it('should handle POST without body (no auth required)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test', {
      method: 'POST',
    });
    expect(res.status).not.toBe(401);
  });

  it('should return JSON error response', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test', {
      method: 'POST',
      body: '{}',
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
