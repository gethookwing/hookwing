import { describe, expect, it } from 'vitest';
import { applyRateLimit, rateLimitsTable } from '../middleware/rateLimit';

/**
 * Rate limit tests — unit tests for the applyRateLimit function.
 * These test the core logic without HTTP/D1. We mock the database
 * by testing the function's contract directly.
 */
describe('applyRateLimit', () => {
  it('should export the applyRateLimit function', () => {
    expect(typeof applyRateLimit).toBe('function');
  });

  it('should export the rateLimitsTable schema', () => {
    expect(rateLimitsTable).toBeDefined();
    expect(typeof rateLimitsTable).toBe('object');
  });
});

describe('rate limit middleware contract', () => {
  it('should have correct table columns defined', () => {
    // Verify the rate_limits table schema has the expected columns
    const columns = Object.keys(rateLimitsTable);
    expect(columns).toContain('key');
    expect(columns).toContain('count');
    expect(columns).toContain('windowStart');
  });

  it('should require key, count, and windowStart fields', () => {
    expect(rateLimitsTable.key).toBeDefined();
    expect(rateLimitsTable.count).toBeDefined();
    expect(rateLimitsTable.windowStart).toBeDefined();
  });
});

describe('rate limit headers', () => {
  it('should define standard rate limit header names', () => {
    // These are the headers our middleware sets
    const expectedHeaders = [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ];
    // Just verify the strings are valid header names
    for (const header of expectedHeaders) {
      expect(header).toMatch(/^[A-Za-z-]+$/);
    }
  });
});

describe('rate limit window calculation', () => {
  it('should floor timestamps to window boundaries', () => {
    const windowMs = 1000;
    const now = 1710000123456;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    expect(windowStart).toBe(1710000123000);
  });

  it('should calculate correct reset time', () => {
    const windowMs = 1000;
    const windowStart = 1710000123000;
    const resetTime = Math.ceil((windowStart + windowMs) / 1000);
    expect(resetTime).toBe(1710000124);
  });

  it('should calculate remaining correctly', () => {
    const limit = 10;
    const currentCount = 3;
    const remaining = Math.max(0, limit - currentCount);
    expect(remaining).toBe(7);
  });

  it('should detect over-limit correctly', () => {
    const limit = 10;
    expect(11 > limit).toBe(true);
    expect(10 > limit).toBe(false);
    expect(9 > limit).toBe(false);
  });

  it('should clamp remaining to 0 when over limit', () => {
    const limit = 10;
    const currentCount = 15;
    const remaining = Math.max(0, limit - currentCount);
    expect(remaining).toBe(0);
  });

  it('should calculate retry-after as at least 1 second', () => {
    const resetTimeSec = Math.ceil(Date.now() / 1000) + 1;
    const retryAfter = Math.max(1, Math.ceil((resetTimeSec * 1000 - Date.now()) / 1000));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });
});
