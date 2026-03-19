import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import authRoutes from '../routes/auth';

describe('GET /v1/auth/github', () => {
  it('should return 503 when GitHub OAuth is not configured', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/github');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /v1/auth/google', () => {
  it('should return 503 when Google OAuth is not configured', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/google');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /v1/auth/github/callback', () => {
  it('should return 400 when no code is provided', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/github/callback');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 503 when GitHub OAuth is not configured', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/github/callback?code=test-code');

    expect(res.status).toBe(503);
  });

  it('should return 400 when user denies authorization', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/github/callback?error=access_denied');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /v1/auth/google/callback', () => {
  it('should return 400 when no code is provided', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/google/callback');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 503 when Google OAuth is not configured', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/google/callback?code=test-code');

    expect(res.status).toBe(503);
  });

  it('should return 400 when user denies authorization', async () => {
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/google/callback?error=access_denied');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
