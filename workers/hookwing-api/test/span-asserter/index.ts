/**
 * Span Asserter — lightweight OTLP receiver for contract tests.
 *
 * Receives spans via OTLP/HTTP JSON, stores them in memory,
 * and exposes a REST API for test assertions.
 *
 * Endpoints:
 *   POST /v1/traces               — OTLP span receiver (from collector)
 *   GET  /spans                   — query spans (name, traceId, attr.*)
 *   DELETE /spans                 — clear between tests
 *   GET  /health                  — readiness check
 */

import { serve } from 'bun';

interface StoredSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, unknown>;
  status: { code: number; message?: string };
  links: unknown[];
}

const spans: StoredSpan[] = [];

function normalizeAttributes(raw: Array<{ key: string; value: { stringValue?: string; intValue?: number; boolValue?: boolean; doubleValue?: number } }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const attr of raw ?? []) {
    const v = attr.value;
    out[attr.key] = v.stringValue ?? v.intValue ?? v.boolValue ?? v.doubleValue ?? null;
  }
  return out;
}

function normalizeSpan(raw: Record<string, unknown>): StoredSpan {
  return {
    traceId: raw.traceId as string,
    spanId: raw.spanId as string,
    parentSpanId: raw.parentSpanId as string | undefined,
    name: raw.name as string,
    kind: raw.kind as number ?? 0,
    startTimeUnixNano: raw.startTimeUnixNano as string,
    endTimeUnixNano: raw.endTimeUnixNano as string,
    attributes: normalizeAttributes(raw.attributes as any[] ?? []),
    status: (raw.status as StoredSpan['status']) ?? { code: 0 },
    links: raw.links as unknown[] ?? [],
  };
}

serve({
  port: parseInt(process.env.PORT ?? '9999', 10),
  async fetch(req) {
    const url = new URL(req.url);

    // Receive OTLP/HTTP JSON spans (POST from otel-collector)
    if (req.method === 'POST' && url.pathname === '/v1/traces') {
      try {
        const body = await req.json() as { resourceSpans?: Array<{ scopeSpans?: Array<{ spans?: unknown[] }> }> };
        for (const rs of body.resourceSpans ?? []) {
          for (const ss of rs.scopeSpans ?? []) {
            for (const span of ss.spans ?? []) {
              spans.push(normalizeSpan(span as Record<string, unknown>));
            }
          }
        }
      } catch {
        // Malformed body — ignore, still return 200 to avoid collector errors
      }
      return new Response('', { status: 200 });
    }

    // Query spans
    if (req.method === 'GET' && url.pathname === '/spans') {
      let filtered = [...spans];

      const name = url.searchParams.get('name');
      if (name) filtered = filtered.filter(s => s.name === name);

      const traceId = url.searchParams.get('traceId');
      if (traceId) filtered = filtered.filter(s => s.traceId === traceId);

      // Attribute filters: ?attr.hookwing.event_id=xxx
      for (const [key, val] of url.searchParams.entries()) {
        if (key.startsWith('attr.')) {
          const attrKey = key.slice(5);
          filtered = filtered.filter(s => String(s.attributes[attrKey]) === val);
        }
      }

      return Response.json({ spans: filtered, total: filtered.length });
    }

    // Clear spans between tests
    if (req.method === 'DELETE' && url.pathname === '/spans') {
      spans.length = 0;
      return new Response('', { status: 204 });
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', spanCount: spans.length });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`span-asserter listening on :${process.env.PORT ?? 9999}`);
