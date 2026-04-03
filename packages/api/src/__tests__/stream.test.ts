import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import streamRoutes from '../routes/stream';

describe('GET /v1/stream', () => {
  it('should return 401 without auth token', async () => {
    const app = new Hono().route('/v1/stream', streamRoutes);
    const res = await app.request('/v1/stream');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid auth token', async () => {
    const app = new Hono().route('/v1/stream', streamRoutes);
    const res = await app.request('/v1/stream', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with missing Bearer prefix', async () => {
    const app = new Hono().route('/v1/stream', streamRoutes);
    const res = await app.request('/v1/stream', {
      headers: { Authorization: 'hk_live_abc123' },
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted (not 404)', async () => {
    const app = new Hono().route('/v1/stream', streamRoutes);
    const res = await app.request('/v1/stream');
    // 401 means route exists but auth failed — not 404
    expect(res.status).not.toBe(404);
  });
});
