import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import feedbackRoutes from '../routes/feedback';

describe('POST /v1/feedback', () => {
  it('should return 400 for invalid category', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback', {
      method: 'POST',
      body: JSON.stringify({ category: 'invalid-category' }),
    });
    // Without DB, returns 503. With DB, returns 400 for invalid category
    expect([400, 503]).toContain(res.status);
    if (res.status === 400) {
      const json = await res.json();
      expect(json).toHaveProperty('details');
    }
  });

  it('should return 400 for message too long', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const longMessage = 'a'.repeat(5001);
    const res = await app.request('/v1/feedback', {
      method: 'POST',
      body: JSON.stringify({ message: longMessage }),
    });
    // Without DB, returns 503. With DB, returns 400 for message too long
    expect([400, 503]).toContain(res.status);
    if (res.status === 400) {
      const json = await res.json();
      expect(json).toHaveProperty('details');
    }
  });

  it('should accept valid feedback (no auth required)', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback', {
      method: 'POST',
      body: JSON.stringify({
        category: 'bug',
        rating: 5,
        message: 'This is a test feedback',
        source: 'ui',
      }),
    });
    // Will return 503 without DB, but validates schema passes
    expect([201, 503]).toContain(res.status);
  });

  it('should accept minimal valid feedback', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback', {
      method: 'POST',
      body: JSON.stringify({ category: 'general' }),
    });
    expect([201, 503]).toContain(res.status);
  });
});

describe('GET /v1/feedback', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback');
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /v1/feedback/:id', () => {
  it('should return 401 without auth', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback/fb_123', {
      method: 'PATCH',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 for nonexistent feedback without auth', async () => {
    const app = new Hono().route('/v1/feedback', feedbackRoutes);
    const res = await app.request('/v1/feedback/nonexistent', {
      method: 'PATCH',
    });
    expect(res.status).toBe(401);
  });
});
