import { apiKeys, feedback, generateId, verifyApiKey, workspaces } from '@hookwing/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';
import { applyRateLimit } from '../middleware/rateLimit';

const feedbackRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
  };
}>();

// Zod schema for feedback submission
const feedbackSubmitSchema = z.object({
  category: z.enum(['bug', 'feature', 'ux', 'docs', 'general']).default('general'),
  rating: z.number().int().min(1).max(5).optional(),
  message: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
  pageUrl: z.string().url().optional(),
  source: z.enum(['ui', 'api']).default('api'),
});

// Get client IP for rate limiting
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const cfIp = c.req.header('CF-Connecting-IP');
  if (cfIp) return cfIp;
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  return 'unknown';
}

// Try to authenticate and get workspace info if API key is provided
async function tryGetWorkspaceFromAuth(
  db: ReturnType<typeof createDb>,
  authHeader: string | null,
): Promise<{ workspaceId: string | null; accountTier: string | null }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { workspaceId: null, accountTier: null };
  }

  const key = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (key.length < 12) {
    return { workspaceId: null, accountTier: null };
  }

  const prefix = key.substring(0, 12);
  const keyRecord = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix))
    .limit(1)
    .then((rows) => rows[0]);

  if (!keyRecord || !keyRecord.isActive) {
    return { workspaceId: null, accountTier: null };
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < Date.now()) {
    return { workspaceId: null, accountTier: null };
  }

  const isValid = await verifyApiKey(key, keyRecord.keyHash);
  if (!isValid) {
    return { workspaceId: null, accountTier: null };
  }

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, keyRecord.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return { workspaceId: null, accountTier: null };
  }

  return { workspaceId: workspace.id, accountTier: workspace.tierSlug };
}

// ============================================================================
// POST /v1/feedback — Submit feedback (authenticated or anonymous)
// ============================================================================

feedbackRoutes.post('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }
  const db = createDb(c.env.DB);

  // Rate limit: 10 feedback submissions per minute per IP
  const clientIp = getClientIp(c);
  const rateLimitResult = await applyRateLimit(db, `feedback:${clientIp}`, 10, 60000);

  c.header('X-RateLimit-Limit', String(rateLimitResult.limit));
  c.header('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  c.header('X-RateLimit-Reset', String(rateLimitResult.resetTime));

  if (rateLimitResult.overLimit) {
    const retryAfter = Math.ceil((rateLimitResult.resetTime * 1000 - Date.now()) / 1000);
    c.header('Retry-After', String(Math.max(1, retryAfter)));
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429);
  }

  // Parse and validate body
  const body = await c.req.json();
  const parsed = feedbackSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { category, rating, message, metadata, context, pageUrl, source } = parsed.data;

  // Try to authenticate if API key is provided
  const authHeader = c.req.header('Authorization') ?? null;
  const { workspaceId, accountTier } = await tryGetWorkspaceFromAuth(db, authHeader);

  // Get user agent from headers
  const userAgent = c.req.header('User-Agent') || undefined;

  // Insert feedback
  const feedbackId = generateId('fb');
  const now = Date.now();

  await db.insert(feedback).values({
    id: feedbackId,
    workspaceId,
    source,
    category,
    rating: rating ?? null,
    message: message ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    context: context ? JSON.stringify(context) : null,
    pageUrl: pageUrl ?? null,
    userAgent: userAgent ?? null,
    accountTier: accountTier ?? null,
    createdAt: now,
    resolvedAt: null,
  });

  return c.json(
    {
      id: feedbackId,
      category,
      rating,
      message,
      createdAt: now,
    },
    201,
  );
});

// All routes below require authentication
feedbackRoutes.use('/*', authMiddleware);

// ============================================================================
// GET /v1/feedback — List feedback for workspace (paginated, filtered)
// ============================================================================

feedbackRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const limit = Math.min(Number.parseInt(c.req.query('limit') || '50', 10), 100);
  const cursor = c.req.query('cursor');
  const categoryFilter = c.req.query('category');
  const sourceFilter = c.req.query('source');

  // Build conditions
  const conditions = [eq(feedback.workspaceId, workspace.id)];

  if (cursor) {
    conditions.push(gt(feedback.id, cursor));
  }

  if (categoryFilter) {
    conditions.push(eq(feedback.category, categoryFilter));
  }

  if (sourceFilter) {
    conditions.push(eq(feedback.source, sourceFilter));
  }

  // Fetch limit+1 to determine hasMore
  const feedbackList = await db
    .select()
    .from(feedback)
    .where(and(...conditions))
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(limit + 1);

  const hasMore = feedbackList.length > limit;
  const results = hasMore ? feedbackList.slice(0, limit) : feedbackList;
  const lastFeedback = results[results.length - 1];

  return c.json({
    feedback: results.map((f) => ({
      id: f.id,
      source: f.source,
      category: f.category,
      rating: f.rating,
      message: f.message,
      metadata: f.metadata ? JSON.parse(f.metadata) : null,
      context: f.context ? JSON.parse(f.context) : null,
      pageUrl: f.pageUrl,
      userAgent: f.userAgent,
      accountTier: f.accountTier,
      createdAt: f.createdAt,
      resolvedAt: f.resolvedAt,
    })),
    pagination: {
      limit,
      cursor: hasMore && lastFeedback ? lastFeedback.id : null,
      hasMore,
    },
  });
});

// ============================================================================
// PATCH /v1/feedback/:id — Mark feedback as resolved
// ============================================================================

feedbackRoutes.patch('/:id', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const feedbackId = c.req.param('id');

  // Verify feedback belongs to workspace
  const existingFeedback = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.id, feedbackId), eq(feedback.workspaceId, workspace.id)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingFeedback) {
    return c.json({ error: 'Feedback not found' }, 404);
  }

  if (existingFeedback.resolvedAt) {
    return c.json({ error: 'Feedback already resolved' }, 400);
  }

  // Mark as resolved
  const resolvedAt = Date.now();
  await db.update(feedback).set({ resolvedAt }).where(eq(feedback.id, feedbackId));

  return c.json({
    id: feedbackId,
    resolvedAt,
  });
});

export default feedbackRoutes;
