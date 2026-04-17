/**
 * Mock Webhook Receiver — simulates a customer endpoint for contract tests.
 *
 * Records all incoming webhook deliveries, exposing:
 *   POST /*                    — accept any webhook delivery
 *   GET  /deliveries           — list recorded deliveries (for assertions)
 *   DELETE /deliveries         — clear between tests
 *   GET  /health               — readiness check
 */

import { serve } from 'bun';

interface Delivery {
  method: string;
  pathname: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  traceparent: string | null;
  tracestate: string | null;
}

const deliveries: Delivery[] = [];

serve({
  port: parseInt(process.env.PORT ?? '8888', 10),
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/deliveries') {
      return Response.json({ deliveries, total: deliveries.length });
    }

    if (req.method === 'DELETE' && url.pathname === '/deliveries') {
      deliveries.length = 0;
      return new Response('', { status: 204 });
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', deliveryCount: deliveries.length });
    }

    // Accept any POST as a webhook delivery
    if (req.method === 'POST') {
      const body = await req.text();
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => { headers[key] = value; });
      deliveries.push({
        method: req.method,
        pathname: url.pathname,
        headers,
        body,
        timestamp: Date.now(),
        traceparent: req.headers.get('traceparent'),
        tracestate: req.headers.get('tracestate'),
      });
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`mock-receiver listening on :${process.env.PORT ?? 8888}`);
