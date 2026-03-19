import {
  events,
  deadLetterItems,
  deliveries,
  endpoints,
  getTierBySlug,
  isFeatureEnabled,
} from '@hookwing/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const deadLetterRoutes = new Hono<{ Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue } }>();

// All routes require auth + rate limiting
deadLetterRoutes.use('/*', authMiddleware);
deadLetterRoutes.use(
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

/**
 * Middleware to check if workspace has DLQ feature enabled
 */
const requireDlqFeature = async (c: Context, next: () => Promise<void>) => {
  const workspace = getWorkspace(c);
  const tier = getTierBySlug(workspace.tierSlug);

  if (!tier || !isFeatureEnabled(tier, 'dead_letter_queue')) {
    return c.json(
      {
        error: 'Forbidden',
        message:
          'Dead Letter Queue is not available on your current plan. Upgrade to Warbird or higher to access this feature.',
        upgradeRequired: true,
        currentTier: workspace.tierSlug,
        requiredTier: 'warbird',
      },
      403,
    );
  }

  return await next();
};

// Apply tier check to all routes
deadLetterRoutes.use('/*', requireDlqFeature);

// ============================================================================
// GET /v1/dead-letter — List DLQ items for workspace
// ============================================================================

deadLetterRoutes.get('/', requireApiKeyScopes(['deliveries:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // Parse pagination params
  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = Number.parseInt(c.req.query('offset') || '0', 10);

  // Parse filter params
  const status = c.req.query('status');

  // Build conditions
  const conditions = [eq(deadLetterItems.workspaceId, workspace.id)];

  if (status) {
    conditions.push(eq(deadLetterItems.status, status));
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ total: sql<number>`count(*)` })
    .from(deadLetterItems)
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  // Fetch DLQ items
  const items = await db
    .select()
    .from(deadLetterItems)
    .where(whereClause)
    .orderBy(desc(deadLetterItems.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    deadLetterItems: items.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      eventId: item.eventId,
      endpointId: item.endpointId,
      deliveryId: item.deliveryId,
      errorMessage: item.errorMessage,
      attempts: item.attempts,
      createdAt: item.createdAt,
      replayedAt: item.replayedAt,
      status: item.status,
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  });
});

// ============================================================================
// GET /v1/dead-letter/:id — Get single DLQ item
// ============================================================================

deadLetterRoutes.get('/:id', requireApiKeyScopes(['deliveries:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const itemId = c.req.param('id');

  // Fetch DLQ item by ID
  const item = await db
    .select()
    .from(deadLetterItems)
    .where(and(eq(deadLetterItems.id, itemId), eq(deadLetterItems.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!item) {
    return c.json({ error: 'Dead letter item not found' }, 404);
  }

  // Also fetch related records for context
  const [delivery, endpoint, event] = await Promise.all([
    db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, item.deliveryId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, item.endpointId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(events)
      .where(eq(events.id, item.eventId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  return c.json({
    id: item.id,
    workspaceId: item.workspaceId,
    eventId: item.eventId,
    endpointId: item.endpointId,
    deliveryId: item.deliveryId,
    errorMessage: item.errorMessage,
    attempts: item.attempts,
    createdAt: item.createdAt,
    replayedAt: item.replayedAt,
    status: item.status,
    delivery: delivery
      ? {
          id: delivery.id,
          status: delivery.status,
          responseStatusCode: delivery.responseStatusCode,
          errorMessage: delivery.errorMessage,
          attemptNumber: delivery.attemptNumber,
        }
      : null,
    endpoint: endpoint
      ? {
          id: endpoint.id,
          url: endpoint.url,
          description: endpoint.description,
        }
      : null,
    event: event
      ? {
          id: event.id,
          eventType: event.eventType,
          receivedAt: event.receivedAt,
        }
      : null,
  });
});

// ============================================================================
// POST /v1/dead-letter/:id/replay — Replay a DLQ item
// ============================================================================

deadLetterRoutes.post('/:id/replay', requireApiKeyScopes(['events:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const itemId = c.req.param('id');

  // Fetch DLQ item by ID
  const item = await db
    .select()
    .from(deadLetterItems)
    .where(and(eq(deadLetterItems.id, itemId), eq(deadLetterItems.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!item) {
    return c.json({ error: 'Dead letter item not found' }, 404);
  }

  if (item.status === 'replayed') {
    return c.json({ error: 'This item has already been replayed' }, 400);
  }

  // Check if delivery queue is available
  if (!c.env.DELIVERY_QUEUE) {
    return c.json({ error: 'Delivery queue not available' }, 503);
  }

  // Re-queue the delivery
  await c.env.DELIVERY_QUEUE.send({
    deliveryId: item.deliveryId,
    eventId: item.eventId,
    endpointId: item.endpointId,
    workspaceId: item.workspaceId,
    attempt: 1, // Start fresh with attempt 1
  });

  // Update the DLQ item status
  await db
    .update(deadLetterItems)
    .set({ status: 'replayed', replayedAt: Date.now() })
    .where(eq(deadLetterItems.id, itemId));

  return c.json({
    message: 'Delivery queued for replay',
    itemId: item.id,
    deliveryId: item.deliveryId,
  });
});

// ============================================================================
// DELETE /v1/dead-letter/:id — Dismiss/delete a DLQ item
// ============================================================================

deadLetterRoutes.delete('/:id', requireApiKeyScopes(['events:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const itemId = c.req.param('id');

  // Fetch DLQ item by ID
  const item = await db
    .select()
    .from(deadLetterItems)
    .where(and(eq(deadLetterItems.id, itemId), eq(deadLetterItems.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!item) {
    return c.json({ error: 'Dead letter item not found' }, 404);
  }

  // Delete the DLQ item
  await db.delete(deadLetterItems).where(eq(deadLetterItems.id, itemId));

  return c.json({
    message: 'Dead letter item deleted',
    itemId: item.id,
  });
});

export default deadLetterRoutes;
