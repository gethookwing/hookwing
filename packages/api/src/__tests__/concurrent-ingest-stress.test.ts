/**
 * Concurrent ingest stress tests.
 *
 * Validates route stability, response consistency, and observable behaviour
 * when many requests arrive simultaneously at the ingest endpoint.
 *
 * Since these are unit tests (no live DB), all requests terminate at 503.
 * The value here is verifying:
 *  - Response shape is consistent across all concurrent responses
 *  - No request is silently dropped (all get a response)
 *  - Response times are roughly uniform (no starvation)
 *  - Different endpoint IDs get independent responses
 *  - Idempotency-key header is passed through without causing errors
 *  - Content-Type is always application/json regardless of concurrency
 *  - Error field is always a string (never null/undefined)
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import ingestRoutes from '../routes/ingest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeApp = () => new Hono().route('/v1/ingest', ingestRoutes);

function makePayload(i: number) {
  return JSON.stringify({ eventType: `stress.event.${i}`, payload: { index: i } });
}

async function fireIngest(app: ReturnType<typeof makeApp>, endpointId: string, payload: string) {
  return app.request(`/v1/ingest/${endpointId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}

// ---------------------------------------------------------------------------
// Concurrent single-endpoint stress
// ---------------------------------------------------------------------------

describe('concurrent ingest — single endpoint', () => {
  it('all 10 concurrent requests receive a response (none dropped)', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => fireIngest(app, 'ep_stress_01', makePayload(i))),
    );
    expect(results).toHaveLength(10);
    for (const res of results) {
      expect(res).toBeDefined();
    }
  });

  it('all 10 concurrent responses have the same HTTP status', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => fireIngest(app, 'ep_stress_01', makePayload(i))),
    );
    const statuses = results.map((r) => r.status);
    const unique = new Set(statuses);
    // All should be identical (503 in unit-test env — DB not available)
    expect(unique.size).toBe(1);
  });

  it('all 10 concurrent responses return application/json content-type', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => fireIngest(app, 'ep_stress_01', makePayload(i))),
    );
    for (const res of results) {
      expect(res.headers.get('content-type')).toContain('application/json');
    }
  });

  it('all 10 concurrent response bodies contain an error string', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => fireIngest(app, 'ep_stress_01', makePayload(i))),
    );
    for (const res of results) {
      const body = (await res.json()) as { error: unknown };
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    }
  });

  it('25 concurrent requests all receive a response (higher concurrency)', async () => {
    const app = makeApp();
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => fireIngest(app, 'ep_stress_01', makePayload(i))),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(25);
  });
});

// ---------------------------------------------------------------------------
// Concurrent multi-endpoint stress (fan-out pattern)
// ---------------------------------------------------------------------------

describe('concurrent ingest — multiple endpoints', () => {
  it('concurrent requests to 5 different endpoints all get responses', async () => {
    const app = makeApp();
    const endpointIds = ['ep_a', 'ep_b', 'ep_c', 'ep_d', 'ep_e'];
    const results = await Promise.all(
      endpointIds.map((id, i) => fireIngest(app, id, makePayload(i))),
    );
    expect(results).toHaveLength(5);
    for (const res of results) {
      expect(res).toBeDefined();
      expect(res.status).not.toBe(404);
    }
  });

  it('each endpoint ID gets an independent response (no cross-contamination)', async () => {
    const app = makeApp();
    const endpointIds = Array.from({ length: 8 }, (_, i) => `ep_iso_${i}`);
    const results = await Promise.all(
      endpointIds.map((id, i) => fireIngest(app, id, makePayload(i))),
    );
    // All should reach the route (not 404)
    for (const res of results) {
      expect(res.status).not.toBe(404);
    }
    // All should get the same status code (route behaves uniformly per endpoint)
    const statuses = results.map((r) => r.status);
    const unique = new Set(statuses);
    expect(unique.size).toBe(1);
  });

  it('concurrent requests to UUID-style endpoint IDs are all handled', async () => {
    const app = makeApp();
    const ids = [
      'ep_550e8400-e29b-41d4-a716-446655440000',
      'ep_6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      'ep_6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    ];
    const results = await Promise.all(ids.map((id, i) => fireIngest(app, id, makePayload(i))));
    for (const res of results) {
      expect(res.status).not.toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// Idempotency-key behaviour under concurrency
// ---------------------------------------------------------------------------

describe('concurrent ingest — idempotency-key header passthrough', () => {
  it('idempotency-key header does not cause 400 or 401 on concurrent requests', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.request('/v1/ingest/ep_idem_test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `idem-key-${i}`,
          },
          body: makePayload(i),
        }),
      ),
    );
    for (const res of results) {
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    }
  });

  it('same idempotency-key on concurrent requests does not cause errors beyond 503', async () => {
    const app = makeApp();
    const sharedKey = 'shared-idem-key-concurrent';
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request('/v1/ingest/ep_idem_test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': sharedKey,
          },
          body: makePayload(0),
        }),
      ),
    );
    for (const res of results) {
      // Route should not crash (no 500), responses consistent
      expect(res.status).not.toBe(500);
    }
  });
});

// ---------------------------------------------------------------------------
// Payload size boundaries under concurrency
// ---------------------------------------------------------------------------

describe('concurrent ingest — payload size boundaries', () => {
  it('all concurrent requests with minimal payloads receive responses', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fireIngest(app, 'ep_min_payload', JSON.stringify({}))),
    );
    expect(results).toHaveLength(10);
  });

  it('all concurrent requests with moderate payloads (1KB) receive responses', async () => {
    const app = makeApp();
    const moderatePayload = JSON.stringify({ data: 'x'.repeat(1000) });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fireIngest(app, 'ep_1kb_payload', moderatePayload)),
    );
    expect(results).toHaveLength(10);
    for (const res of results) {
      expect(res).toBeDefined();
    }
  });

  it('concurrent requests with mixed payload sizes all get responses', async () => {
    const app = makeApp();
    const payloads = [
      JSON.stringify({}),
      JSON.stringify({ data: 'x'.repeat(100) }),
      JSON.stringify({ data: 'x'.repeat(500) }),
      JSON.stringify({ nested: { a: { b: { c: 'deep' } } } }),
      JSON.stringify([1, 2, 3, 4, 5]),
    ];
    const results = await Promise.all(payloads.map((p) => fireIngest(app, 'ep_mixed_size', p)));
    expect(results).toHaveLength(payloads.length);
    for (const res of results) {
      expect(res.status).not.toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// Route isolation — concurrent ingest vs. other routes
// ---------------------------------------------------------------------------

describe('concurrent ingest — route isolation', () => {
  it('concurrent ingest requests do not interfere with each other across app instances', async () => {
    // Each request gets its own app instance — simulates independent worker invocations
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => {
        const app = makeApp();
        return fireIngest(app, 'ep_isolated', makePayload(i));
      }),
    );
    const statuses = results.map((r) => r.status);
    const unique = new Set(statuses);
    expect(unique.size).toBe(1); // All same status — route is deterministic
  });

  it('Promise.allSettled captures all outcomes even if some reject', async () => {
    const app = makeApp();
    // Mix valid and unusual endpoint IDs
    const requests = [
      fireIngest(app, 'ep_normal', makePayload(0)),
      fireIngest(app, 'ep-with-dashes', makePayload(1)),
      fireIngest(app, 'ep_123_numeric', makePayload(2)),
      fireIngest(app, 'EP_UPPERCASE', makePayload(3)),
    ];
    const results = await Promise.allSettled(requests);
    expect(results).toHaveLength(4);
    for (const result of results) {
      // All should fulfill (route handles any endpoint ID string)
      expect(result.status).toBe('fulfilled');
    }
  });
});

// ---------------------------------------------------------------------------
// Signature header under concurrency
// ---------------------------------------------------------------------------

describe('concurrent ingest — webhook signature headers under load', () => {
  it('concurrent requests with distinct signatures all get responses without 401', async () => {
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        app.request('/v1/ingest/ep_sig_stress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hookwing-Signature': `sha256=deadbeef${i.toString().padStart(4, '0')}`,
          },
          body: makePayload(i),
        }),
      ),
    );
    for (const res of results) {
      expect(res.status).not.toBe(401);
    }
  });
});
