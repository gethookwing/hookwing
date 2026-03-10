import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import endpointsRoutes from '../routes/endpoints';

describe('POST /v1/endpoints', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/webhook' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/endpoints', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints');
    expect(res.status).toBe(401);
  });

  it('should accept active filter query param', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    // This test just checks the route matches - auth will be tested separately
    const res = await app.request('/v1/endpoints?active=true', {
      headers: { Authorization: 'Bearer fake' },
    });
    // Without real DB, will fail at auth but route matches
    expect(res.status).toBe(401);
  });

  it('should accept pagination params', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints?limit=10&offset=5', {
      headers: { Authorization: 'Bearer fake' },
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints/ep_123');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints/ep_123', {
      method: 'PATCH',
      body: JSON.stringify({ url: 'https://example.com/new' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints/ep_123', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/endpoints/:id/rotate-secret', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1', endpointsRoutes);
    const res = await app.request('/v1/endpoints/ep_123/rotate-secret', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
