import { eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { MiddlewareHandler } from 'hono';
import { type Database, createDb } from '../db';

// Define rate_limits table schema inline (matches migration)
const rateLimitsTable = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
});

export { rateLimitsTable };

interface RateLimitConfig {
  /** Window size in milliseconds (default: 1000 for 1s) */
  windowMs: number;
  /** Function to get limit for this request */
  getLimit: (c: { get: (key: string) => unknown }) => number;
  /** Function to generate rate limit key */
  keyFn: (c: { get: (key: string) => unknown }) => string;
}

interface RateLimitResult {
  limit: number;
  remaining: number;
  resetTime: number;
  overLimit: boolean;
}

/**
 * Apply rate limiting for a given key and limit.
 * Uses D1-backed sliding window counter.
 *
 * @param db - Database instance
 * @param key - Rate limit key (e.g., "ingest:workspaceId")
 * @param limit - Maximum requests per window
 * @param windowMs - Window size in ms (default 1000)
 * @returns RateLimitResult with current count and limit info
 */
export async function applyRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowMs = 1000,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  // Try to get existing record
  const existing = await db
    .select()
    .from(rateLimitsTable)
    .where(eq(rateLimitsTable.key, key))
    .limit(1)
    .then((rows) => rows[0]);

  let currentCount = 0;

  if (existing) {
    // Check if we're in the same window
    if (existing.windowStart === windowStart) {
      // Same window - increment
      currentCount = existing.count + 1;

      await db
        .update(rateLimitsTable)
        .set({ count: currentCount })
        .where(eq(rateLimitsTable.key, key));
    } else {
      // New window - reset to 1
      currentCount = 1;

      await db
        .update(rateLimitsTable)
        .set({ count: currentCount, windowStart })
        .where(eq(rateLimitsTable.key, key));
    }
  } else {
    // New key - insert with count 1
    currentCount = 1;

    await db.insert(rateLimitsTable).values({
      key,
      count: currentCount,
      windowStart,
    });
  }

  const remaining = Math.max(0, limit - currentCount);
  const resetTime = Math.ceil((windowStart + windowMs) / 1000);
  const overLimit = currentCount > limit;

  return {
    limit,
    remaining,
    resetTime,
    overLimit,
  };
}

/**
 * Create a rate limiting middleware using D1-backed sliding window.
 *
 * Uses a simple fixed window counter approach:
 * - Table has key, count, window_start
 * - On each request: get current window, increment count, check vs limit
 */
export function createRateLimitMiddleware(config: RateLimitConfig): MiddlewareHandler {
  const { windowMs = 1000, getLimit, keyFn } = config;

  return async (c, next) => {
    const db = c.env?.DB;
    if (!db) {
      // No DB configured, skip rate limiting
      return await next();
    }

    const key = keyFn(c);
    const limit = getLimit(c);

    const result = await applyRateLimit(createDb(db), key, limit, windowMs);

    // Set rate limit headers
    c.res.headers.set('X-RateLimit-Limit', String(result.limit));
    c.res.headers.set('X-RateLimit-Remaining', String(result.remaining));
    c.res.headers.set('X-RateLimit-Reset', String(result.resetTime));

    if (result.overLimit) {
      const retryAfter = Math.ceil((result.resetTime * 1000 - Date.now()) / 1000);
      c.res.headers.set('Retry-After', String(Math.max(1, retryAfter)));
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    return await next();
  };
}

/**
 * Create rate limiter for ingest routes.
 * Key format: "ingest:{workspaceId}"
 * Limit is determined by workspace tier (passed via context).
 */
export function createIngestRateLimit(): MiddlewareHandler {
  return async (_c, next) => {
    // Rate limiting is handled in the route handler after endpoint lookup
    // This middleware is a placeholder for future use
    return await next();
  };
}
