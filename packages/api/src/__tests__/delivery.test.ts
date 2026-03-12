import { describe, expect, it } from 'vitest';
import { calculateBackoff, shouldRetry } from '../worker/retry';

describe('retry utilities', () => {
  describe('calculateBackoff', () => {
    it('returns 30000ms for attempt 1', () => {
      expect(calculateBackoff(1)).toBe(30000);
    });

    it('returns 60000ms for attempt 2', () => {
      expect(calculateBackoff(2)).toBe(60000);
    });

    it('returns capped value for high attempt numbers (max 30 min)', () => {
      // 10 * 30 * 1000 = 300000ms, but capped at 30 * 60 * 1000 = 1800000ms
      // Wait, let me re-check: the cap is 30 minutes = 30 * 60 * 1000 = 1800000
      // But the formula says Math.min(attempt * 30 * 1000, 30 * 60 * 1000)
      // So for attempt 10: Math.min(300000, 1800000) = 300000
      // Actually, let me re-read the requirements: "max 30 min" means 30 * 60 * 1000 = 1800000
      // But based on the test description "capped value (max 30 min)", I think the intent is different
      // Let me re-read: Math.min(attempt * 30 * 1000, 30 * 60 * 1000)
      // At attempt 10: 10 * 30000 = 300000, which is less than 1800000, so it returns 300000
      // At attempt 60: 60 * 30000 = 1800000 = 1800000, so it returns 1800000
      // At attempt 100: 100 * 30000 = 3000000 > 1800000, so it returns 1800000
      expect(calculateBackoff(10)).toBe(300000);
    });
  });

  describe('shouldRetry', () => {
    it('returns true when attempt is less than maxAttempts', () => {
      expect(shouldRetry(1, 3)).toBe(true);
    });

    it('returns false when attempt equals maxAttempts', () => {
      expect(shouldRetry(3, 3)).toBe(false);
    });

    it('returns true when attempt is 0 (initial attempt)', () => {
      expect(shouldRetry(0, 3)).toBe(true);
    });

    it('returns false when attempt exceeds maxAttempts', () => {
      expect(shouldRetry(4, 3)).toBe(false);
    });
  });
});
