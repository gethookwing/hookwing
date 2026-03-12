import { events, deliveries, endpoints, generateId, getTierBySlug } from '@hookwing/shared';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const eventRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    DELIVERY_QUEUE?: Queue;
  };
}>();

// All routes require auth
eventRoutes.use('/*', authMiddleware);

// ============================================================================
// GET /v1/events — List events (filtered, paginated, tier-gated retention)
// ============================================================================

eventRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = Number.parseInt(c.req.query('offset') || '0', 10);
  const statusFilter = c.req.query('status');
  const eventType = c.req.query('eventType');
  const sinceParam = c.req.query('since');
  const untilParam = c.req.query('until');
  const endpointId = c.req.query('endpointId');

  // Tier-gated retention
  const tier = getTierBySlug(workspace.tierSlug);
  const retentionMs = (tier?.limits.retention_days ?? 7) * 86400000;
  const retentionCutoff = Date.now() - retentionMs;

  // Build conditions
  const conditions = [
    eq(events.workspaceId, workspace.id),
    gte(events.receivedAt, retentionCutoff),
  ];

  if (statusFilter) {
    conditions.push(eq(events.status, statusFilter));
  }
  if (eventType) {
    conditions.push(eq(events.eventType, eventType));
  }
  if (sinceParam) {
    const sinceTs = Number.parseInt(sinceParam, 10);
    if (!Number.isNaN(sinceTs)) {
      conditions.push(gte(events.receivedAt, sinceTs));
    }
  }
  if (untilParam) {
    const untilTs = Number.parseInt(untilParam, 10);
    if (!Number.isNaN(untilTs)) {
      conditions.push(lte(events.receivedAt, untilTs));
    }
  }

  // If filtering by endpointId, we need to join with deliveries
  let eventIdsForEndpoint: string[] | null = null;
  if (endpointId) {
    const deliveryRecords = await db
      .select({ eventId: deliveries.eventId })
      .from(deliveries)
      .where(and(eq(deliveries.endpointId, endpointId), eq(deliveries.workspaceId, workspace.id)));
    eventIdsForEndpoint = [...new Set(deliveryRecords.map((d) => d.eventId))];
    if (eventIdsForEndpoint.length === 0) {
      // No deliveries for this endpoint, return empty result
      return c.json({
        events: [],
        pagination: {
          limit,
          offset,
          total: 0,
        },
      });
    }
    conditions.push(sql`${events.id} IN ${eventIdsForEndpoint}`);
  }

  const whereClause = and(...conditions);

  // Get total count using proper count
  const countResult = await db
    .select({ total: sql<number>`count(*)` })
    .from(events)
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  // Fetch events for workspace with filters
  const eventList = await db
    .select()
    .from(events)
    .where(whereClause)
    .orderBy(desc(events.receivedAt))
    .limit(limit)
    .offset(offset);

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
// GET /v1/events/:id — Single event with delivery details
// ============================================================================

eventRoutes.get('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const eventId = c.req.param('id');

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  const eventDeliveries = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.eventId, eventId))
    .orderBy(desc(deliveries.createdAt));

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
    deliveries: eventDeliveries.map((d) => ({
      id: d.id,
      endpointId: d.endpointId,
      attemptNumber: d.attemptNumber,
      status: d.status,
      responseStatusCode: d.responseStatusCode,
      responseBody: d.responseBody,
      errorMessage: d.errorMessage,
      durationMs: d.durationMs,
      nextRetryAt: d.nextRetryAt,
      deliveredAt: d.deliveredAt,
      createdAt: d.createdAt,
    })),
  });
});

// ============================================================================
// GET /v1/events/:id/deliveries — Delivery attempts for a specific event
// ============================================================================

eventRoutes.get('/:id/deliveries', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const eventId = c.req.param('id');

  // Verify event belongs to workspace
  const event = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  const eventDeliveries = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.eventId, eventId))
    .orderBy(desc(deliveries.createdAt));

  return c.json({
    deliveries: eventDeliveries.map((d) => ({
      id: d.id,
      endpointId: d.endpointId,
      attemptNumber: d.attemptNumber,
      status: d.status,
      responseStatusCode: d.responseStatusCode,
      responseBody: d.responseBody,
      responseHeaders: d.responseHeaders,
      errorMessage: d.errorMessage,
      durationMs: d.durationMs,
      nextRetryAt: d.nextRetryAt,
      deliveredAt: d.deliveredAt,
      createdAt: d.createdAt,
    })),
  });
});

