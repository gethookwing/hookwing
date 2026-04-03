/**
 * Tests for feedback admin endpoints (authenticated routes)
 *
 * Routes covered:
 *   GET   /v1/feedback       — List feedback (authenticated)
 *   PATCH /v1/feedback/:id   — Mark feedback as resolved (authenticated)
 *
 * Note: POST /v1/feedback (public submission) is already covered in feedback.test.ts
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import feedbackRoutes from '../routes/feedback';

const makeApp = () => new Hono().route('/v1/feedback', feedbackRoutes);

// ============================================================================
// GET /v1/feedback
// ============================================================================

describe('GET /v1/feedback', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/feedback');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/feedback', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/feedback');
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/feedback');
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should require Bearer auth scheme (not Basic)', async () => {
    const res = await makeApp().request('/v1/feedback', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('should be a GET route (not 405 for GET)', async () => {
    const res = await makeApp().request('/v1/feedback', { method: 'GET' });
    expect(res.status).not.toBe(405);
  });
});

// ============================================================================
// PATCH /v1/feedback/:id
// ============================================================================

describe('PATCH /v1/feedback/:id', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/feedback/fb_123', {
      method: 'PATCH',
      body: JSON.stringify({ resolved: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/feedback/fb_123', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resolved: true }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/feedback/fb_test', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/feedback/fb_test', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should handle different feedback ID formats', async () => {
    const res = await makeApp().request('/v1/feedback/some-long-feedback-id-abc', {
      method: 'PATCH',
    });
    expect(res.status).toBe(401);
  });
});
