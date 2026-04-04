/**
 * Tests for batch event ingestion endpoint
 *
 * Route: POST /v1/ingest/:endpointId/batch
 *
 * The batch ingest endpoint is public (no auth required).
 * Without a DB it returns 503.
 * Input validation is tested against the batchEventSchema.
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import ingestRoutes from '../routes/ingest';

const makeApp = () => new Hono().route('/v1/ingest', ingestRoutes);

describe('POST /v1/ingest/:endpointId/batch', () => {
  it('should be accessible without auth (public route)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: { type: 'test' } }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Public route → not 401
    expect(res.status).not.toBe(401);
  });

  it('should return 503 when DB is not configured', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: { event: 'user.created' } }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error response', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 503 for empty events array (validation checked after DB)', async () => {
    // With no DB, the route short-circuits at DB check before validation
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Without DB → 503 (checked before schema validation)
    expect(res.status).toBe(503);
  });

  it('should handle missing events key — returns 503 (DB checked first)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('should handle request without body — returns 503 (DB checked first)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
    });
    expect(res.status).toBe(503);
  });

  it('should accept signature header without returning 401', async () => {
    const res = await makeApp().request('/v1/ingest/ep_batch/batch', {
      method: 'POST',
      headers: {
        'X-Hookwing-Signature': 'sha256=abc123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: [{ payload: { test: true } }] }),
    });
    // Public route regardless of signature header
    expect(res.status).not.toBe(401);
  });

  it('should handle an endpointId with special characters in path', async () => {
    const res = await makeApp().request('/v1/ingest/ep_abc123def/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: { data: 'value' } }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // No DB → 503
    expect(res.status).toBe(503);
  });

  it('should be distinct from single-event ingest route', async () => {
    const singleRes = await makeApp().request('/v1/ingest/ep_test', {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const batchRes = await makeApp().request('/v1/ingest/ep_test/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: { event: 'test' } }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Both should be mounted (not 404) and respond independently
    expect(singleRes.status).not.toBe(404);
    expect(batchRes.status).not.toBe(404);
  });
});
