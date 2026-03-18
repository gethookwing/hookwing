import { getTierBySlug, usageDaily } from '@hookwing/shared';
import { and, desc, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

const analyticsRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

analyticsRoutes.use('/*', authMiddleware);
analyticsRoutes.use(
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
// GET /v1/analytics/usage — Daily usage stats for workspace
// ============================================================================

const usageQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Number.parseInt(v, 10), 90) : 30))
    .pipe(z.number().int().min(1).max(90)),
});

analyticsRoutes.get('/usage', requireApiKeyScopes(['analytics:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const query = usageQuerySchema.safeParse({ days: c.req.query('days') });
  const days = query.success ? query.data.days : 30;

  // Calculate date N days ago (YYYY-MM-DD)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.workspaceId, workspace.id), gte(usageDaily.date, since)))
    .orderBy(desc(usageDaily.date));

  // Aggregate totals
  const totals = rows.reduce(
    (acc, row) => ({
      eventsReceived: acc.eventsReceived + row.eventsReceived,
      deliveriesAttempted: acc.deliveriesAttempted + row.deliveriesAttempted,
      deliveriesSucceeded: acc.deliveriesSucceeded + row.deliveriesSucceeded,
      deliveriesFailed: acc.deliveriesFailed + row.deliveriesFailed,
    }),
    { eventsReceived: 0, deliveriesAttempted: 0, deliveriesSucceeded: 0, deliveriesFailed: 0 },
  );

  const deliverySuccessRate =
    totals.deliveriesAttempted > 0
      ? Math.round((totals.deliveriesSucceeded / totals.deliveriesAttempted) * 10000) / 100
      : null;

  return c.json({
    workspace: { id: workspace.id, tier: workspace.tierSlug },
    period: { days, since },
    totals: { ...totals, deliverySuccessRate },
    daily: rows.map((r) => ({
      date: r.date,
      eventsReceived: r.eventsReceived,
      deliveriesAttempted: r.deliveriesAttempted,
      deliveriesSucceeded: r.deliveriesSucceeded,
      deliveriesFailed: r.deliveriesFailed,
    })),
  });
});

// ============================================================================
// GET /v1/analytics/summary — Quick stats snapshot
// ============================================================================

analyticsRoutes.get('/summary', requireApiKeyScopes(['analytics:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const tier = getTierBySlug(workspace.tierSlug);

  // Today's usage
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = await db
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.workspaceId, workspace.id), eq(usageDaily.date, today)))
    .limit(1)
    .then((rows) => rows[0]);

  // This month's usage
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`; // YYYY-MM-01
  const monthRows = await db
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.workspaceId, workspace.id), gte(usageDaily.date, monthStart)));

  const monthlyEvents = monthRows.reduce((sum, r) => sum + r.eventsReceived, 0);

  return c.json({
    today: {
      eventsReceived: todayRow?.eventsReceived ?? 0,
      deliveriesAttempted: todayRow?.deliveriesAttempted ?? 0,
      deliveriesSucceeded: todayRow?.deliveriesSucceeded ?? 0,
      deliveriesFailed: todayRow?.deliveriesFailed ?? 0,
    },
    month: {
      eventsReceived: monthlyEvents,
      limit: tier?.limits.max_events_per_month ?? null,
      percentUsed:
        tier != null
          ? Math.round((monthlyEvents / tier.limits.max_events_per_month) * 10000) / 100
          : null,
    },
    tier: {
      slug: workspace.tierSlug,
      name: tier?.name ?? workspace.tierSlug,
      limits: tier?.limits ?? null,
    },
  });
});

export default analyticsRoutes;
