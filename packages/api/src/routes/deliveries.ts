import { events, deliveries, getTierBySlug } from '@hookwing/shared';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const deliveryRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth + rate limiting
deliveryRoutes.use('/*', authMiddleware);
deliveryRoutes.use(
  '/*',
  createRateLimitMiddleware({
    windowMs: 1000,
    keyFn: (c) => {
      const ws = c.get('workspace') as { id: string } | undefined;
      return `api:${ws?.id ?? 'unknown'}`;
    },
    getLimit: (c) => {
      const ws = c.get('workspace') as { tierSlug: string } | undefined;
      const tier = ws ? getTierBySlug(ws.tierSlug) : undefined;
      return tier?.limits.rate_limit_per_second ?? 10;
    },
  }),
);

// ============================================================================
// GET /v1/deliveries — List deliveries for workspace
// ============================================================================

deliveryRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // Parse pagination params
  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = Number.parseInt(c.req.query('offset') || '0', 10);

  // Parse filter params
  const eventId = c.req.query('eventId');
  const endpointId = c.req.query('endpointId');
  const status = c.req.query('status');
  const sinceParam = c.req.query('since');
  const untilParam = c.req.query('until');

  // Build conditions
  const conditions = [eq(deliveries.workspaceId, workspace.id)];

  if (eventId) {
    conditions.push(eq(deliveries.eventId, eventId));
  }

  if (endpointId) {
    conditions.push(eq(deliveries.endpointId, endpointId));
  }

  if (status) {
    conditions.push(eq(deliveries.status, status));
  }

  if (sinceParam) {
    const since = Number.parseInt(sinceParam, 10);
    if (!Number.isNaN(since)) {
      conditions.push(gte(deliveries.createdAt, since));
    }
  }

  if (untilParam) {
    const until = Number.parseInt(untilParam, 10);
    if (!Number.isNaN(until)) {
      conditions.push(lte(deliveries.createdAt, until));
    }
  }

  // Combine all conditions
  const whereClause = and(...conditions);

  // Get total count using proper count
  const countResult = await db
    .select({ total: sql<number>`count(*)` })
    .from(deliveries)
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  // Fetch deliveries with filters
  const deliveryList = await db
    .select()
    .from(deliveries)
    .where(whereClause)
    .orderBy(desc(deliveries.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    deliveries: deliveryList.map((delivery) => ({
      id: delivery.id,
      eventId: delivery.eventId,
      endpointId: delivery.endpointId,
      workspaceId: delivery.workspaceId,
      attemptNumber: delivery.attemptNumber,
      status: delivery.status,
      responseStatusCode: delivery.responseStatusCode,
      responseBody: delivery.responseBody,
      responseHeaders: delivery.responseHeaders ? JSON.parse(delivery.responseHeaders) : null,
      errorMessage: delivery.errorMessage,
      durationMs: delivery.durationMs,
      nextRetryAt: delivery.nextRetryAt,
      deliveredAt: delivery.deliveredAt,
      createdAt: delivery.createdAt,
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  });
});

// ============================================================================
// GET /v1/deliveries/:id — Get single delivery detail
// ============================================================================

deliveryRoutes.get('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const deliveryId = c.req.param('id');

  // Fetch delivery by ID
  const delivery = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!delivery) {
    return c.json({ error: 'Delivery not found' }, 404);
  }

  // Also fetch the event for context
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, delivery.eventId))
    .limit(1)
    .then((rows) => rows[0]);

  return c.json({
    id: delivery.id,
    eventId: delivery.eventId,
    endpointId: delivery.endpointId,
    workspaceId: delivery.workspaceId,
    attemptNumber: delivery.attemptNumber,
    status: delivery.status,
    responseStatusCode: delivery.responseStatusCode,
    responseBody: delivery.responseBody,
    responseHeaders: delivery.responseHeaders ? JSON.parse(delivery.responseHeaders) : null,
    errorMessage: delivery.errorMessage,
    durationMs: delivery.durationMs,
    nextRetryAt: delivery.nextRetryAt,
    deliveredAt: delivery.deliveredAt,
    createdAt: delivery.createdAt,
    event: event
      ? {
          id: event.id,
          eventType: event.eventType,
          receivedAt: event.receivedAt,
          status: event.status,
        }
      : null,
  });
});

export default deliveryRoutes;
