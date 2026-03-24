import {
  events,
  endpoints,
  generateId,
  getTierBySlug,
  isFeatureEnabled,
  usageDaily,
  verifyWebhookSignature,
  workspaces,
} from '@hookwing/shared';
import { and, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { applyRateLimit } from '../middleware/rateLimit';
import { trackEventReceived } from '../services/analytics';
import { fanoutEvent } from '../services/fanout';

const ingestRoutes = new Hono<{ Bindings: { DB: D1Database; DELIVERY_QUEUE?: Queue } }>();

// ============================================================================
// POST /v1/ingest/:endpointId — Receive incoming webhooks (public endpoint)
// ============================================================================

ingestRoutes.post('/:endpointId', async (c) => {
  if (!c.env?.DB) {
    return c.json({ error: 'Service unavailable' }, 503);
  }
  const db = createDb(c.env.DB);
  const endpointId = c.req.param('endpointId');

  // 1. Look up endpoint by ID
  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  // 2. If not found or inactive, return 404
  if (!endpoint || !endpoint.isActive) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // 3. Rate limiting — look up workspace tier, enforce rate_limit_per_second
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, endpoint.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  // Get tier for payload size and rate limits
  let tierMaxPayloadBytes = 64 * 1024; // default to Paper Plane (64KB)
  if (workspace) {
    const tier = getTierBySlug(workspace.tierSlug);
    if (tier) {
      tierMaxPayloadBytes = tier.limits.max_payload_size_bytes;

      const rateLimitResult = await applyRateLimit(
        db,
        `ingest:${workspace.id}`,
        tier.limits.rate_limit_per_second,
      );
      c.header('X-RateLimit-Limit', String(rateLimitResult.limit));
      c.header('X-RateLimit-Remaining', String(rateLimitResult.remaining));
      c.header('X-RateLimit-Reset', String(rateLimitResult.resetTime));

      if (rateLimitResult.overLimit) {
        const retryAfter = Math.max(
          1,
          Math.ceil((rateLimitResult.resetTime * 1000 - Date.now()) / 1000),
        );
        c.header('Retry-After', String(retryAfter));
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    }
  }

  // 3. Read raw body as text (needed for signature verification)
  const rawBody = await c.req.text();

  // 4. Check payload size limit
  if (rawBody.length > tierMaxPayloadBytes) {
    return c.json({ error: 'Payload too large', maxBytes: tierMaxPayloadBytes }, 413);
  }

  // 5. Free tier abuse detection: check monthly quota usage
  if (workspace) {
    const tier = getTierBySlug(workspace.tierSlug);
    if (tier && tier.slug === 'paper-plane') {
      // Get current month start (YYYY-MM-01)
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // Sum events from usage_daily for this month
      const usageRecords = await db
        .select()
        .from(usageDaily)
        .where(and(eq(usageDaily.workspaceId, workspace.id), gte(usageDaily.date, monthStart)));

      const totalEventsUsed = usageRecords.reduce((sum, r) => sum + r.eventsReceived, 0);
      const monthlyLimit = tier.limits.max_events_per_month;
      const usagePercent = (totalEventsUsed / monthlyLimit) * 100;

      // Add warning header if >80% used
      if (usagePercent >= 80) {
        c.header('X-Quota-Warning', `Approaching limit: ${Math.round(usagePercent)}% used`);
      }

      // Reject if over 100%
      if (totalEventsUsed >= monthlyLimit) {
        return c.json(
          {
            error: 'Monthly event limit reached',
            limit: monthlyLimit,
            used: totalEventsUsed,
          },
          429,
        );
      }
    }
  }

  // 6. Verify webhook signature if provided (optional but recommended)
  const signatureHeader = c.req.header('X-Hookwing-Signature');
  if (signatureHeader) {
    const isValidSignature = await verifyWebhookSignature(
      rawBody,
      endpoint.secret,
      signatureHeader,
    );
    if (!isValidSignature) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  // 7. Check event_type filter if endpoint has event_types configured
  const eventTypeHeader = c.req.header('X-Event-Type');
  if (endpoint.eventTypes) {
    try {
      const allowedTypes = JSON.parse(endpoint.eventTypes) as string[];
      if (eventTypeHeader && !allowedTypes.includes(eventTypeHeader)) {
        return c.json({ error: 'Event type not allowed for this endpoint' }, 400);
      }
    } catch {
      // Invalid JSON in eventTypes, ignore filter
    }
  }

  // 8. Parse event_type from header or use fallback
  const eventType = eventTypeHeader || 'unknown';

  // 9. Generate event ID
  const eventId = generateId('evt');
  const now = Date.now();

  // Get source IP
  const sourceIp =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    c.req.header('X-Real-IP') ||
    'unknown';

  // Build relevant headers object
  const relevantHeaders: Record<string, string> = {};
  const requestHeaders = [
    'Content-Type',
    'X-Event-Type',
    'User-Agent',
    'X-Forwarded-For',
    'CF-Connecting-IP',
  ];
  for (const header of requestHeaders) {
    const value = c.req.header(header);
    if (value) {
      relevantHeaders[header] = value;
    }
  }

  // 10. Insert into events table
  await db.insert(events).values({
    id: eventId,
    workspaceId: endpoint.workspaceId,
    eventType,
    payload: rawBody,
    headers: JSON.stringify(relevantHeaders),
    sourceIp,
    receivedAt: now,
    status: 'pending',
  });

  // Calculate priority based on workspace tier (Warbird+ get priority 1)
  let priority = 0;
  if (workspace) {
    const tier = getTierBySlug(workspace.tierSlug);
    if (tier && isFeatureEnabled(tier, 'priority_delivery')) {
      priority = 1;
    }
  }

  // 11. Fan-out to all eligible endpoints
  const fanoutResult = await fanoutEvent(
    db,
    c.env.DELIVERY_QUEUE,
    { id: eventId, workspaceId: endpoint.workspaceId, eventType },
    endpointId,
    priority,
  );

  // 12. Track usage (fire-and-forget, don't fail the request)
  trackEventReceived(db, endpoint.workspaceId).catch(() => {});

  // 13. Return success response
  return c.json({
    received: true,
    eventId,
    deliveries: fanoutResult.deliveries.length,
  });
});

export default ingestRoutes;
