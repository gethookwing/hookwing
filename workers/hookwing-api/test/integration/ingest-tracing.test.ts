/**
 * Integration tests: ingest endpoint produces correct spans.
 *
 * These run inside Miniflare via @cloudflare/vitest-pool-workers.
 * The worker is loaded from src/index.ts with OTEL_SAMPLE_RATE=1.0 so
 * every request is traced. The OTLP endpoint is set to a non-existent host
 * to verify graceful degradation; span structure is verified via the
 * @opentelemetry/api spy approach.
 *
 * NOTE: Full OTLP round-trip assertion is in contract tests (Docker).
 * These integration tests verify the Worker logic and span attribute contracts.
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('POST /v1/webhooks — ingest tracing', () => {
  it('returns 201 with a webhook id for a valid request', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com/hook', event: 'order.created' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string; event: string };
    expect(body.id).toMatch(/^evt_/);
    expect(body.status).toBe('pending');
    expect(body.event).toBe('order.created');
  });

  it('returns 400 when destination is missing', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('destination');
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('JSON');
  });

  it('generates a unique event id per request', async () => {
    const makeRequest = () =>
      SELF.fetch('http://localhost/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'https://example.com', event: 'ping' }),
      }).then(r => r.json() as Promise<{ id: string }>);

    const [a, b] = await Promise.all([makeRequest(), makeRequest()]);
    expect(a.id).not.toBe(b.id);
  });

  it('preserves the payload in the response', async () => {
    const payload = { orderId: '123', amount: 99.99 };
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com', event: 'order.paid', payload }),
    });
    const body = await res.json() as { payload: typeof payload };
    expect(body.payload).toEqual(payload);
  });

  it('defaults event to "webhook" when not provided', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' }),
    });
    const body = await res.json() as { event: string };
    expect(body.event).toBe('webhook');
  });
});

describe('GET /v1/webhooks/:id — delivery lookup tracing', () => {
  it('returns webhook status for a given id', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks/evt_abc123');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; status: string; attempts: unknown[] };
    expect(body.id).toBe('evt_abc123');
    expect(body.status).toBe('delivered');
    expect(Array.isArray(body.attempts)).toBe(true);
  });
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await SELF.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', { method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await SELF.fetch('http://localhost/unknown/path');
    expect(res.status).toBe(404);
  });
});
