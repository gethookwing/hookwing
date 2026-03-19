import { customDomains, generateId, getTierBySlug, isFeatureEnabled } from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const domainRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth + rate limiting
domainRoutes.use('/*', authMiddleware);
domainRoutes.use(
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
// POST /v1/domains — Register a custom domain
// ============================================================================

domainRoutes.post('/', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // Check tier feature flag
  const tier = getTierBySlug(workspace.tierSlug);
  if (!tier || !isFeatureEnabled(tier, 'custom_domains')) {
    return c.json(
      {
        error: 'Feature not available',
        message: 'Custom domains require the Fighter Jet tier',
        tier: workspace.tierSlug,
      },
      403,
    );
  }

  const body = await c.req.json();
  const { domain } = body as { domain?: unknown };

  if (!domain || typeof domain !== 'string') {
    return c.json({ error: 'Invalid input', message: 'domain is required' }, 400);
  }

  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
  if (!domainRegex.test(domain)) {
    return c.json({ error: 'Invalid input', message: 'Invalid domain format' }, 400);
  }

  // Check for duplicate domain
  const existing = await db
    .select()
    .from(customDomains)
    .where(eq(customDomains.domain, domain))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    return c.json({ error: 'Domain already registered', domain }, 409);
  }

  const now = Date.now();
  const domainId = generateId('cd');

  await db.insert(customDomains).values({
    id: domainId,
    workspaceId: workspace.id,
    domain,
    status: 'pending',
    verifiedAt: null,
    createdAt: now,
  });

  return c.json(
    {
      id: domainId,
      workspaceId: workspace.id,
      domain,
      status: 'pending',
      verifiedAt: null,
      createdAt: now,
    },
    201,
  );
});

// ============================================================================
// GET /v1/domains — List all domains for workspace
// ============================================================================

domainRoutes.get('/', requireApiKeyScopes(['endpoints:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const domainList = await db
    .select()
    .from(customDomains)
    .where(eq(customDomains.workspaceId, workspace.id));

  return c.json({
    domains: domainList.map((d) => ({
      id: d.id,
      workspaceId: d.workspaceId,
      domain: d.domain,
      status: d.status,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    })),
  });
});

// ============================================================================
// DELETE /v1/domains/:id — Remove a domain
// ============================================================================

domainRoutes.delete('/:id', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const domainId = c.req.param('id');

  const existing = await db
    .select()
    .from(customDomains)
    .where(eq(customDomains.id, domainId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Domain not found' }, 404);
  }

  await db.delete(customDomains).where(eq(customDomains.id, domainId));

  return c.status(204);
});

export default domainRoutes;
