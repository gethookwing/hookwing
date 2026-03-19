import {
  customDomains,
  generateId,
  getTierBySlug,
  isFeatureEnabled,
} from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';

const customDomainRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth
customDomainRoutes.use('/*', authMiddleware);

// ============================================================================
// Tier check middleware - Fighter Jet only
// ============================================================================

async function requireCustomDomainsTier(c: any, next: () => Promise<void>) {
  const workspace = getWorkspace(c);
  const tier = getTierBySlug(workspace.tierSlug);

  if (!tier || !isFeatureEnabled(tier, 'custom_domains')) {
    return c.json(
      {
        error: 'Custom domains require Fighter Jet tier',
        currentTier: workspace.tierSlug,
        requiredTier: 'fighter-jet',
      },
      403,
    );
  }

  await next();
}

customDomainRoutes.use('/*', requireCustomDomainsTier);

// ============================================================================
// POST /v1/domains — Register a custom domain
// ============================================================================

customDomainRoutes.post('/', requireApiKeyScopes(['domains:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const { domain } = body as { domain?: unknown };
  if (!domain || typeof domain !== 'string') {
    return c.json({ error: 'Domain is required' }, 400);
  }

  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(domain)) {
    return c.json({ error: 'Invalid domain format' }, 400);
  }

  const now = Date.now();
  const domainId = generateId('cd');

  try {
    await db.insert(customDomains).values({
      id: domainId,
      workspaceId: workspace.id,
      domain,
      status: 'pending',
      verifiedAt: null,
      createdAt: now,
    });
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed') || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return c.json({ error: 'Domain already in use' }, 409);
    }
    throw error;
  }

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
// GET /v1/domains — List workspace custom domains
// ============================================================================

customDomainRoutes.get('/', requireApiKeyScopes(['domains:read']), async (c) => {
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
// GET /v1/domains/:id — Get single domain
// ============================================================================

customDomainRoutes.get('/:id', requireApiKeyScopes(['domains:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const domainId = c.req.param('id');

  const domain = await db
    .select()
    .from(customDomains)
    .where(eq(customDomains.id, domainId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!domain || domain.workspaceId !== workspace.id) {
    return c.json({ error: 'Domain not found' }, 404);
  }

  return c.json({
    id: domain.id,
    workspaceId: domain.workspaceId,
    domain: domain.domain,
    status: domain.status,
    verifiedAt: domain.verifiedAt,
    createdAt: domain.createdAt,
  });
});

// ============================================================================
// DELETE /v1/domains/:id — Remove custom domain
// ============================================================================

customDomainRoutes.delete('/:id', requireApiKeyScopes(['domains:write']), async (c) => {
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

export default customDomainRoutes;
