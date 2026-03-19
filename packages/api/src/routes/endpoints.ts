import {
  endpointCreateSchema,
  endpointUpdateSchema,
  endpoints,
  generateId,
  generateSigningSecret,
  getTierBySlug,
  getUpgradePath,
  isFeatureEnabled,
  validateIpWhitelist,
} from '@hookwing/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

// Reserved header names that cannot be overridden
const RESERVED_HEADERS = [
  'authorization',
  'host',
  'content-type',
  'x-hookwing-signature',
  'x-hookwing-event',
  'x-hookwing-delivery-id',
  'x-hookwing-attempt',
];

// Validate custom headers: max 10, no reserved names, only valid header names
function validateCustomHeaders(headers: Record<string, string> | undefined): string | null {
  if (!headers || Object.keys(headers).length === 0) {
    return null;
  }

  if (Object.keys(headers).length > 10) {
    return 'Maximum 10 custom headers allowed';
  }

  for (const name of Object.keys(headers)) {
    const lowerName = name.toLowerCase();
    if (RESERVED_HEADERS.includes(lowerName)) {
      return `Reserved header name not allowed: ${name}`;
    }
    // Basic header name validation: alphanumeric and hyphens only
    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return `Invalid header name: ${name}`;
    }
    if (typeof headers[name] !== 'string') {
      return `Header value must be a string: ${name}`;
    }
  }

  return null;
}

const endpointRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth + rate limiting
endpointRoutes.use('/*', authMiddleware);
endpointRoutes.use(
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
// POST /v1/endpoints — Create endpoint
// ============================================================================

endpointRoutes.post('/', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = endpointCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  // Check tier limit for max_destinations
  const tier = getTierBySlug(workspace.tierSlug);
  if (tier) {
    const existingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(endpoints)
      .where(eq(endpoints.workspaceId, workspace.id));

    const count = existingCount[0]?.count ?? 0;
    if (count >= tier.limits.max_destinations) {
      return c.json(
        {
          error: 'Endpoint limit reached',
          limit: tier.limits.max_destinations,
          current: count,
          tier: workspace.tierSlug,
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }
  }

  const { url, description, eventTypes, fanoutEnabled, metadata, customHeaders, ipWhitelist } =
    parsed.data;

  // Tier-gate custom headers
  if (customHeaders && Object.keys(customHeaders).length > 0) {
    if (!tier || !isFeatureEnabled(tier, 'custom_headers')) {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: workspace.tierSlug,
          feature: 'custom_headers',
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }

    const validationError = validateCustomHeaders(customHeaders);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }
  }

  // Tier-gate IP whitelist
  if (ipWhitelist && ipWhitelist.length > 0) {
    if (!tier || !isFeatureEnabled(tier, 'ip_whitelist')) {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: workspace.tierSlug,
          feature: 'ip_whitelist',
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }

    const validationError = validateIpWhitelist(ipWhitelist);
    if (!validationError.valid) {
      return c.json({ error: validationError.error }, 400);
    }
  }

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
    fanoutEnabled: fanoutEnabled !== false ? 1 : 0,
    rateLimitPerSecond: null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    customHeaders: customHeaders ? JSON.stringify(customHeaders) : null,
    ipWhitelist: ipWhitelist ? JSON.stringify(ipWhitelist) : null,
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
      fanoutEnabled: fanoutEnabled !== false,
      isActive: true,
      rateLimitPerSecond: null,
      metadata: metadata ?? null,
      customHeaders: customHeaders ?? null,
      ipWhitelist: ipWhitelist ?? null,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
});

// ============================================================================
// GET /v1/endpoints — List all endpoints for workspace
// ============================================================================

endpointRoutes.get('/', requireApiKeyScopes(['endpoints:read']), async (c) => {
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
      fanoutEnabled: Boolean(ep.fanoutEnabled),
      isActive: Boolean(ep.isActive),
      rateLimitPerSecond: ep.rateLimitPerSecond,
      metadata: ep.metadata ? JSON.parse(ep.metadata) : null,
      customHeaders: ep.customHeaders ? JSON.parse(ep.customHeaders) : null,
      ipWhitelist: ep.ipWhitelist ? JSON.parse(ep.ipWhitelist) : null,
      createdAt: ep.createdAt,
      updatedAt: ep.updatedAt,
    })),
  });
});

