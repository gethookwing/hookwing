/**
 * Integration tests: OTel failures MUST NOT break webhook delivery.
 *
 * These verify Contract 6: Graceful Degradation.
 * The Worker is tested with a broken OTLP endpoint — webhook delivery
 * must succeed regardless of OTel export failures.
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('graceful degradation — OTel export failure', () => {
  it('delivers webhook even when OTLP endpoint is unreachable', async () => {
    // The integration test environment points to localhost:4318 which does not
    // exist. The Worker must still respond with 201.
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'https://example.com/hook',
        event: 'order.created',
        payload: { test: true },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string };
    expect(body.id).toMatch(/^evt_/);
    expect(body.status).toBe('pending');
  });

  it('returns correct error response (400) even when OTLP is down', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'no-destination' }),
    });
    // Must return 400, not 500
    expect(res.status).toBe(400);
  });

  it('handles invalid JSON without leaking OTel errors', async () => {
    const res = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken":',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    // Should be a business error, not an OTel infrastructure error
    expect(body.error).toBeDefined();
    expect(body.error).not.toContain('OTel');
    expect(body.error).not.toContain('export');
    expect(body.error).not.toContain('OTLP');
  });

  it('serves health check even when OTLP endpoint is unreachable', async () => {
    const res = await SELF.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('handles multiple concurrent requests without OTel errors surfacing', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      SELF.fetch('http://localhost/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: `https://example${i}.com`, event: 'batch.test' }),
      })
    );
    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.status).toBe(201);
    }
  });
});
