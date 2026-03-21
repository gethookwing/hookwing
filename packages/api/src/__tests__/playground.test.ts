import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import playgroundRoutes from '../routes/playground';

const makeApp = () => new Hono().route('/v1/playground', playgroundRoutes);

describe('POST /v1/playground/sessions', () => {
  it('should be accessible without auth (public route)', async () => {
    const res = await makeApp().request('/v1/playground/sessions', {
      method: 'POST',
    });
    // No DB in test env → 503, but NOT 401 (route is public)
    expect(res.status).not.toBe(401);
  });

  it('should return 503 when DB is not configured', async () => {
    const res = await makeApp().request('/v1/playground/sessions', {
      method: 'POST',
    });
    expect(res.status).toBe(503);
  });

  it('should confirm route is mounted (not 404)', async () => {
    const res = await makeApp().request('/v1/playground/sessions', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error response when DB unavailable', async () => {
    const res = await makeApp().request('/v1/playground/sessions', {
      method: 'POST',
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /v1/playground/sessions/:sessionId/events', () => {
  it('should be accessible without auth (public route)', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/events');
    // No DB → 503, but NOT 401
    expect(res.status).not.toBe(401);
  });

  it('should return 503 when DB is not configured', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/events');
    expect(res.status).toBe(503);
  });

  it('should confirm route is mounted (not 404)', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/events');
    expect(res.status).not.toBe(404);
  });

  it('should accept since query parameter', async () => {
    const res = await makeApp().request(
      '/v1/playground/sessions/play_test/events?since=1700000000000',
    );
    // Just check it's handled (503 due to no DB, but not 400)
    expect(res.status).not.toBe(400);
  });
});

describe('POST /v1/playground/sessions/:sessionId/test', () => {
  it('should be accessible without auth (public route)', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/test', {
      method: 'POST',
    });
    // No DB → 503, but NOT 401
    expect(res.status).not.toBe(401);
  });

  it('should return 503 when DB is not configured', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/test', {
      method: 'POST',
    });
    expect(res.status).toBe(503);
  });

  it('should confirm route is mounted (not 404)', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/test', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });

  it('should accept custom eventType and payload', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'custom.test',
        payload: { foo: 'bar' },
      }),
    });
    // Just check it's handled (503 due to no DB, but not 400)
    expect(res.status).not.toBe(400);
  });

  it('should use default eventType when not provided', async () => {
    const res = await makeApp().request('/v1/playground/sessions/play_test/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { test: true } }),
    });
    // Just check it's handled
    expect(res.status).not.toBe(400);
  });
});
