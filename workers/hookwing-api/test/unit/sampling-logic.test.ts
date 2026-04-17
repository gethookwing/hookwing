import { describe, it, expect } from 'vitest';
import { shouldSample, describeSampling } from '../../src/otel/sampling';

describe('shouldSample', () => {
  describe('errors always sampled', () => {
    it('samples an error trace regardless of rate 0', () => {
      expect(shouldSample({ isError: true, sampleRate: 0, randomValue: 0.99 })).toBe(true);
    });

    it('samples an error trace at rate 0 with random 0', () => {
      expect(shouldSample({ isError: true, sampleRate: 0, randomValue: 0 })).toBe(true);
    });

    it('samples an error trace at rate 0.1', () => {
      expect(shouldSample({ isError: true, sampleRate: 0.1, randomValue: 0.5 })).toBe(true);
    });
  });

  describe('success traces use sampleRate', () => {
    it('samples when randomValue < sampleRate', () => {
      expect(shouldSample({ isError: false, sampleRate: 0.1, randomValue: 0.05 })).toBe(true);
    });

    it('does not sample when randomValue >= sampleRate', () => {
      expect(shouldSample({ isError: false, sampleRate: 0.1, randomValue: 0.1 })).toBe(false);
    });

    it('does not sample when randomValue > sampleRate', () => {
      expect(shouldSample({ isError: false, sampleRate: 0.1, randomValue: 0.99 })).toBe(false);
    });

    it('always samples at rate 1.0', () => {
      expect(shouldSample({ isError: false, sampleRate: 1.0, randomValue: 0.9999 })).toBe(true);
    });

    it('never samples at rate 0 (success)', () => {
      expect(shouldSample({ isError: false, sampleRate: 0, randomValue: 0 })).toBe(false);
    });

    it('samples at exactly the boundary (exclusive upper)', () => {
      // randomValue=0.1 with rate=0.1: 0.1 < 0.1 is false → not sampled
      expect(shouldSample({ isError: false, sampleRate: 0.1, randomValue: 0.1 })).toBe(false);
    });

    it('samples just below boundary', () => {
      expect(shouldSample({ isError: false, sampleRate: 0.1, randomValue: 0.0999 })).toBe(true);
    });
  });

  describe('uses Math.random() when randomValue not provided', () => {
    it('returns a boolean', () => {
      const result = shouldSample({ isError: false, sampleRate: 0.5 });
      expect(typeof result).toBe('boolean');
    });

    it('always returns true for errors without randomValue', () => {
      expect(shouldSample({ isError: true, sampleRate: 0.1 })).toBe(true);
    });
  });
});

describe('describeSampling', () => {
  it('formats 10% correctly', () => {
    expect(describeSampling(0.1)).toBe('errors=100% successes=10%');
  });

  it('formats 100% correctly', () => {
    expect(describeSampling(1.0)).toBe('errors=100% successes=100%');
  });

  it('formats 0% correctly', () => {
    expect(describeSampling(0)).toBe('errors=100% successes=0%');
  });

  it('formats 50% correctly', () => {
    expect(describeSampling(0.5)).toBe('errors=100% successes=50%');
  });
});
