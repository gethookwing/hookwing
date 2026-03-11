import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import authRoutes from '../routes/auth';

describe('POST /v1/auth/signup', () => {
  it('should return 400 for invalid email', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 400 for short password', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'short' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing email', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ password: 'password123' }),
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /v1/auth/keys', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/keys');
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/auth/keys', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /v1/auth/keys/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/keys/key_123', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
