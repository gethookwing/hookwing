import { events, deliveries, endpoints, generateId } from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';

const ingestRoutes = new Hono<{ Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue } }>();

// ============================================================================
// POST /v1/ingest/:endpointId — Receive incoming webhooks (public endpoint)
// ============================================================================

ingestRoutes.post('/:endpointId', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('endpointId');

  // 1. Look up endpoint by ID
  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  // 2. If not found or inactive, return 404
  if (!endpoint || !endpoint.isActive) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // 3. Read raw body as text (needed for signature verification)
  const rawBody = await c.req.text();

  // 4. Check event_type filter if endpoint has event_types configured
  const eventTypeHeader = c.req.header('X-Event-Type');
  if (endpoint.eventTypes) {
    try {
      const allowedTypes = JSON.parse(endpoint.eventTypes) as string[];
      if (eventTypeHeader && !allowedTypes.includes(eventTypeHeader)) {
        return c.json({ error: 'Event type not allowed for this endpoint' }, 400);
      }
    } catch {
      // Invalid JSON in eventTypes, ignore filter
    }
  }

  // 5. Parse event_type from header or use fallback
  const eventType = eventTypeHeader || 'unknown';

  // 6. Generate event ID
  const eventId = generateId('evt');
  const now = Date.now();

  // Get source IP
  const sourceIp =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    c.req.header('X-Real-IP') ||
    'unknown';

  // Build relevant headers object
  const relevantHeaders: Record<string, string> = {};
  const requestHeaders = [
    'Content-Type',
    'X-Event-Type',
    'User-Agent',
    'X-Forwarded-For',
    'CF-Connecting-IP',
  ];
  for (const header of requestHeaders) {
    const value = c.req.header(header);
    if (value) {
      relevantHeaders[header] = value;
    }
  }

  // 7. Insert into events table
  await db.insert(events).values({
    id: eventId,
    workspaceId: endpoint.workspaceId,
    eventType,
    payload: rawBody,
    headers: JSON.stringify(relevantHeaders),
    sourceIp,
    receivedAt: now,
    status: 'pending',
  });

  // 8. Insert into deliveries table
  const deliveryId = generateId('dlv');
  await db.insert(deliveries).values({
    id: deliveryId,
    eventId,
    endpointId,
    workspaceId: endpoint.workspaceId,
    attemptNumber: 1,
    status: 'pending',
    createdAt: now,
  });

  // 9. Enqueue delivery for async processing
  if (c.env?.DELIVERY_QUEUE) {
    await c.env.DELIVERY_QUEUE.send({
      deliveryId,
      eventId,
      endpointId,
      workspaceId: endpoint.workspaceId,
      attempt: 1,
    });
  }

  // 10. Return success response
  return c.json({ received: true, eventId });
});

export default ingestRoutes;
