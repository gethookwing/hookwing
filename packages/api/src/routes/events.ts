import { events, deliveries, getTierBySlug } from '@hookwing/shared';
import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import { fanoutEvent } from '../services/fanout';

const eventRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    DELIVERY_QUEUE?: Queue;
  };
}>();

// All routes require auth
eventRoutes.use('/*', authMiddleware);
eventRoutes.use(
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
// GET /v1/events — List events (filtered, cursor-paginated, tier-gated retention)
// ============================================================================

eventRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const cursor = c.req.query('cursor');
  const statusFilter = c.req.query('status');
  const eventTypeFilter = c.req.query('event_type');
  const since = c.req.query('since');
  const until = c.req.query('until');

  // Tier-gated retention
  const tier = getTierBySlug(workspace.tierSlug);
  const retentionMs = (tier?.limits.retention_days ?? 7) * 86400000;
  const retentionCutoff = Date.now() - retentionMs;

  // Build conditions
  const conditions = [
    eq(events.workspaceId, workspace.id),
    gte(events.receivedAt, retentionCutoff),
  ];

  if (cursor) {
    conditions.push(lt(events.id, cursor));
  }
  if (statusFilter) {
    conditions.push(eq(events.status, statusFilter));
  }
  if (eventTypeFilter) {
    conditions.push(eq(events.eventType, eventTypeFilter));
  }
  if (since) {
    const sinceTs = new Date(since).getTime();
    if (!Number.isNaN(sinceTs)) {
      conditions.push(gte(events.receivedAt, sinceTs));
    }
  }
  if (until) {
    const untilTs = new Date(until).getTime();
    if (!Number.isNaN(untilTs)) {
      conditions.push(lte(events.receivedAt, untilTs));
    }
  }

  // Fetch limit+1 to determine hasMore
  const eventList = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.receivedAt), desc(events.id))
    .limit(limit + 1);

  const hasMore = eventList.length > limit;
  const results = hasMore ? eventList.slice(0, limit) : eventList;
  const lastEvent = results[results.length - 1];

  return c.json({
    events: results.map((event) => ({
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
      cursor: hasMore && lastEvent ? lastEvent.id : null,
      hasMore,
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

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Use fanout service for replay (no receiving endpoint)
  const fanoutResult = await fanoutEvent(
    db,
    c.env.DELIVERY_QUEUE,
    { id: eventId, workspaceId: workspace.id, eventType: event.eventType },
    // No receivingEndpointId - this is a replay
  );

  if (fanoutResult.deliveries.length === 0) {
    return c.json({ error: 'No active endpoints to replay to' }, 400);
  }

  // Reset event status to processing
  await db
    .update(events)
    .set({ status: 'processing', processedAt: null })
    .where(eq(events.id, eventId));

  return c.json({
    replayed: true,
    eventId,
    deliveryIds: fanoutResult.deliveries.map((d) => d.deliveryId),
    endpointCount: fanoutResult.deliveries.length,
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

  const allDeliveryIds: string[] = [];
  let replayedCount = 0;

  for (const eventId of eventIds) {
    // Verify event belongs to workspace and get event type
    const event = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!event) {
      continue; // Skip events that don't exist or don't belong to workspace
    }

    // Use fanout service for replay
    const fanoutResult = await fanoutEvent(
      db,
      c.env.DELIVERY_QUEUE,
      { id: eventId, workspaceId: workspace.id, eventType: event.eventType },
      // No receivingEndpointId - this is a replay
    );

    allDeliveryIds.push(...fanoutResult.deliveries.map((d) => d.deliveryId));

    // Reset event status
    await db
      .update(events)
      .set({ status: 'processing', processedAt: null })
      .where(eq(events.id, eventId));

    replayedCount++;
  }

  if (replayedCount === 0) {
    return c.json({ error: 'No valid events found to replay' }, 400);
  }

  return c.json({
    replayed: true,
    count: replayedCount,
    deliveryIds: allDeliveryIds,
    endpointCount: allDeliveryIds.length,
  });
});

export default eventRoutes;
