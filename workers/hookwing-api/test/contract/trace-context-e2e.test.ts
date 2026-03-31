/**
 * Contract tests: W3C Trace Context propagation verification.
 *
 * Requires Docker services:
 *   docker compose -f test/docker-compose.test.yml up -d --wait
 *
 * Contracts verified:
 *   - Contract 4: Trace Context Propagation format
 *   - W3C traceparent header format: 00-{32hex}-{16hex}-{2hex}
 *   - tracestate header format: hookwing=eid:{endpointId},did:{deliveryId}
 *
 * NOTE: Full trace context propagation in outbound fetch is implemented in
 * Phase 3. This contract test verifies the header format utilities that will
 * power Phase 3, plus validates end-to-end that spans arriving at the
 * collector have valid traceId/spanId fields.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OTelTestClient } from '../helpers/otel-test-client';
import { isValidTraceparent, formatTraceparent, formatTracestate } from '../../src/otel/trace-context';

const SPAN_ASSERTER_URL = process.env.SPAN_ASSERTER_URL ?? 'http://localhost:9999';
const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL ?? 'http://localhost:4318';

const otel = new OTelTestClient(SPAN_ASSERTER_URL);

function makeTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 0);
}
function makeSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

async function submitSpan(traceId: string, spanId: string, name: string): Promise<void> {
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  await fetch(`${OTEL_COLLECTOR_URL}/v1/traces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceSpans: [{
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'hookwing-api' } }],
        },
        scopeSpans: [{
          scope: { name: 'hookwing', version: '1.0.0' },
          spans: [{
            traceId: traceId.slice(0, 32),
            spanId: spanId.slice(0, 16),
            name,
            kind: 2,
            startTimeUnixNano: nowNs.toString(),
            endTimeUnixNano: (nowNs + 100_000_000n).toString(),
            attributes: [],
            status: { code: 1 },
            links: [],
          }],
        }],
      }],
    }),
  });
}

describe('Contract 4: Trace Context Propagation — Header Format', () => {
  it('traceparent format matches W3C spec: 00-{32hex}-{16hex}-{2hex}', () => {
    const traceId = makeTraceId().slice(0, 32);
    const spanId = makeSpanId().slice(0, 16);
    const header = formatTraceparent({ traceId, spanId, traceFlags: 1 });
    expect(isValidTraceparent(header)).toBe(true);
    expect(header).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/);
  });

  it('tracestate includes hookwing vendor info', () => {
    const state = formatTracestate('ep_abc123', 'del_xyz789');
    expect(state).toBe('hookwing=eid:ep_abc123,did:del_xyz789');
    // W3C tracestate format: vendor=value
    expect(state).toMatch(/^hookwing=/);
  });

  it('sampled traceparent has flags=01', () => {
    const header = formatTraceparent({
      traceId: makeTraceId().slice(0, 32),
      spanId: makeSpanId().slice(0, 16),
      traceFlags: 1,
    });
    expect(header).toEndWith('-01');
  });

  it('unsampled traceparent has flags=00', () => {
    const header = formatTraceparent({
      traceId: makeTraceId().slice(0, 32),
      spanId: makeSpanId().slice(0, 16),
      traceFlags: 0,
    });
    expect(header).toEndWith('-00');
  });
});

describe('Contract 4: Trace Context — Round-trip via Collector', () => {
  beforeEach(async () => {
    await otel.clearSpans();
  });

  it('span arrives at asserter with correct traceId and spanId', async () => {
    const traceId = makeTraceId().slice(0, 32);
    const spanId = makeSpanId().slice(0, 16);

    await submitSpan(traceId, spanId, 'hookwing.delivery.attempt');

    const spans = await otel.waitForSpans({ name: 'hookwing.delivery.attempt', minCount: 1 });
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const span = spans.find(s => s.traceId === traceId);
    expect(span).toBeDefined();
    expect(span!.spanId).toBe(spanId);
  });

  it('multiple spans with same traceId can be grouped into one trace', async () => {
    const traceId = makeTraceId().slice(0, 32);
    const parentSpanId = makeSpanId().slice(0, 16);
    const childSpanId = makeSpanId().slice(0, 16);

    // Submit parent then child in same batch
    const nowNs = BigInt(Date.now()) * 1_000_000n;
    await fetch(`${OTEL_COLLECTOR_URL}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceSpans: [{
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'hookwing-api' } }],
          },
          scopeSpans: [{
            scope: { name: 'hookwing', version: '1.0.0' },
            spans: [
              {
                traceId,
                spanId: parentSpanId,
                name: 'hookwing.ingest',
                kind: 2,
                startTimeUnixNano: nowNs.toString(),
                endTimeUnixNano: (nowNs + 500_000_000n).toString(),
                attributes: [],
                status: { code: 1 },
                links: [],
              },
              {
                traceId,
                spanId: childSpanId,
                parentSpanId,
                name: 'hookwing.auth.verify',
                kind: 3,
                startTimeUnixNano: (nowNs + 10_000_000n).toString(),
                endTimeUnixNano: (nowNs + 50_000_000n).toString(),
                attributes: [],
                status: { code: 1 },
                links: [],
              },
            ],
          }],
        }],
      }),
    });

    const spans = await otel.waitForSpans({ traceId, minCount: 2 });
    expect(spans.length).toBeGreaterThanOrEqual(2);

    const parent = spans.find(s => s.spanId === parentSpanId);
    const child = spans.find(s => s.spanId === childSpanId);
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.parentSpanId).toBe(parentSpanId);
  });
});
