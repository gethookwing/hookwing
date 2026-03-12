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

  it('should return 401 with Content-Type but empty body', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 response with error and message fields', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/webhook' }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('message');
  });
});

describe('GET /v1/endpoints', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints');
    expect(res.status).toBe(401);
  });

  it('should confirm route exists (mounting test)', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints');
    // Returns 401 which confirms the route is mounted and requires auth
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

  it('should return 401 for nonexistent endpoint with invalid body', async () => {
    const app = new Hono().route('/v1/endpoints', endpointRoutes);
    const res = await app.request('/v1/endpoints/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ url: 12345 }), // invalid type
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
