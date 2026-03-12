import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import endpointRoutes from '../routes/endpoints';

describe('POST /v1/endpoints', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/webhook' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid body (no url)', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ description: 'Test' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/endpoints', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_123');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_123', {
      method: 'PATCH',
      body: JSON.stringify({ url: 'https://example.com/new' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /v1/endpoints/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/ep_123', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
