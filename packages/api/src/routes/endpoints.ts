import { endpoints, generateEndpointSecret, generateId, getTierBySlug } from '@hookwing/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const endpointsRouter = new Hono<{ Bindings: { DB?: D1Database } }>();

// ============================================================================
// Validation schemas
// ============================================================================

const createEndpointSchema = z.object({
  url: z.string().url(),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.string()).optional(),
  rateLimitPerSecond: z.number().int().min(1).max(1000).optional(),
  metadata: z.record(z.string()).optional(),
});

const updateEndpointSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  rateLimitPerSecond: z.number().int().min(1).max(1000).optional(),
  metadata: z.record(z.string()).optional(),
});

// ============================================================================
// Helper: Check endpoint limit for workspace
// ============================================================================

async function checkEndpointLimit(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
  tierSlug: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const tier = getTierBySlug(tierSlug);
  if (!tier) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const limit = tier.limits.max_endpoints;

  const existingEndpoints = await db
    .select()
    .from(endpoints)
    .where(endpoints.workspaceId.equals(workspaceId));

  const current = existingEndpoints.length;

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

// ============================================================================
// POST /v1/endpoints - Create endpoint (authenticated)
// ============================================================================

endpointsRouter.post('/endpoints', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  // Validate input
  const parsed = createEndpointSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { url, description, eventTypes, rateLimitPerSecond, metadata } = parsed.data;

  // Check tier limit
  const limitCheck = await checkEndpointLimit(db, workspace.id, workspace.tierSlug);
  if (!limitCheck.allowed) {
    return c.json(
      {
        error: 'Endpoint limit reached',
        message: `Your ${workspace.tierSlug} plan allows up to ${limitCheck.limit} endpoints. You currently have ${limitCheck.current}.`,
      },
      403,
    );
  }

  const now = Date.now();
  const endpointId = generateId('ep');
  const secret = generateEndpointSecret();

  await db.insert(endpoints).values({
    id: endpointId,
    workspaceId: workspace.id,
    url,
    description: description ?? null,
    secret,
    eventTypes: eventTypes ? JSON.stringify(eventTypes) : null,
    isActive: 1,
    rateLimitPerSecond: rateLimitPerSecond ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      endpoint: {
        id: endpointId,
        url,
        description,
        secret,
        eventTypes,
        isActive: true,
        rateLimitPerSecond,
        metadata,
        createdAt: now,
      },
    },
    201,
  );
});

// ============================================================================
// GET /v1/endpoints - List endpoints (authenticated)
// ============================================================================

endpointsRouter.get('/endpoints', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // Parse query params
  const activeParam = c.req.query('active');
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');

  const isActiveFilter = activeParam === 'true' ? 1 : activeParam === 'false' ? 0 : undefined;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

  // Build query
  let query = db.select().from(endpoints).where(endpoints.workspaceId.equals(workspace.id));

  if (isActiveFilter !== undefined) {
    query = query.and(endpoints.isActive.equals(isActiveFilter));
  }

  const allEndpoints = await query;
  const total = allEndpoints.length;

  // Apply pagination
  const paginatedEndpoints = allEndpoints.slice(offset, offset + limit);

  // Return WITHOUT secret
  return c.json({
    endpoints: paginatedEndpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      description: ep.description,
      eventTypes: ep.eventTypes ? JSON.parse(ep.eventTypes) : null,
      isActive: Boolean(ep.isActive),
      rateLimitPerSecond: ep.rateLimitPerSecond,
      metadata: ep.metadata ? JSON.parse(ep.metadata) : null,
      createdAt: ep.createdAt,
      updatedAt: ep.updatedAt,
    })),
    total,
  });
});

// ============================================================================
// GET /v1/endpoints/:id - Get endpoint detail (authenticated)
// ============================================================================

endpointsRouter.get('/endpoints/:id', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');

  const endpoint = await db
    .select()
    .from(endpoints)
    .where(endpoints.id.equals(endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!endpoint || endpoint.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Return WITH secret
  return c.json({
    endpoint: {
      id: endpoint.id,
      url: endpoint.url,
      description: endpoint.description,
      secret: endpoint.secret,
      eventTypes: endpoint.eventTypes ? JSON.parse(endpoint.eventTypes) : null,
      isActive: Boolean(endpoint.isActive),
      rateLimitPerSecond: endpoint.rateLimitPerSecond,
      metadata: endpoint.metadata ? JSON.parse(endpoint.metadata) : null,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    },
  });
});

// ============================================================================
// PATCH /v1/endpoints/:id - Update endpoint (authenticated)
// ============================================================================

endpointsRouter.patch('/endpoints/:id', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');
  const body = await c.req.json();

  // Validate input
  const parsed = updateEndpointSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  // Check endpoint exists and belongs to workspace
  const existing = await db
    .select()
    .from(endpoints)
    .where(endpoints.id.equals(endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Build update values
  const updateData: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  if (parsed.data.url !== undefined) {
    updateData.url = parsed.data.url;
  }
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }
  if (parsed.data.eventTypes !== undefined) {
    updateData.eventTypes = JSON.stringify(parsed.data.eventTypes);
  }
  if (parsed.data.isActive !== undefined) {
    updateData.isActive = parsed.data.isActive ? 1 : 0;
  }
  if (parsed.data.rateLimitPerSecond !== undefined) {
    updateData.rateLimitPerSecond = parsed.data.rateLimitPerSecond;
  }
  if (parsed.data.metadata !== undefined) {
    updateData.metadata = JSON.stringify(parsed.data.metadata);
  }

  await db.update(endpoints).set(updateData).where(endpoints.id.equals(endpointId));

  // Fetch updated endpoint
  const updated = await db
    .select()
    .from(endpoints)
    .where(endpoints.id.equals(endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  return c.json({
    endpoint: {
      id: updated?.id,
      url: updated?.url,
      description: updated?.description,
      eventTypes: updated?.eventTypes ? JSON.parse(updated?.eventTypes) : null,
      isActive: Boolean(updated?.isActive),
      rateLimitPerSecond: updated?.rateLimitPerSecond,
      metadata: updated?.metadata ? JSON.parse(updated?.metadata) : null,
      createdAt: updated?.createdAt,
      updatedAt: updated?.updatedAt,
    },
  });
});

// ============================================================================
// DELETE /v1/endpoints/:id - Delete endpoint (authenticated)
// ============================================================================

endpointsRouter.delete('/endpoints/:id', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');

  const endpoint = await db
    .select()
    .from(endpoints)
    .where(endpoints.id.equals(endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!endpoint || endpoint.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Hard delete (cascade will handle related deliveries)
  await db.delete(endpoints).where(endpoints.id.equals(endpointId));

  return c.json({ deleted: true, id: endpointId });
});

// ============================================================================
// POST /v1/endpoints/:id/rotate-secret - Rotate endpoint secret (authenticated)
// ============================================================================

endpointsRouter.post('/endpoints/:id/rotate-secret', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');

  const endpoint = await db
    .select()
    .from(endpoints)
    .where(endpoints.id.equals(endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!endpoint || endpoint.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Generate new secret
  const newSecret = generateEndpointSecret();

  await db
    .update(endpoints)
    .set({ secret: newSecret, updatedAt: Date.now() })
    .where(endpoints.id.equals(endpointId));

  return c.json({
    endpoint: {
      id: endpointId,
      secret: newSecret,
    },
  });
});

export default endpointsRouter;
