/**
 * Integration tests: sampling behavior.
 *
 * Verifies that:
 * - With OTEL_SAMPLE_RATE=1.0 (set in integration test bindings), all requests
 *   are processed (we can't directly assert span emission in Miniflare without
 *   a real OTLP receiver, but we verify the Worker correctly responds for all
 *   requests, meaning sampling doesn't break the request path).
 * - Error responses (400/500) are handled correctly regardless of sample rate.
 *
 * Full sampling verification (span counts) is done in contract tests.
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('sampling — request handling at OTEL_SAMPLE_RATE=1.0', () => {
  it('processes all requests at 100% sample rate', async () => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await SELF.fetch('http://localhost/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'https://example.com', event: 'test' }),
      });
      results.push(res.status);
    }
    // All 10 requests should be processed and return 201
    expect(results.every(s => s === 201)).toBe(true);
  });

  it('error requests are handled correctly and return proper status codes', async () => {
    // These would be error-sampled (100%) in production
    const missingDest = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingDest.status).toBe(400);

    const badJson = await SELF.fetch('http://localhost/v1/webhooks', {
      method: 'POST',
      body: 'garbage',
    });
    expect(badJson.status).toBe(400);
  });

  it('successful and error requests do not interfere with each other', async () => {
    const [success, error] = await Promise.all([
      SELF.fetch('http://localhost/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'https://a.com', event: 'ok' }),
      }),
      SELF.fetch('http://localhost/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'no-dest' }),
      }),
    ]);
    expect(success.status).toBe(201);
    expect(error.status).toBe(400);
  });
});
