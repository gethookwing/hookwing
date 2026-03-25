/**
 * Routing Rules API — Event Routing & Filtering Layer
 */

import {
  endpoints,
  generateId,
  getTierBySlug,
  getUpgradePath,
  routingRules,
} from '@hookwing/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import { evaluateConditions, type Condition } from '../services/rule-engine';
import { applyTransform } from '../services/transforms';

// ============================================================================
// Schemas
// ============================================================================

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'starts_with',
    'gt',
    'gte',
    'lt',
    'lte',
    'exists',
    'in',
    'regex',
  ]),
  value: z.unknown(),
});

const transformSchema = z.object({
  type: z.enum(['extract', 'rename', 'template']),
  config: z.record(z.unknown()),
});

const actionSchema = z.object({
  type: z.enum(['deliver', 'drop']).default('deliver'),
  endpointId: z.string().optional(),
  transform: transformSchema.optional(),
});

export const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.number().int().min(0).max(1000).default(0),
  conditions: z.array(conditionSchema).min(1),
  action: actionSchema,
  enabled: z.boolean().default(true),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  conditions: z.array(conditionSchema).min(1).optional(),
  action: actionSchema.optional(),
  enabled: z.boolean().optional(),
});

export const testRuleSchema = z.object({
  event: z.object({
    type: z.string(),
    payload: z.unknown().optional(),
    headers: z.record(z.string()).optional(),
  }),
  ruleId: z.string().optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type TestRuleInput = z.infer<typeof testRuleSchema>;

// ============================================================================
// Tier-gating helpers
// ============================================================================

async function checkRoutingRulesLimit(
  db: ReturnType<typeof createDb>,
  workspace: { id: string; tierSlug: string },
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  upgradePath: ReturnType<typeof getUpgradePath>;
}> {
  const tier = getTierBySlug(workspace.tierSlug);
  if (!tier) {
    return { allowed: false, current: 0, limit: 0, upgradePath: [] };
  }

  const maxRules = tier.limits.max_routing_rules;
  if (maxRules === 0) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      upgradePath: getUpgradePath(workspace.tierSlug),
    };
  }

  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(routingRules)
    .where(eq(routingRules.workspaceId, workspace.id));

  const count = existingCount[0]?.count ?? 0;
  const allowed = count < maxRules;

  return {
    allowed,
    current: count,
    limit: maxRules,
    upgradePath: getUpgradePath(workspace.tierSlug),
  };
}

function checkTransformAccess(
  tierSlug: string,
  transformType?: string,
): { allowed: boolean; feature: string } {
  const tier = getTierBySlug(tierSlug);
  if (!tier) {
    return { allowed: false, feature: 'transformations' };
  }

  // Paper Plane: no transforms at all
  if (tier.slug === 'paper-plane') {
    return { allowed: false, feature: 'routing_rules' };
  }

  // Warbird: only 'extract' transform
  if (tier.slug === 'warbird') {
    if (!transformType || transformType === 'extract') {
      return { allowed: true, feature: 'transformations' };
    }
    return { allowed: false, feature: 'full_transforms' };
  }

  // Stealth Jet: all transforms
  return { allowed: true, feature: 'transformations' };
}

// ============================================================================
// Route Handler
// ============================================================================

const ruleRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// All routes require auth + rate limiting
ruleRoutes.use('/*', authMiddleware);
ruleRoutes.use(
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
// POST /v1/routing-rules — Create rule
// ============================================================================

ruleRoutes.post('/', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  // Check tier limit for max_routing_rules
  const limitCheck = await checkRoutingRulesLimit(db, workspace);
  if (!limitCheck.allowed) {
    return c.json(
      {
        error:
          limitCheck.limit === 0
            ? 'Routing rules not available on your tier'
            : 'Routing rule limit reached',
        limit: limitCheck.limit,
        current: limitCheck.current,
        tier: workspace.tierSlug,
        upgradePath: limitCheck.upgradePath,
      },
      403,
    );
  }

  // Validate transform access
  if (parsed.data.action.transform) {
    const transformCheck = checkTransformAccess(
      workspace.tierSlug,
      parsed.data.action.transform.type,
    );
    if (!transformCheck.allowed) {
      return c.json(
        {
          error: 'Transform type not available on your tier',
          tier: workspace.tierSlug,
          transformType: parsed.data.action.transform.type,
          feature: transformCheck.feature,
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }
  }

  // If action has endpointId, verify it exists and belongs to workspace
  if (parsed.data.action.endpointId) {
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, parsed.data.action.endpointId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!endpoint || endpoint.workspaceId !== workspace.id) {
      return c.json(
        { error: 'Endpoint not found', endpointId: parsed.data.action.endpointId },
        404,
      );
    }
  }

  const ruleId = generateId('rule');
  const now = Date.now();

  await db.insert(routingRules).values({
    id: ruleId,
    workspaceId: workspace.id,
    name: parsed.data.name,
    priority: parsed.data.priority,
    conditions: JSON.stringify(parsed.data.conditions),
    actionType: parsed.data.action.type,
    actionEndpointId: parsed.data.action.endpointId ?? null,
    actionTransform: parsed.data.action.transform
      ? JSON.stringify(parsed.data.action.transform)
      : null,
    enabled: parsed.data.enabled ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      id: ruleId,
      workspaceId: workspace.id,
      name: parsed.data.name,
      priority: parsed.data.priority,
      conditions: parsed.data.conditions,
      action: {
        type: parsed.data.action.type,
        endpointId: parsed.data.action.endpointId,
        transform: parsed.data.action.transform,
      },
      enabled: parsed.data.enabled,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
});

// ============================================================================
// GET /v1/routing-rules — List rules
// ============================================================================

ruleRoutes.get('/', requireApiKeyScopes(['endpoints:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const rules = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.workspaceId, workspace.id))
    .orderBy(asc(routingRules.priority));

  return c.json({
    rules: rules.map((rule) => ({
      id: rule.id,
      workspaceId: rule.workspaceId,
      name: rule.name,
      priority: rule.priority,
      conditions: JSON.parse(rule.conditions),
      action: {
        type: rule.actionType,
        endpointId: rule.actionEndpointId,
        transform: rule.actionTransform ? JSON.parse(rule.actionTransform) : null,
      },
      enabled: Boolean(rule.enabled),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    })),
  });
});

// ============================================================================
// GET /v1/routing-rules/:id — Get rule
// ============================================================================

ruleRoutes.get('/:id', requireApiKeyScopes(['endpoints:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const ruleId = c.req.param('id');

  const rule = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.id, ruleId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!rule || rule.workspaceId !== workspace.id) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  return c.json({
    id: rule.id,
    workspaceId: rule.workspaceId,
    name: rule.name,
    priority: rule.priority,
    conditions: JSON.parse(rule.conditions),
    action: {
      type: rule.actionType,
      endpointId: rule.actionEndpointId,
      transform: rule.actionTransform ? JSON.parse(rule.actionTransform) : null,
    },
    enabled: Boolean(rule.enabled),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  });
});

// ============================================================================
// PATCH /v1/routing-rules/:id — Update rule
// ============================================================================

ruleRoutes.patch('/:id', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const ruleId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.id, ruleId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  // Validate transform access if changing transform
  if (parsed.data.action?.transform) {
    const transformCheck = checkTransformAccess(
      workspace.tierSlug,
      parsed.data.action.transform.type,
    );
    if (!transformCheck.allowed) {
      return c.json(
        {
          error: 'Transform type not available on your tier',
          tier: workspace.tierSlug,
          transformType: parsed.data.action.transform.type,
          feature: transformCheck.feature,
          upgradePath: getUpgradePath(workspace.tierSlug),
        },
        403,
      );
    }
  }

  // If action has endpointId, verify it exists and belongs to workspace
  if (parsed.data.action?.endpointId) {
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, parsed.data.action.endpointId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!endpoint || endpoint.workspaceId !== workspace.id) {
      return c.json(
        { error: 'Endpoint not found', endpointId: parsed.data.action.endpointId },
        404,
      );
    }
  }

  const now = Date.now();
  const updateFields: Record<string, unknown> = { updatedAt: now };

  if (parsed.data.name !== undefined) updateFields.name = parsed.data.name;
  if (parsed.data.priority !== undefined) updateFields.priority = parsed.data.priority;
  if (parsed.data.conditions !== undefined)
    updateFields.conditions = JSON.stringify(parsed.data.conditions);
  if (parsed.data.action !== undefined) {
    updateFields.actionType = parsed.data.action.type;
    updateFields.actionEndpointId = parsed.data.action.endpointId ?? null;
    updateFields.actionTransform = parsed.data.action.transform
      ? JSON.stringify(parsed.data.action.transform)
      : null;
  }
  if (parsed.data.enabled !== undefined) updateFields.enabled = parsed.data.enabled ? 1 : 0;

  await db.update(routingRules).set(updateFields).where(eq(routingRules.id, ruleId));

  const updated = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.id, ruleId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!updated) {
    return c.json({ error: 'Rule not found after update' }, 500);
  }

  return c.json({
    id: updated.id,
    workspaceId: updated.workspaceId,
    name: updated.name,
    priority: updated.priority,
    conditions: JSON.parse(updated.conditions),
    action: {
      type: updated.actionType,
      endpointId: updated.actionEndpointId,
      transform: updated.actionTransform ? JSON.parse(updated.actionTransform) : null,
    },
    enabled: Boolean(updated.enabled),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

// ============================================================================
// DELETE /v1/routing-rules/:id — Delete rule
// ============================================================================

ruleRoutes.delete('/:id', requireApiKeyScopes(['endpoints:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const ruleId = c.req.param('id');

  const existing = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.id, ruleId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.workspaceId !== workspace.id) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  await db.delete(routingRules).where(eq(routingRules.id, ruleId));

  return c.status(204);
});

// ============================================================================
// POST /v1/routing-rules/test — Dry-run test
// ============================================================================

ruleRoutes.post('/test', requireApiKeyScopes(['endpoints:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = testRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { event, ruleId } = parsed.data;

  // Load rules for workspace
  let rules = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.workspaceId, workspace.id))
    .orderBy(asc(routingRules.priority));

  // If specific ruleId provided, filter to that rule
  if (ruleId) {
    rules = rules.filter((r) => r.id === ruleId);
    if (rules.length === 0) {
      return c.json({ error: 'Rule not found', ruleId }, 404);
    }
  }

  const eventContext = {
    type: event.type,
    payload: event.payload ?? {},
    headers: event.headers ?? {},
  };

  const matchedRules: Array<{
    ruleId: string;
    name: string;
    action: string;
    transform?: unknown;
  }> = [];
  const transforms: Array<{ ruleId: string; result: unknown }> = [];

  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions) as Condition[];

    const matched = evaluateConditions(conditions, eventContext);
    if (matched) {
      matchedRules.push({
        ruleId: rule.id,
        name: rule.name,
        action: rule.actionType,
        transform: rule.actionTransform ? JSON.parse(rule.actionTransform) : null,
      });

      // Apply transform if present and action is deliver
      if (rule.actionType === 'deliver' && rule.actionTransform) {
        const transformConfig = JSON.parse(rule.actionTransform);
        const transformed = applyTransform(eventContext.payload, transformConfig);
        transforms.push({ ruleId: rule.id, result: transformed });
      }
    }
  }

  return c.json({
    matched: matchedRules.length > 0,
    matchedRules,
    transforms: transforms.length > 0 ? transforms : null,
  });
});

export default ruleRoutes;
