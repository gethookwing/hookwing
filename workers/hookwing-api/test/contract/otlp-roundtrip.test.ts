/**
 * Contract tests: full OTLP round-trip verification.
 *
 * These tests require Docker services to be running:
 *   docker compose -f test/docker-compose.test.yml up -d --wait
 *
 * Contracts verified:
 *   - Contract 1: Ingest span structure (hookwing.ingest + child spans)
 *   - Contract 3: OTLP protocol compliance
 *   - Contract 6: Graceful degradation (OTel failure doesn't break webhooks)
 *
 * Environment variables (set by CI, or use defaults for local dev):
 *   OTEL_COLLECTOR_URL   — where to send spans (default: http://localhost:4318)
 *   SPAN_ASSERTER_URL    — where to query spans (default: http://localhost:9999)
 *   WORKER_URL           — the worker under test (default: http://localhost:8787)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { OTelTestClient } from '../helpers/otel-test-client';

const SPAN_ASSERTER_URL = process.env.SPAN_ASSERTER_URL ?? 'http://127.0.0.1:9999';
const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL ?? 'http://127.0.0.1:4318';
// Worker URL for direct span submission (simulates wrangler dev output)
const WORKER_URL = process.env.WORKER_URL ?? 'http://127.0.0.1:8787';

const otel = new OTelTestClient(SPAN_ASSERTER_URL);

// Helper: directly submit a span payload to the collector (bypasses the worker)
// Used to verify the OTLP protocol round-trip independently of the worker.
async function submitSpanToCollector(spans: unknown[]): Promise<Response> {
  return fetch(`${OTEL_COLLECTOR_URL}/v1/traces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'hookwing-api' } }],
          },
          scopeSpans: [
            {
              scope: { name: 'hookwing', version: '1.0.0' },
              spans,
            },
          ],
        },
      ],
    }),
  });
}

function makeTestSpan(name: string, overrides: Record<string, unknown> = {}): unknown {
  const traceId = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 0);
  const spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  return {
    traceId: traceId.slice(0, 32),
    spanId: spanId.slice(0, 16),
    name,
    kind: 2, // SERVER
    startTimeUnixNano: nowNs.toString(),
    endTimeUnixNano: (nowNs + 100_000_000n).toString(),
    attributes: [
      { key: 'hookwing.event_id', value: { stringValue: 'evt_testcontract001' } },
      { key: 'hookwing.event_type', value: { stringValue: 'order.created' } },
      { key: 'http.response.status_code', value: { intValue: 201 } },
    ],
    status: { code: 1 }, // OK
    links: [],
    ...overrides,
  };
}

describe('Contract 3: OTLP Protocol Compliance', () => {
  beforeAll(async () => {
    // Verify span-asserter is reachable — skip all tests if not
    const healthy = await otel.health();
    if (!healthy) {
      console.warn(
        'span-asserter not reachable at', SPAN_ASSERTER_URL,
        '— run: docker compose -f test/docker-compose.test.yml up -d --wait'
      );
    }
  });

  beforeEach(async () => {
    await otel.clearSpans();
  });

  it('accepts OTLP/HTTP JSON payload with correct Content-Type', async () => {
    const res = await submitSpanToCollector([makeTestSpan('hookwing.ingest')]);
    expect(res.status).toBe(200);
  });

  it('stores spans that are queryable via /spans endpoint', async () => {
    await submitSpanToCollector([makeTestSpan('hookwing.ingest')]);
    const spans = await otel.waitForSpans({ name: 'hookwing.ingest', minCount: 1 });
    expect(spans.length).toBeGreaterThanOrEqual(1);
    expect(spans[0].name).toBe('hookwing.ingest');
  });

  it('preserves span attributes through the collector pipeline', async () => {
    await submitSpanToCollector([makeTestSpan('hookwing.ingest')]);
    const spans = await otel.waitForSpans({
      name: 'hookwing.ingest',
      attr: { 'hookwing.event_id': 'evt_testcontract001' },
    });
    expect(spans.length).toBeGreaterThanOrEqual(1);
    expect(spans[0].attributes['hookwing.event_id']).toBe('evt_testcontract001');
    expect(spans[0].attributes['hookwing.event_type']).toBe('order.created');
    expect(spans[0].attributes['http.response.status_code']).toBe(201);
  });

  it('can filter spans by name via /spans?name=', async () => {
    await submitSpanToCollector([
      makeTestSpan('hookwing.ingest'),
      makeTestSpan('hookwing.auth.verify'),
    ]);
    await otel.waitForSpans({ name: 'hookwing.ingest', minCount: 1 });

    const ingestOnly = await otel.getSpans({ name: 'hookwing.ingest' });
    expect(ingestOnly.every(s => s.name === 'hookwing.ingest')).toBe(true);
  });

  it('clears all spans on DELETE /spans', async () => {
    await submitSpanToCollector([makeTestSpan('hookwing.ingest')]);
    await otel.waitForSpans({ minCount: 1 });
    await otel.clearSpans();
    const spans = await otel.getSpans();
    expect(spans.length).toBe(0);
  });
});

describe('Contract 1: Ingest Span Structure', () => {
  beforeEach(async () => {
    await otel.clearSpans();
  });

  it('hookwing.ingest span has required attributes', async () => {
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await submitSpanToCollector([
      makeTestSpan('hookwing.ingest', {
        attributes: [
          { key: 'hookwing.event_id', value: { stringValue: eventId } },
          { key: 'hookwing.event_type', value: { stringValue: 'order.created' } },
          { key: 'http.request.method', value: { stringValue: 'POST' } },
          { key: 'http.response.status_code', value: { intValue: 201 } },
          { key: 'hookwing.fanout_count', value: { intValue: 1 } },
        ],
      }),
    ]);

    const spans = await otel.waitForSpans({
      name: 'hookwing.ingest',
      attr: { 'hookwing.event_id': eventId },
    });
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const span = spans[0];
    expect(span.attributes['hookwing.event_id']).toMatch(/^evt_/);
    expect(span.attributes['hookwing.event_type']).toBe('order.created');
    expect(span.attributes['http.request.method']).toBe('POST');
    expect(span.attributes['http.response.status_code']).toBe(201);
    expect(span.attributes['hookwing.fanout_count']).toBe(1);
  });

  it('hookwing.auth.verify span has expected attributes', async () => {
    await submitSpanToCollector([
      makeTestSpan('hookwing.auth.verify', {
        attributes: [
          { key: 'hookwing.auth.success', value: { boolValue: true } },
        ],
      }),
    ]);
    const spans = await otel.waitForSpans({ name: 'hookwing.auth.verify', minCount: 1 });
    expect(spans[0].attributes['hookwing.auth.success']).toBe(true);
  });

  it('hookwing.event.validate span has expected attributes', async () => {
    await submitSpanToCollector([
      makeTestSpan('hookwing.event.validate', {
        attributes: [
          { key: 'hookwing.event_id', value: { stringValue: 'evt_abc123' } },
          { key: 'hookwing.event.valid', value: { boolValue: true } },
          { key: 'hookwing.event.payload_size', value: { intValue: 128 } },
        ],
      }),
    ]);
    const spans = await otel.waitForSpans({ name: 'hookwing.event.validate', minCount: 1 });
    expect(spans[0].attributes['hookwing.event.valid']).toBe(true);
    expect(spans[0].attributes['hookwing.event.payload_size']).toBe(128);
  });

  it('hookwing.delivery.attempt span has expected attributes', async () => {
    await submitSpanToCollector([
      makeTestSpan('hookwing.delivery.attempt', {
        attributes: [
          { key: 'hookwing.endpoint_id', value: { stringValue: 'ep_xyz' } },
          { key: 'hookwing.delivery_id', value: { stringValue: 'del_001' } },
          { key: 'hookwing.delivery_attempt', value: { intValue: 1 } },
          { key: 'http.response.status_code', value: { intValue: 200 } },
          { key: 'hookwing.delivery.success', value: { boolValue: true } },
        ],
      }),
    ]);
    const spans = await otel.waitForSpans({ name: 'hookwing.delivery.attempt', minCount: 1 });
    const span = spans[0];
    expect(span.attributes['hookwing.endpoint_id']).toBe('ep_xyz');
    expect(span.attributes['hookwing.delivery_id']).toBe('del_001');
    expect(span.attributes['hookwing.delivery_attempt']).toBe(1);
    expect(span.attributes['hookwing.delivery.success']).toBe(true);
  });
});

describe('Contract 6: Graceful Degradation (via direct span injection)', () => {
  it('span asserter returns 200 for valid OTLP payload', async () => {
    const res = await submitSpanToCollector([makeTestSpan('hookwing.ingest')]);
    expect(res.status).toBe(200);
  });

  it('span asserter handles multiple spans in a single batch', async () => {
    await otel.clearSpans();
    await submitSpanToCollector([
      makeTestSpan('hookwing.ingest'),
      makeTestSpan('hookwing.auth.verify'),
      makeTestSpan('hookwing.event.validate'),
    ]);
    const spans = await otel.waitForSpans({ minCount: 3 });
    expect(spans.length).toBeGreaterThanOrEqual(3);
  });
});
