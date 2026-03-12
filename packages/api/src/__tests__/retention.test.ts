import { describe, expect, it } from 'vitest';
import { cleanupExpiredEvents } from '../worker/retention';

describe('cleanupExpiredEvents', () => {
  it('should be exported as a function', () => {
    expect(typeof cleanupExpiredEvents).toBe('function');
  });

  it('should require DB parameter', () => {
    // Calling without a valid DB should throw
    expect(cleanupExpiredEvents({ DB: undefined as unknown as D1Database })).rejects.toThrow();
  });
});
