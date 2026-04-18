import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import authRoutes from '../routes/auth';

describe('POST /v1/auth/login', () => {
  it('should return 400 for invalid email', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('should return 400 for missing email', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'password123' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing password', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 503 when DB is not configured (no env)', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    // Without DB configured, returns 503
    expect(res.status).toBe(503);
  });
});

describe('GET /v1/auth/me', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should require Authorization Bearer instead of x-api-key', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/me', {
      headers: {
        'x-api-key': 'hk_live_testkey1234567890abcdef',
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toBe('Missing Authorization header');
  });

  it('should return 401 with invalid API key format', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/me', {
      headers: {
        Authorization: 'Bearer hk_short',
      },
    });

    expect(res.status).toBe(401);
  });
});

describe('Login schema validation', () => {
  it('should accept valid login payload', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'validpassword' }),
    });

    // Will fail due to no DB, but passes validation
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Database not configured');
  });
});
