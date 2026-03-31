/**
 * Hookwing API - Webhook Infrastructure
 *
 * Endpoints:
 * - POST /v1/webhooks     - Create a new webhook delivery
 * - GET  /v1/webhooks/:id - Get webhook status
 * - GET  /health          - Health check
 *
 * OpenTelemetry: @microlabs/otel-cf-workers wraps this handler.
 * Custom spans: hookwing.ingest, hookwing.auth.verify,
 *               hookwing.event.validate, hookwing.delivery.attempt
 * Sampling: 100% errors (tail), configurable rate for success (head, default 10%)
 */

import { instrument } from '@microlabs/otel-cf-workers';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { resolveConfig } from './otel/config';
import {
  setIngestAttributes,
  setAuthAttributes,
  setValidateAttributes,
  setDeliveryAttemptAttributes,
} from './otel/spans';

interface Env {
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_AUTH_TOKEN?: string;
  OTEL_SAMPLE_RATE?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleIngest(request: Request): Promise<Response> {
  const tracer = trace.getTracer('hookwing');

  return tracer.startActiveSpan('hookwing.ingest', async (ingestSpan) => {
    try {
      const bodyText = await request.text();
      let body: { destination?: string; event?: string; payload?: unknown };

      try {
        body = JSON.parse(bodyText);
      } catch {
        setIngestAttributes(ingestSpan, {
          eventId: 'unknown',
          eventType: 'unknown',
          responseStatusCode: 400,
        });
        ingestSpan.end();
        return json({ error: 'Invalid JSON' }, 400);
      }

      const { destination, event, payload } = body;
      const eventType = event ?? 'webhook';

      // Auth verify span
      tracer.startActiveSpan('hookwing.auth.verify', (authSpan) => {
        // Phase 1: no real auth — always succeeds
        setAuthAttributes(authSpan, { success: true });
        authSpan.end();
      });

      if (!destination) {
        setIngestAttributes(ingestSpan, {
          eventId: 'unknown',
          eventType,
          responseStatusCode: 400,
        });
        ingestSpan.end();
        return json({ error: 'destination is required' }, 400);
      }

      const eventId = 'evt_' + crypto.randomUUID().replace(/-/g, '');

      // Event validate span
      tracer.startActiveSpan('hookwing.event.validate', (validateSpan) => {
        setValidateAttributes(validateSpan, {
          eventId,
          eventType,
          payloadSize: bodyText.length,
          valid: true,
        });
        validateSpan.end();
      });

      const webhook = {
        id: eventId,
        destination,
        event: eventType,
        payload: payload ?? {},
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setIngestAttributes(ingestSpan, {
        eventId,
        eventType,
        requestBodySize: bodyText.length,
        responseStatusCode: 201,
        fanoutCount: 1,
      });
      ingestSpan.end();

      return json(webhook, 201);
    } catch (err) {
      ingestSpan.recordException(err as Error);
      ingestSpan.setStatus({ code: SpanStatusCode.ERROR });
      ingestSpan.end();
      throw err;
    }
  });
}

async function handleGetWebhook(id: string): Promise<Response> {
  const tracer = trace.getTracer('hookwing');

  return tracer.startActiveSpan('hookwing.delivery.attempt', async (deliverySpan) => {
    const start = Date.now();
    // Phase 1 stub: simulate a successful lookup
    const durationMs = Date.now() - start;

    setDeliveryAttemptAttributes(deliverySpan, {
      endpointId: 'ep_stub',
      deliveryId: id,
      attempt: 1,
      responseStatusCode: 200,
      durationMs,
      success: true,
    });
    deliverySpan.end();

    return json({
      id,
      status: 'delivered',
      attempts: [{ status: 'delivered', code: 200, timestamp: new Date().toISOString() }],
    });
  });
}

const handler = {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === '/health' || path === '/health/') {
      return json({ status: 'ok', version: 'v1', environment: 'staging' });
    }

    if (path === '/' || path === '') {
      return json({ name: 'Hookwing API', version: 'v1', docs: 'https://hookwing.com/docs' });
    }

    if ((path === '/v1/webhooks' || path === '/v1/webhooks/') && request.method === 'POST') {
      return handleIngest(request);
    }

    if (path.startsWith('/v1/webhooks/') && request.method === 'GET') {
      const id = path.slice('/v1/webhooks/'.length);
      return handleGetWebhook(id);
    }

    return json({ error: 'Not found' }, 404);
  },
};

export default instrument(handler, resolveConfig);
