import { describe, expect, it } from 'vitest';
import { DEFAULT_TIERS, TierConfigSchema, getTier } from '../config/tiers';

describe('tiers', () => {
  describe('DEFAULT_TIERS', () => {
    it('should have 4 tiers', () => {
      expect(DEFAULT_TIERS).toHaveLength(4);
    });

    it('should have all required tier slugs', () => {
      const slugs = DEFAULT_TIERS.map((t) => t.slug);
      expect(slugs).toContain('paper-plane');
      expect(slugs).toContain('biplane');
      expect(slugs).toContain('warbird');
      expect(slugs).toContain('jet');
    });
  });

  describe('getTier', () => {
    it('returns correct tier by slug', () => {
      const tier = getTier('paper-plane');
      expect(tier).toBeDefined();
      expect(tier?.name).toBe('Paper Plane');
    });

    it('returns undefined for unknown slug', () => {
      const tier = getTier('unknown-tier');
      expect(tier).toBeUndefined();
    });
  });

  describe('tier limits monotonic increase', () => {
    it('max_destinations increases monotonically', () => {
      const limits = DEFAULT_TIERS.map((t) => t.limits.max_destinations);
      expect(limits[0]!).toBeLessThan(limits[1]!);
      expect(limits[1]!).toBeLessThan(limits[2]!);
      expect(limits[2]!).toBeLessThan(limits[3]!);
    });

    it('max_events_per_month increases monotonically', () => {
      const limits = DEFAULT_TIERS.map((t) => t.limits.max_events_per_month);
      expect(limits[0]!).toBeLessThan(limits[1]!);
      expect(limits[1]!).toBeLessThan(limits[2]!);
      expect(limits[2]!).toBeLessThan(limits[3]!);
    });

    it('max_payload_size_bytes increases monotonically', () => {
      const limits = DEFAULT_TIERS.map((t) => t.limits.max_payload_size_bytes);
      expect(limits[0]!).toBeLessThan(limits[1]!);
      expect(limits[1]!).toBeLessThan(limits[2]!);
      expect(limits[2]!).toBeLessThan(limits[3]!);
    });

    it('max_retry_attempts increases monotonically', () => {
      const limits = DEFAULT_TIERS.map((t) => t.limits.max_retry_attempts);
      expect(limits[0]!).toBeLessThan(limits[1]!);
      expect(limits[1]!).toBeLessThan(limits[2]!);
      expect(limits[2]!).toBeLessThan(limits[3]!);
    });

    it('retention_days increases monotonically', () => {
      const limits = DEFAULT_TIERS.map((t) => t.limits.retention_days);
      expect(limits[0]!).toBeLessThan(limits[1]!);
      expect(limits[1]!).toBeLessThan(limits[2]!);
      expect(limits[2]!).toBeLessThan(limits[3]!);
    });
  });

  describe('zod validation', () => {
    it('validates correct tier config', () => {
      const result = TierConfigSchema.safeParse(DEFAULT_TIERS[0]);
      expect(result.success).toBe(true);
    });

    it('rejects invalid tier config (missing required field)', () => {
      const invalid = {
        name: 'Test',
        slug: 'test',
        // missing limits
        features: {
          custom_headers: true,
          ip_whitelist: false,
          transformations: false,
          dead_letter_queue: false,
          priority_delivery: false,
        },
      };
      const result = TierConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid tier config (negative limit)', () => {
      const invalid = {
        name: 'Test',
        slug: 'test',
        limits: {
          max_destinations: -1,
          max_events_per_month: 1000,
          max_payload_size_bytes: 1024,
          max_retry_attempts: 3,
          retention_days: 7,
        },
        features: {
          custom_headers: true,
          ip_whitelist: false,
          transformations: false,
          dead_letter_queue: false,
          priority_delivery: false,
        },
      };
      const result = TierConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