// ============================================================================
// POST /v1/events/:id/replay — Replay a single event
// ============================================================================

eventRoutes.post('/:id/replay', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const eventId = c.req.param('id');
  const targetEndpointId = c.req.query('endpointId');

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Find active endpoints - optionally filter to specific endpoint
  let activeEndpoints: (typeof endpoints.$inferSelect)[] = [];
  if (targetEndpointId) {
    activeEndpoints = await db
      .select()
      .from(endpoints)
      .where(
        and(
          eq(endpoints.workspaceId, workspace.id),
          eq(endpoints.isActive, 1),
          eq(endpoints.id, targetEndpointId),
        ),
      );
    if (activeEndpoints.length === 0) {
      return c.json({ error: 'Target endpoint not found or inactive' }, 404);
    }
  } else {
    activeEndpoints = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.workspaceId, workspace.id), eq(endpoints.isActive, 1)));
  }

  if (activeEndpoints.length === 0) {
    return c.json({ error: 'No active endpoints to replay to' }, 400);
  }

  const now = Date.now();
  const createdDeliveries: Array<{ id: string; endpointId: string; status: string }> = [];

  for (const endpoint of activeEndpoints) {
    const deliveryId = generateId('dlv');

    await db.insert(deliveries).values({
      id: deliveryId,
      eventId,
      endpointId: endpoint.id,
      workspaceId: workspace.id,
      attemptNumber: 1,
      status: 'pending',
      createdAt: now,
    });

    createdDeliveries.push({
      id: deliveryId,
      endpointId: endpoint.id,
      status: 'pending',
    });

    if (c.env?.DELIVERY_QUEUE) {
      await c.env.DELIVERY_QUEUE.send({
        deliveryId,
        eventId,
        endpointId: endpoint.id,
        workspaceId: workspace.id,
        attempt: 1,
      });
    }
  }

  // Reset event status to processing
  await db
    .update(events)
    .set({ status: 'processing', processedAt: null })
    .where(eq(events.id, eventId));

  return c.json({
    replayed: true,
    eventId,
    deliveries: createdDeliveries,
  });
});

// ============================================================================
// POST /v1/events/replay — Bulk replay (up to 100 events)
// ============================================================================

const bulkReplaySchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1).max(100),
});

eventRoutes.post('/replay', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = bulkReplaySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { eventIds } = parsed.data;

  // Find all active endpoints for this workspace
  const activeEndpoints = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.workspaceId, workspace.id), eq(endpoints.isActive, 1)));

  if (activeEndpoints.length === 0) {
    return c.json({ error: 'No active endpoints to replay to' }, 400);
  }

  const now = Date.now();
  const allDeliveryIds: string[] = [];
  let replayedCount = 0;

  for (const eventId of eventIds) {
    // Verify event belongs to workspace
    const event = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!event) {
      continue; // Skip events that don't exist or don't belong to workspace
    }

    for (const endpoint of activeEndpoints) {
      const deliveryId = generateId('dlv');
      allDeliveryIds.push(deliveryId);

      await db.insert(deliveries).values({
        id: deliveryId,
        eventId,
        endpointId: endpoint.id,
        workspaceId: workspace.id,
        attemptNumber: 1,
        status: 'pending',
        createdAt: now,
      });

      if (c.env?.DELIVERY_QUEUE) {
        await c.env.DELIVERY_QUEUE.send({
          deliveryId,
          eventId,
          endpointId: endpoint.id,
          workspaceId: workspace.id,
          attempt: 1,
        });
      }
    }

    // Reset event status
    await db
      .update(events)
      .set({ status: 'processing', processedAt: null })
      .where(eq(events.id, eventId));

    replayedCount++;
  }

  return c.json({
    replayed: true,
    count: replayedCount,
    deliveryIds: allDeliveryIds,
    endpointCount: activeEndpoints.length,
  });
});

export default eventRoutes;
