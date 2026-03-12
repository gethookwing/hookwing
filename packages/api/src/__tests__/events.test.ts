import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import eventRoutes from '../routes/events';

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

  it('should return 401 with missing Authorization header', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route exists (mounting test)', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events');
    // Returns 401 which confirms the route is mounted and requires auth
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/events/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_123');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid auth header', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_123', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route exists for specific ID (mounting test)', async () => {
    const app = new Hono().route('/v1/events', eventRoutes);
    const res = await app.request('/v1/events/evt_abc123');
    // Returns 401 which confirms the route is mounted and requires auth
    expect(res.status).toBe(401);
  });
});
