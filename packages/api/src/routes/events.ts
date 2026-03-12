import { events, deliveries } from '@hookwing/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const eventRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth
eventRoutes.use('/*', authMiddleware);

// ============================================================================
// GET /v1/events — List events for workspace (paginated)
// ============================================================================

eventRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // Parse pagination params
  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = Number.parseInt(c.req.query('offset') || '0', 10);

  // Fetch events for workspace
  const eventList = await db
    .select()
    .from(events)
    .where(eq(events.workspaceId, workspace.id))
    .orderBy(events.receivedAt)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: events.id })
    .from(events)
    .where(eq(events.workspaceId, workspace.id));

  const total = countResult.length;

  return c.json({
    events: eventList.map((event) => ({
      id: event.id,
      workspaceId: event.workspaceId,
      eventType: event.eventType,
      payload: event.payload ? JSON.parse(event.payload) : null,
      headers: event.headers ? JSON.parse(event.headers) : null,
      sourceIp: event.sourceIp,
      receivedAt: event.receivedAt,
      processedAt: event.processedAt,
      status: event.status,
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  });
});

// ============================================================================
// GET /v1/events/:id — Get single event with its deliveries
// ============================================================================

eventRoutes.get('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const eventId = c.req.param('id');

  // Fetch event by ID
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Fetch deliveries for this event
  const eventDeliveries = await db.select().from(deliveries).where(eq(deliveries.eventId, eventId));

  return c.json({
    id: event.id,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
    payload: event.payload ? JSON.parse(event.payload) : null,
    headers: event.headers ? JSON.parse(event.headers) : null,
    sourceIp: event.sourceIp,
    receivedAt: event.receivedAt,
    processedAt: event.processedAt,
    status: event.status,
    deliveries: eventDeliveries.map((delivery) => ({
      id: delivery.id,
      eventId: delivery.eventId,
      endpointId: delivery.endpointId,
      attemptNumber: delivery.attemptNumber,
      status: delivery.status,
      responseStatusCode: delivery.responseStatusCode,
      responseBody: delivery.responseBody,
      errorMessage: delivery.errorMessage,
      durationMs: delivery.durationMs,
      deliveredAt: delivery.deliveredAt,
      createdAt: delivery.createdAt,
    })),
  });
});

export default eventRoutes;
