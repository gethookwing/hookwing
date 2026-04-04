import { getTierBySlug, workspaceOtelSettings } from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const otelRoutes = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { workspace: import('@hookwing/shared').Workspace; apiKey: unknown };
}>();

otelRoutes.use('/*', authMiddleware);

// Tier gating: only stealth-jet tier can configure OTel
const requireStealthJet: import('hono').MiddlewareHandler = async (c, next) => {
  const workspace = getWorkspace(c);
  if (workspace.tierSlug !== 'stealth-jet') {
    const tier = getTierBySlug(workspace.tierSlug);
    return c.json(
      {
        error: 'Forbidden',
        message: 'OTel configuration requires the Stealth Jet tier',
        currentTier: tier?.name || workspace.tierSlug,
        upgradePath: '/billing',
      },
      403,
    );
  }
  return next();
};

otelRoutes.use('/*', requireStealthJet);

const otelSettingsSchema = z.object({
  otlpEndpoint: z.string().url('otlpEndpoint must be a valid URL'),
  otlpHeaders: z.record(z.string()).optional(),
});

// ============================================================================
// GET /v1/otel/settings — Get workspace OTel settings
// ============================================================================

otelRoutes.get('/settings', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const settings = await db
    .select()
    .from(workspaceOtelSettings)
    .where(eq(workspaceOtelSettings.workspaceId, workspace.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!settings) {
    return c.json({ settings: null });
  }

  return c.json({
    settings: {
      otlpEndpoint: settings.otlpEndpoint,
      otlpHeaders: settings.otlpHeaders ? JSON.parse(settings.otlpHeaders) : null,
      enabled: settings.enabled === 1,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    },
  });
});

// ============================================================================
// PUT /v1/otel/settings — Create or update workspace OTel settings
// ============================================================================

otelRoutes.put('/settings', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const body = await c.req.json();
  const parsed = otelSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { otlpEndpoint, otlpHeaders } = parsed.data;
  const now = Date.now();

  // Check if settings already exist
  const existing = await db
    .select()
    .from(workspaceOtelSettings)
    .where(eq(workspaceOtelSettings.workspaceId, workspace.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    await db
      .update(workspaceOtelSettings)
      .set({
        otlpEndpoint,
        otlpHeaders: otlpHeaders ? JSON.stringify(otlpHeaders) : null,
        enabled: 1,
        updatedAt: now,
      })
      .where(eq(workspaceOtelSettings.workspaceId, workspace.id));
  } else {
    await db.insert(workspaceOtelSettings).values({
      workspaceId: workspace.id,
      otlpEndpoint,
      otlpHeaders: otlpHeaders ? JSON.stringify(otlpHeaders) : null,
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({
    settings: {
      otlpEndpoint,
      otlpHeaders: otlpHeaders || null,
      enabled: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    },
  });
});

// ============================================================================
// DELETE /v1/otel/settings — Delete workspace OTel settings
// ============================================================================

otelRoutes.delete('/settings', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  await db.delete(workspaceOtelSettings).where(eq(workspaceOtelSettings.workspaceId, workspace.id));

  return c.json({ deleted: true });
});

export default otelRoutes;
