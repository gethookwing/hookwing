import {
  endpointCreateSchema,
  endpointUpdateSchema,
  endpoints,
  generateId,
  generateSigningSecret,
} from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const endpointRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth
endpointRoutes.use('/*', authMiddleware);

// ============================================================================
// POST /v1/endpoints — Create endpoint
// ============================================================================

endpointRoutes.post('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = endpointCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { url, description, eventTypes, metadata } = parsed.data;
  const signingSecret = await generateSigningSecret();
  const now = Date.now();

  const endpointId = generateId('ep');

  await db.insert(endpoints).values({
    id: endpointId,
    workspaceId: workspace.id,
    url,
    description: description ?? null,
    secret: signingSecret,
    eventTypes: eventTypes ? JSON.stringify(eventTypes) : null,
    isActive: 1,
    rateLimitPerSecond: null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      id: endpointId,
      workspaceId: workspace.id,
      url,
      description,
      secret: signingSecret,
      eventTypes: eventTypes ?? null,
      isActive: true,
      rateLimitPerSecond: null,
      metadata: metadata ?? null,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
});

// ============================================================================
// GET /v1/endpoints — List all endpoints for workspace
// ============================================================================

endpointRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const endpointList = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.workspaceId, workspace.id));

  return c.json({
    endpoints: endpointList.map((ep) => ({
      id: ep.id,
      workspaceId: ep.workspaceId,
      url: ep.url,
      description: ep.description,
      eventTypes: ep.eventTypes ? JSON.parse(ep.eventTypes) : null,
      isActive: Boolean(ep.isActive),
      rateLimitPerSecond: ep.rateLimitPerSecond,
      metadata: ep.metadata ? JSON.parse(ep.metadata) : null,
      createdAt: ep.createdAt,
      updatedAt: ep.updatedAt,
    })),
  });
});

// ============================================================================
// GET /v1/endpoints/:id — Get single endpoint
// ============================================================================

endpointRoutes.get('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');

  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!endpoint || endpoint.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  return c.json({
    id: endpoint.id,
    workspaceId: endpoint.workspaceId,
    url: endpoint.url,
    description: endpoint.description,
    eventTypes: endpoint.eventTypes ? JSON.parse(endpoint.eventTypes) : null,
    isActive: Boolean(endpoint.isActive),
    rateLimitPerSecond: endpoint.rateLimitPerSecond,
    metadata: endpoint.metadata ? JSON.parse(endpoint.metadata) : null,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  });
});

// ============================================================================
// PATCH /v1/endpoints/:id — Update endpoint
// ============================================================================

endpointRoutes.patch('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');
  const body = await c.req.json();

  const parsed = endpointUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  const { url, description, eventTypes, isActive, metadata } = parsed.data;
  const now = Date.now();

  const updateFields: Record<string, unknown> = { updatedAt: now };

  if (url !== undefined) updateFields.url = url;
  if (description !== undefined) updateFields.description = description;
  if (eventTypes !== undefined)
    updateFields.eventTypes = eventTypes ? JSON.stringify(eventTypes) : null;
  if (isActive !== undefined) updateFields.isActive = isActive ? 1 : 0;
  if (metadata !== undefined) updateFields.metadata = metadata ? JSON.stringify(metadata) : null;

  await db.update(endpoints).set(updateFields).where(eq(endpoints.id, endpointId));

  const updated = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  return c.json({
    id: updated!.id,
    workspaceId: updated!.workspaceId,
    url: updated!.url,
    description: updated!.description,
    eventTypes: updated!.eventTypes ? JSON.parse(updated!.eventTypes) : null,
    isActive: Boolean(updated!.isActive),
    rateLimitPerSecond: updated!.rateLimitPerSecond,
    metadata: updated!.metadata ? JSON.parse(updated!.metadata) : null,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
  });
});

// ============================================================================
// DELETE /v1/endpoints/:id — Hard delete endpoint
// ============================================================================

endpointRoutes.delete('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('id');

  const existing = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  await db.delete(endpoints).where(eq(endpoints.id, endpointId));

  return c.status(204);
});

export default endpointRoutes;
