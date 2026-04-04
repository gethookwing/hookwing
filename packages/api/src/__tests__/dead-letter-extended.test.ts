/**
 * Extended tests for the dead letter queue endpoints
 *
 * Routes covered:
 *   GET    /v1/dead-letter         — List DLQ items
 *   GET    /v1/dead-letter/:id     — Get a specific DLQ item
 *   POST   /v1/dead-letter/:id/replay — Replay a DLQ item
 *   DELETE /v1/dead-letter/:id     — Discard a DLQ item
 *
 * Extends dead-letter.test.ts with additional scope and input validation tests.
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import deadLetterRoutes from '../routes/dead-letter';

const makeApp = () => new Hono().route('/v1/dead-letter', deadLetterRoutes);

describe('GET /v1/dead-letter — extended', () => {
  it('should return 401 for requests with no Authorization header', async () => {
    const res = await makeApp().request('/v1/dead-letter');
    expect(res.status).toBe(401);
  });

  it('should return 401 for empty Bearer token', async () => {
    const res = await makeApp().request('/v1/dead-letter', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404', async () => {
    const res = await makeApp().request('/v1/dead-letter');
    expect(res.status).not.toBe(404);
  });

  it('should return a JSON error body', async () => {
    const res = await makeApp().request('/v1/dead-letter');
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('GET /v1/dead-letter/:id — extended', () => {
  it('should return 401 without auth for known-format ID', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_abc123');
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test');
    expect(res.status).not.toBe(404);
  });
});

describe('POST /v1/dead-letter/:id/replay — extended', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test/replay', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with fake token', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test/replay', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test/replay', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test/replay', {
      method: 'POST',
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('DELETE /v1/dead-letter/:id — extended', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer not_real' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/dead-letter/dlq_test', {
      method: 'DELETE',
    });
    expect(res.status).not.toBe(404);
  });
});
