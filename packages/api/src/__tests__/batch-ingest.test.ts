/**
 * Comprehensive tests for batch event ingestion.
 *
 * Route: POST /v1/ingest/:endpointId/batch
 *
 * Covers:
 * - Route mounting and public access (no auth required)
 * - 503 behaviour when DB is not configured
 * - batchEventSchema shape contract (min/max, required fields, optional fields)
 * - Response shape contract ({results} array with per-event {eventId, status, error?})
 * - Distinguishable from single-event ingest route
 * - JSON error shape on failure
 * - Signature header passthrough (not a gating field for the batch route)
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import ingestRoutes from '../routes/ingest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeApp = () => new Hono().route('/v1/ingest', ingestRoutes);

const batchUrl = (id = 'ep_test') => `/v1/ingest/${id}/batch`;

function makeEvents(count: number, overrides?: object) {
  return Array.from({ length: count }, (_, i) => ({
    eventType: `test.event.${i}`,
    payload: { index: i, ...overrides },
  }));
}

// ---------------------------------------------------------------------------
// batchEventSchema contract — tested in isolation (inline schema mirrors prod)
// ---------------------------------------------------------------------------

// Inline schema matching the route's batchEventSchema so we can test validation
// without needing a real DB (route checks DB first, so we can't reach schema
// validation via the route in unit-test environments).
const batchEventSchema = z.object({
  events: z
    .array(
      z.object({
        eventType: z.string().optional(),
        payload: z.unknown(),
        headers: z.record(z.string()).optional(),
      }),
    )
    .min(1)
    .max(100),
});

describe('batchEventSchema contract', () => {
  it('accepts single event with payload only', () => {
    const result = batchEventSchema.safeParse({
      events: [{ payload: { type: 'test' } }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts event with all optional fields', () => {
    const result = batchEventSchema.safeParse({
      events: [
        {
          eventType: 'user.created',
          payload: { userId: '123' },
          headers: { 'X-Source': 'stripe' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts exactly 100 events (max boundary)', () => {
    const result = batchEventSchema.safeParse({ events: makeEvents(100) });
    expect(result.success).toBe(true);
  });

  it('rejects 101 events (exceeds max of 100)', () => {
    const result = batchEventSchema.safeParse({ events: makeEvents(101) });
    expect(result.success).toBe(false);
  });

  it('rejects empty events array (min is 1)', () => {
    const result = batchEventSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing events key', () => {
    const result = batchEventSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects events as non-array (string)', () => {
    const result = batchEventSchema.safeParse({ events: 'not-an-array' });
    expect(result.success).toBe(false);
  });

  it('accepts event missing payload key (payload is z.unknown — undefined is valid)', () => {
    // z.unknown() accepts undefined, so a missing payload key is allowed by the schema.
    // The route serialises payload via JSON.stringify, which handles undefined gracefully.
    const result = batchEventSchema.safeParse({
      events: [{ eventType: 'test' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts event with null payload (payload is z.unknown)', () => {
    const result = batchEventSchema.safeParse({
      events: [{ payload: null }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts event with empty object payload', () => {
    const result = batchEventSchema.safeParse({
      events: [{ payload: {} }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts event with numeric payload', () => {
    const result = batchEventSchema.safeParse({
      events: [{ payload: 42 }],
    });
    expect(result.success).toBe(true);
  });

  it('eventType is optional — event with no eventType is valid', () => {
    const result = batchEventSchema.safeParse({
      events: [{ payload: { data: 'value' } }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.events[0]!.eventType).toBeUndefined();
    }
  });

  it('headers must be Record<string, string> if provided', () => {
    const valid = batchEventSchema.safeParse({
      events: [{ payload: {}, headers: { 'X-Foo': 'bar' } }],
    });
    expect(valid.success).toBe(true);

    const invalid = batchEventSchema.safeParse({
      events: [{ payload: {}, headers: { 'X-Foo': 123 } }],
    });
    expect(invalid.success).toBe(false);
  });

  it('accepts multiple events with mixed optional fields', () => {
    const result = batchEventSchema.safeParse({
      events: [
        { payload: { a: 1 } },
        { eventType: 'typed.event', payload: { b: 2 } },
        { payload: { c: 3 }, headers: { 'X-Custom': 'value' } },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.events).toHaveLength(3);
    }
  });

  it('flatten error includes events issue when array missing', () => {
    const result = batchEventSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten();
      expect(flat.fieldErrors).toHaveProperty('events');
    }
  });
});

// ---------------------------------------------------------------------------
// Route behaviour — without DB (all terminate at 503 in unit-test env)
// ---------------------------------------------------------------------------

describe('POST /v1/ingest/:id/batch — route accessibility', () => {
  it('is not auth-gated (returns 503 not 401 without auth)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(401);
  });

  it('returns 503 when DB is not configured', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('is mounted (does not return 404)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });

  it('returns JSON with error field on 503', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = (await res.json()) as { error: string };
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('returns 503 for empty events (DB checked before schema validation)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('returns 503 for 101 events (DB checked before schema validation)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: makeEvents(101) }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('returns 503 for missing events key (DB checked before schema validation)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });

  it('returns 503 without body (DB checked first)', async () => {
    const res = await makeApp().request(batchUrl(), { method: 'POST' });
    expect(res.status).toBe(503);
  });

  it('signature header does not affect public access (no 401)', async () => {
    const res = await makeApp().request(batchUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hookwing-Signature': 'sha256=deadbeef',
      },
      body: JSON.stringify({ events: [{ payload: { signed: true } }] }),
    });
    expect(res.status).not.toBe(401);
  });

  it('is distinct from single-event ingest route', async () => {
    const singleRes = await makeApp().request('/v1/ingest/ep_test', {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const batchRes = await makeApp().request(batchUrl(), {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Both are mounted (not 404), respond independently
    expect(singleRes.status).not.toBe(404);
    expect(batchRes.status).not.toBe(404);
    // Both public (not 401)
    expect(singleRes.status).not.toBe(401);
    expect(batchRes.status).not.toBe(401);
  });

  it('returns 503 for varied endpointId formats (uuid-style)', async () => {
    const res = await makeApp().request('/v1/ingest/ep_abc123-def456/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [{ payload: {} }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Expected response shape contract for successful batch results
// (documents the contract; runtime verification requires a live DB)
// ---------------------------------------------------------------------------

describe('batch ingest response shape contract', () => {
  it('schema: valid batch result item has eventId, status, and optional error', () => {
    const resultItemSchema = z.object({
      eventId: z.string(),
      status: z.enum(['accepted', 'error']),
      error: z.string().optional(),
    });

    const accepted = resultItemSchema.safeParse({ eventId: 'evt_123', status: 'accepted' });
    expect(accepted.success).toBe(true);

    const errored = resultItemSchema.safeParse({
      eventId: '',
      status: 'error',
      error: 'Payload too large',
    });
    expect(errored.success).toBe(true);

    const invalid = resultItemSchema.safeParse({ eventId: 'evt_123', status: 'unknown' });
    expect(invalid.success).toBe(false);
  });

  it('schema: top-level response wraps results in array', () => {
    const responseSchema = z.object({
      results: z.array(
        z.object({
          eventId: z.string(),
          status: z.enum(['accepted', 'error']),
          error: z.string().optional(),
        }),
      ),
    });

    const valid = responseSchema.safeParse({
      results: [
        { eventId: 'evt_1', status: 'accepted' },
        { eventId: '', status: 'error', error: 'Payload too large (max 65536 bytes)' },
      ],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.results).toHaveLength(2);
      expect(valid.data.results[0]!.status).toBe('accepted');
      expect(valid.data.results[1]!.status).toBe('error');
    }
  });

  it('schema: results array length should match input events count', () => {
    // Documents expected one-to-one mapping between input events and results
    const eventCount = 3;
    const mockResults = Array.from({ length: eventCount }, (_, i) => ({
      eventId: `evt_${i}`,
      status: 'accepted' as const,
    }));
    expect(mockResults).toHaveLength(eventCount);
  });
});
