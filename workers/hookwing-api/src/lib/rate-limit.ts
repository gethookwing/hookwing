/**
 * Rate Limiting Middleware
 *
 * Uses KV store for distributed rate limiting.
 * Implements sliding window counter algorithm.
 */

import { Context, Next } from 'hono';

export interface RateLimitConfig {
  limit: number;      // Max requests allowed
  windowMs: number;   // Time window in milliseconds
  keyPrefix: string;  // Prefix for KV keys
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Default configs for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // 5 login attempts per minute per IP
  login: { limit: 5, windowMs: 60 * 1000, keyPrefix: 'rl:login' },
  // 3 signups per hour per IP
  signup: { limit: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'rl:signup' },
  // 10 password reset attempts per hour per IP
  passwordReset: { limit: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'rl:reset' },
} as const;

/**
 * Get client IP from request
 */
export function getClientIP(c: Context): string {
  // Check CF-Connecting-IP header first (Cloudflare)
  const cfIP = c.req.header('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Check X-Forwarded-For header
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Fallback to connection remote address
  return c.req.header('True-Client-IP') || 'unknown';
}

/**
 * Rate limiter factory function
 * Creates middleware for specific rate limit config
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIP(c);
    const key = `${config.keyPrefix}:${ip}`;

    // Get current count from KV
    const kv = c.env.RATE_LIMIT;
    let currentCount = 0;
    let windowStart = Date.now();

    if (kv) {
      try {
        const stored = await kv.get(key);
        if (stored) {
          const data = JSON.parse(stored);
          // Check if we're in a new window
          if (Date.now() - data.windowStart >= config.windowMs) {
            // New window, reset
            currentCount = 0;
            windowStart = Date.now();
          } else {
            currentCount = data.count;
            windowStart = data.windowStart;
          }
        }
      } catch (e) {
        console.error('Rate limit KV error:', e);
      }
    }

    const now = Date.now();
    const windowEnd = windowStart + config.windowMs;
    const remaining = Math.max(0, config.limit - currentCount - 1);
    const retryAfter = Math.ceil((windowEnd - now) / 1000);

    // Check if rate limited
    if (currentCount >= config.limit) {
      return new Response(JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(windowEnd / 1000)),
          'Retry-After': String(retryAfter)
        }
      });
    }

    // Increment counter
    const newCount = currentCount + 1;

    if (kv) {
      try {
        await kv.put(key, JSON.stringify({
          count: newCount,
          windowStart
        }), { expirationTtl: Math.ceil(config.windowMs / 1000) });
      } catch (e) {
        console.error('Rate limit KV write error:', e);
      }
    }

    // Add rate limit headers to response
    c.set('rateLimit', {
      limit: config.limit,
      remaining,
      reset: Math.ceil(windowEnd / 1000)
    });

    await next();
  };
}

/**
 * Simple in-memory rate limiter for testing or when KV unavailable
 * Note: Not recommended for production in distributed environments
 */
export class InMemoryRateLimiter {
  private counters: Map<string, { count: number; windowStart: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();

    let record = this.counters.get(key);

    // Check if we're in a new window
    if (!record || (now - record.windowStart >= this.config.windowMs)) {
      record = { count: 0, windowStart: now };
    }

    const windowEnd = record.windowStart + this.config.windowMs;
    const remaining = Math.max(0, this.config.limit - record.count - 1);
    const retryAfter = Math.ceil((windowEnd - now) / 1000);

    if (record.count >= this.config.limit) {
      return {
        success: false,
        remaining: 0,
        resetTime: windowEnd,
        retryAfter
      };
    }

    // Increment
    record.count++;
    this.counters.set(key, record);

    return {
      success: true,
      remaining,
      resetTime: windowEnd
    };
  }

  reset(identifier: string): void {
    const key = `${this.config.keyPrefix}:${identifier}`;
    this.counters.delete(key);
  }

  // For testing
  clear(): void {
    this.counters.clear();
  }
}

/**
 * Validate rate limit configuration
 */
export function validateRateLimitConfig(config: RateLimitConfig): string[] {
  const errors: string[] = [];

  if (config.limit <= 0) {
    errors.push('Limit must be greater than 0');
  }

  if (config.windowMs <= 0) {
    errors.push('Window must be greater than 0');
  }

  if (!config.keyPrefix || config.keyPrefix.length === 0) {
    errors.push('Key prefix is required');
  }

  return errors;
}
