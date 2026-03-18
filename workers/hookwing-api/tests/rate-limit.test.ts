/**
 * Rate Limiting Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryRateLimiter,
  validateRateLimitConfig,
  RATE_LIMIT_CONFIGS
} from '../src/lib/rate-limit';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(RATE_LIMIT_CONFIGS.login);
  });

  describe('check', () => {
    it('should allow requests under the limit', async () => {
      const result = await limiter.check('127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
    });

    it('should track remaining requests correctly', async () => {
      // Make 2 requests
      await limiter.check('127.0.0.1');
      const result = await limiter.check('127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(3); // 5 - 2 = 3
    });

    it('should block requests over the limit', async () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter.check('192.168.1.1');
      }

      // Next request should be blocked
      const result = await limiter.check('192.168.1.1');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should track different IPs separately', async () => {
      // Use up limit for IP1
      for (let i = 0; i < 5; i++) {
        await limiter.check('192.168.1.1');
      }

      // IP2 should still have capacity
      const result = await limiter.check('192.168.1.2');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should reset after window expires', async () => {
      const testLimiter = new InMemoryRateLimiter({
        limit: 2,
        windowMs: 100, // 100ms window
        keyPrefix: 'test'
      });

      // Use up limit
      await testLimiter.check('127.0.0.1');
      await testLimiter.check('127.0.0.1');

      // Should be blocked
      const blocked = await testLimiter.check('127.0.0.1');
      expect(blocked.success).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const allowed = await testLimiter.check('127.0.0.1');
      expect(allowed.success).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset the counter for an IP', async () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('10.0.0.1');
      }

      // Should be blocked
      const blocked = await limiter.check('10.0.0.1');
      expect(blocked.success).toBe(false);

      // Reset
      limiter.reset('10.0.0.1');

      // Should be allowed again
      const allowed = await limiter.check('10.0.0.1');
      expect(allowed.success).toBe(true);
      expect(allowed.remaining).toBe(4);
    });
  });

  describe('clear', () => {
    it('should clear all counters', async () => {
      // Add some requests
      await limiter.check('10.0.0.1');
      await limiter.check('10.0.0.2');

      // Clear
      limiter.clear();

      // Both IPs should have full capacity
      const result1 = await limiter.check('10.0.0.1');
      const result2 = await limiter.check('10.0.0.2');

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });
  });
});

describe('validateRateLimitConfig', () => {
  it('should return no errors for valid config', () => {
    const errors = validateRateLimitConfig(RATE_LIMIT_CONFIGS.login);

    expect(errors).toHaveLength(0);
  });

  it('should return error for invalid limit', () => {
    const errors = validateRateLimitConfig({
      limit: 0,
      windowMs: 60000,
      keyPrefix: 'test'
    });

    expect(errors).toContain('Limit must be greater than 0');
  });

  it('should return error for invalid window', () => {
    const errors = validateRateLimitConfig({
      limit: 5,
      windowMs: 0,
      keyPrefix: 'test'
    });

    expect(errors).toContain('Window must be greater than 0');
  });

  it('should return error for empty key prefix', () => {
    const errors = validateRateLimitConfig({
      limit: 5,
      windowMs: 60000,
      keyPrefix: ''
    });

    expect(errors).toContain('Key prefix is required');
  });
});

describe('RATE_LIMIT_CONFIGS', () => {
  it('should have correct login config (5 per minute)', () => {
    expect(RATE_LIMIT_CONFIGS.login.limit).toBe(5);
    expect(RATE_LIMIT_CONFIGS.login.windowMs).toBe(60000);
  });

  it('should have correct signup config (3 per hour)', () => {
    expect(RATE_LIMIT_CONFIGS.signup.limit).toBe(3);
    expect(RATE_LIMIT_CONFIGS.signup.windowMs).toBe(3600000);
  });

  it('should have correct password reset config (10 per hour)', () => {
    expect(RATE_LIMIT_CONFIGS.passwordReset.limit).toBe(10);
    expect(RATE_LIMIT_CONFIGS.passwordReset.windowMs).toBe(3600000);
  });
});