// ============================================================================
// GET /v1/endpoints/:id — Get single endpoint
// ============================================================================

endpointRoutes.get('/:id', requireApiKeyScopes(['endpoints:read']), async (c) => {
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
    fanoutEnabled: Boolean(endpoint.fanoutEnabled),
    isActive: Boolean(endpoint.isActive),
    rateLimitPerSecond: endpoint.rateLimitPerSecond,
    metadata: endpoint.metadata ? JSON.parse(endpoint.metadata) : null,
    customHeaders: endpoint.customHeaders ? JSON.parse(endpoint.customHeaders) : null,
    ipWhitelist: endpoint.ipWhitelist ? JSON.parse(endpoint.ipWhitelist) : null,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  });
});

// ============================================================================
// PATCH /v1/endpoints/:id — Update endpoint
// ============================================================================

endpointRoutes.patch('/:id', requireApiKeyScopes(['endpoints:write']), async (c) => {
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

  const {
    url,
    description,
    eventTypes,
    isActive,
    fanoutEnabled,
    metadata,
    customHeaders,
    ipWhitelist,
  } = parsed.data;

  // Tier-gate custom headers updates
  if (customHeaders !== undefined) {
    const tier = getTierBySlug(workspace.tierSlug);
    if (!tier || !isFeatureEnabled(tier, 'custom_headers')) {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: workspace.tierSlug,
          feature: 'custom_headers',
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }

    if (customHeaders !== null) {
      const validationError = validateCustomHeaders(customHeaders);
      if (validationError) {
        return c.json({ error: validationError }, 400);
      }
    }
  }

  // Tier-gate IP whitelist updates
  if (ipWhitelist !== undefined) {
    const tier = getTierBySlug(workspace.tierSlug);
    if (!tier || !isFeatureEnabled(tier, 'ip_whitelist')) {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: workspace.tierSlug,
          feature: 'ip_whitelist',
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }

    if (ipWhitelist !== null) {
      const validationError = validateIpWhitelist(ipWhitelist);
      if (!validationError.valid) {
        return c.json({ error: validationError.error }, 400);
      }
    }
  }

  const now = Date.now();

  const updateFields: Record<string, unknown> = { updatedAt: now };

  if (url !== undefined) updateFields.url = url;
  if (description !== undefined) updateFields.description = description;
  if (eventTypes !== undefined)
    updateFields.eventTypes = eventTypes ? JSON.stringify(eventTypes) : null;
  if (isActive !== undefined) updateFields.isActive = isActive ? 1 : 0;
  if (fanoutEnabled !== undefined) updateFields.fanoutEnabled = fanoutEnabled ? 1 : 0;
  if (metadata !== undefined) updateFields.metadata = metadata ? JSON.stringify(metadata) : null;
  if (customHeaders !== undefined)
    updateFields.customHeaders = customHeaders ? JSON.stringify(customHeaders) : null;
  if (ipWhitelist !== undefined)
    updateFields.ipWhitelist = ipWhitelist ? JSON.stringify(ipWhitelist) : null;

  await db.update(endpoints).set(updateFields).where(eq(endpoints.id, endpointId));

  const updated = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!updated) {
    return c.json({ error: 'Endpoint not found after update' }, 500);
  }

  return c.json({
    id: updated.id,
    workspaceId: updated.workspaceId,
    url: updated.url,
    description: updated.description,
    eventTypes: updated.eventTypes ? JSON.parse(updated.eventTypes) : null,
    fanoutEnabled: Boolean(updated.fanoutEnabled),
    isActive: Boolean(updated.isActive),
    rateLimitPerSecond: updated.rateLimitPerSecond,
    metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
    customHeaders: updated.customHeaders ? JSON.parse(updated.customHeaders) : null,
    ipWhitelist: updated.ipWhitelist ? JSON.parse(updated.ipWhitelist) : null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

// ============================================================================
// DELETE /v1/endpoints/:id — Hard delete endpoint
// ============================================================================

endpointRoutes.delete('/:id', requireApiKeyScopes(['endpoints:write']), async (c) => {
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
