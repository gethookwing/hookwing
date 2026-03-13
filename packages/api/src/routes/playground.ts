import {
  events,
  deliveries,
  endpoints,
  generateId,
  generateSigningSecret,
  workspaces,
} from '@hookwing/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';

// Type for selected event fields
interface EventSummary {
  id: string;
  eventType: string;
  payload: string | null;
  headers: string | null;
  receivedAt: number;
  status: string;
}

const playgroundRoutes = new Hono<{
  Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue };
}>();

// Session duration: 1 hour in milliseconds
const SESSION_DURATION_MS = 60 * 60 * 1000;

// ============================================================================
// POST /v1/playground/sessions — Create anonymous playground session
// ============================================================================

playgroundRoutes.post('/sessions', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }

  const db = createDb(c.env.DB);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  // Generate IDs
  const workspaceId = generateId('play');
  const endpointId = generateId('ep');
  const signingSecret = await generateSigningSecret();

  // Create playground workspace
  await db.insert(workspaces).values({
    id: workspaceId,
    email: `${workspaceId}@playground.hookwing.local`,
    passwordHash: 'playground-no-auth',
    name: 'Playground session',
    slug: `playground-${workspaceId}`,
    tierSlug: 'paper-plane',
    isPlayground: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Create playground endpoint
  await db.insert(endpoints).values({
    id: endpointId,
    workspaceId: workspaceId,
    url: 'https://httpbin.org/post', // Default test URL - events will be received here
    description: 'Playground endpoint',
    secret: signingSecret,
    eventTypes: null,
    isActive: 1,
    fanoutEnabled: 1,
    rateLimitPerSecond: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  });

  const endpointUrl = `/v1/ingest/${endpointId}`;

  return c.json(
    {
      sessionId: workspaceId,
      endpointId: endpointId,
      endpointUrl: endpointUrl,
      secret: signingSecret,
      expiresAt: expiresAt,
    },
    201,
  );
});

// ============================================================================
// GET /v1/playground/sessions/:sessionId/events — Poll for events
// ============================================================================

playgroundRoutes.get('/sessions/:sessionId/events', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }

  const db = createDb(c.env.DB);
  const sessionId = c.req.param('sessionId');
  const sinceParam = c.req.query('since');

  // Verify session exists and is a playground session
  const session = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, sessionId), eq(workspaces.isPlayground, 1)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Check if session has expired
  if (session.updatedAt + SESSION_DURATION_MS < Date.now()) {
    return c.json({ error: 'Session expired' }, 410);
  }

  // Build query for events
  const eventQuery = db
    .select({
      id: events.id,
      eventType: events.eventType,
      payload: events.payload,
      headers: events.headers,
      receivedAt: events.receivedAt,
      status: events.status,
    })
    .from(events)
    .where(eq(events.workspaceId, sessionId))
    .orderBy(desc(events.receivedAt))
    .limit(50);

  // Apply since filter if provided
  let eventsList: EventSummary[];
  if (sinceParam) {
    const since = Number.parseInt(sinceParam, 10);
    if (!Number.isNaN(since)) {
      const filteredEvents = await db
        .select({
          id: events.id,
          eventType: events.eventType,
          payload: events.payload,
          headers: events.headers,
          receivedAt: events.receivedAt,
          status: events.status,
        })
        .from(events)
        .where(and(eq(events.workspaceId, sessionId), gt(events.receivedAt, since)))
        .orderBy(desc(events.receivedAt))
        .limit(50);
      eventsList = filteredEvents;
    } else {
      eventsList = await eventQuery;
    }
  } else {
    eventsList = await eventQuery;
  }

  // Get delivery status for each event
  const eventsWithDeliveries = await Promise.all(
    eventsList.map(async (event) => {
      const deliveryList = await db
        .select({
          id: deliveries.id,
          status: deliveries.status,
          responseStatusCode: deliveries.responseStatusCode,
          durationMs: deliveries.durationMs,
          attemptNumber: deliveries.attemptNumber,
        })
        .from(deliveries)
        .where(eq(deliveries.eventId, event.id))
        .orderBy(desc(deliveries.attemptNumber));

      return {
        id: event.id,
        eventType: event.eventType,
        payload: event.payload ? JSON.parse(event.payload) : null,
        headers: event.headers ? JSON.parse(event.headers) : null,
        receivedAt: event.receivedAt,
        status: event.status,
        deliveries: deliveryList,
      };
    }),
  );

  return c.json({
    events: eventsWithDeliveries,
  });
});

// ============================================================================
// POST /v1/playground/sessions/:sessionId/test — Send a test event
// ============================================================================

playgroundRoutes.post('/sessions/:sessionId/test', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }

  const db = createDb(c.env.DB);
  const sessionId = c.req.param('sessionId');

  // Verify session exists and is a playground session
  const session = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, sessionId), eq(workspaces.isPlayground, 1)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Check if session has expired
  if (session.updatedAt + SESSION_DURATION_MS < Date.now()) {
    return c.json({ error: 'Session expired' }, 410);
  }

  // Get the playground endpoint
  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.workspaceId, sessionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Parse request body
  const body = await c.req.json().catch(() => ({}));
  const eventType = body.eventType || 'test.event';
  const payload = body.payload || { message: 'Test event from playground', timestamp: Date.now() };

  // Generate event ID
  const eventId = generateId('evt');
  const now = Date.now();

  // Build headers
  const relevantHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': eventType,
    'User-Agent': 'Hookwing-Playground/1.0',
  };

  // Insert event
  await db.insert(events).values({
    id: eventId,
    workspaceId: sessionId,
    eventType: eventType,
    payload: JSON.stringify(payload),
    headers: JSON.stringify(relevantHeaders),
    sourceIp: '127.0.0.1',
    receivedAt: now,
    status: 'pending',
  });

  // Queue delivery (reuse the existing delivery queue logic indirectly through fanout)
  // For playground, we'll create a delivery record directly
  const deliveryId = generateId('del');

  await db.insert(deliveries).values({
    id: deliveryId,
    eventId: eventId,
    endpointId: endpoint.id,
    workspaceId: sessionId,
    attemptNumber: 1,
    status: 'pending',
    responseStatusCode: null,
    responseBody: null,
    responseHeaders: null,
    errorMessage: null,
    durationMs: null,
    nextRetryAt: null,
    deliveredAt: null,
    createdAt: now,
  });

  return c.json({
    eventId: eventId,
    eventType: eventType,
    payload: payload,
    receivedAt: now,
    status: 'pending',
  });
});

export default playgroundRoutes;
