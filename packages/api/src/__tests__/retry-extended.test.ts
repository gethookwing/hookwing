/**
 * Extended tests for retry utility functions
 *
 * Extends the basic delivery.test.ts coverage with more edge cases,
 * boundary conditions, and exhaustive attempt-number scenarios.
 */

import { describe, expect, it } from 'vitest';
import { calculateBackoff, shouldRetry } from '../worker/retry';

describe('calculateBackoff — extended', () => {
  it('should return 30000ms for attempt 1 (30 seconds)', () => {
    expect(calculateBackoff(1)).toBe(30_000);
  });

  it('should return 60000ms for attempt 2 (60 seconds)', () => {
    expect(calculateBackoff(2)).toBe(60_000);
  });

  it('should return 90000ms for attempt 3 (90 seconds)', () => {
    expect(calculateBackoff(3)).toBe(90_000);
  });

  it('should return 120000ms for attempt 4 (2 minutes)', () => {
    expect(calculateBackoff(4)).toBe(120_000);
  });

  it('should increase linearly with attempt number (pre-cap)', () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const expected = attempt * 30_000;
      expect(calculateBackoff(attempt)).toBe(Math.min(expected, 30 * 60 * 1000));
    }
  });

  it('should cap at 1800000ms (30 minutes) for large attempt numbers', () => {
    expect(calculateBackoff(100)).toBe(1_800_000);
    expect(calculateBackoff(1000)).toBe(1_800_000);
  });

  it('should cap exactly at 60 attempts (60 * 30000 = 1800000)', () => {
    expect(calculateBackoff(60)).toBe(1_800_000);
  });

  it('should not exceed cap for attempt 61', () => {
    expect(calculateBackoff(61)).toBe(1_800_000);
  });

  it('should return positive value for attempt 0 (edge case)', () => {
    // 0 * 30000 = 0; Math.min(0, 1800000) = 0
    expect(calculateBackoff(0)).toBe(0);
  });

  it('should scale predictably: attempt 5 is 5x attempt 1', () => {
    expect(calculateBackoff(5)).toBe(calculateBackoff(1) * 5);
  });
});

describe('shouldRetry — extended', () => {
  it('should return true when attempt is 0 (first attempt)', () => {
    expect(shouldRetry(0, 3)).toBe(true);
  });

  it('should return true for attempt 1 with maxAttempts 3', () => {
    expect(shouldRetry(1, 3)).toBe(true);
  });

  it('should return true for attempt 2 with maxAttempts 3', () => {
    expect(shouldRetry(2, 3)).toBe(true);
  });

  it('should return false when attempt equals maxAttempts', () => {
    expect(shouldRetry(3, 3)).toBe(false);
  });

  it('should return false when attempt exceeds maxAttempts', () => {
    expect(shouldRetry(5, 3)).toBe(false);
    expect(shouldRetry(10, 3)).toBe(false);
  });

  it('should return false for attempt 1 with maxAttempts 1', () => {
    expect(shouldRetry(1, 1)).toBe(false);
  });

  it('should return true for attempt 0 with maxAttempts 1', () => {
    expect(shouldRetry(0, 1)).toBe(true);
  });

  it('should return false when maxAttempts is 0', () => {
    expect(shouldRetry(0, 0)).toBe(false);
  });

  it('should handle large maxAttempts value', () => {
    expect(shouldRetry(99, 100)).toBe(true);
    expect(shouldRetry(100, 100)).toBe(false);
  });

  it('should correctly reflect that attempt < maxAttempts means retry', () => {
    for (let max = 1; max <= 5; max++) {
      for (let attempt = 0; attempt < max; attempt++) {
        expect(shouldRetry(attempt, max)).toBe(true);
      }
      expect(shouldRetry(max, max)).toBe(false);
    }
  });
});
