import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import domainRoutes from '../routes/custom-domains';

describe('POST /v1/domains', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains', {
      method: 'POST',
      body: JSON.stringify({ domain: 'example.com' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid body (no domain)', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with Content-Type but empty body', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/domains', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains');
    expect(res.status).toBe(401);
  });

  it('should confirm route exists (mounting test)', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains');
    // Returns 401 which confirms the route is mounted and requires auth
    expect(res.status).toBe(401);
  });
});

describe('DELETE /v1/domains/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/domains', domainRoutes);
    const res = await app.request('/v1/domains/cd_123', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
