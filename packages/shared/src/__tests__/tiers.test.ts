import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIERS,
  TierConfigSchema,
  getTierBySlug,
  getUpgradePath,
  isFeatureEnabled,
  isWithinLimit,
} from '../config/tiers';

describe('DEFAULT_TIERS', () => {
  it('should have exactly 4 tiers', () => {
    expect(DEFAULT_TIERS).toHaveLength(4);
  });

  it('should contain all required tier slugs', () => {
    const slugs = DEFAULT_TIERS.map((t) => t.slug);
    expect(slugs).toContain('paper-plane');
    expect(slugs).toContain('biplane');
    expect(slugs).toContain('warbird');
    expect(slugs).toContain('jet');
  });

  it('should have price_monthly_usd = 0 for paper-plane (free tier)', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier?.price_monthly_usd).toBe(0);
  });

  it('should have increasing prices across tiers', () => {
    const prices = DEFAULT_TIERS.map((t) => t.price_monthly_usd);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
    }
  });

  it('should pass zod validation for all tiers', () => {
    for (const tier of DEFAULT_TIERS) {
      expect(() => TierConfigSchema.parse(tier)).not.toThrow();
    }
  });
});

describe('getTierBySlug', () => {
  it('should return paper-plane tier by slug', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Paper Plane');
  });

  it('should return jet tier by slug', () => {
    const tier = getTierBySlug('jet');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Jet');
  });

  it('should return undefined for unknown slug', () => {
    expect(getTierBySlug('unknown-tier')).toBeUndefined();
    expect(getTierBySlug('')).toBeUndefined();
    expect(getTierBySlug('PAPER-PLANE')).toBeUndefined();
  });
});

describe('isFeatureEnabled', () => {
  it('should return false for premium features on paper-plane', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isFeatureEnabled(tier, 'custom_headers')).toBe(false);
    expect(isFeatureEnabled(tier, 'ip_whitelist')).toBe(false);
    expect(isFeatureEnabled(tier, 'dead_letter_queue')).toBe(false);
    expect(isFeatureEnabled(tier, 'analytics')).toBe(false);
  });

  it('should return true for custom_headers on biplane', () => {
    const tier = getTierBySlug('biplane')!;
    expect(isFeatureEnabled(tier, 'custom_headers')).toBe(true);
    expect(isFeatureEnabled(tier, 'webhook_signing')).toBe(true);
  });

  it('should return true for all features on jet', () => {
    const tier = getTierBySlug('jet')!;
    expect(isFeatureEnabled(tier, 'custom_headers')).toBe(true);
    expect(isFeatureEnabled(tier, 'ip_whitelist')).toBe(true);
    expect(isFeatureEnabled(tier, 'transformations')).toBe(true);
    expect(isFeatureEnabled(tier, 'dead_letter_queue')).toBe(true);
    expect(isFeatureEnabled(tier, 'priority_delivery')).toBe(true);
    expect(isFeatureEnabled(tier, 'webhook_signing')).toBe(true);
    expect(isFeatureEnabled(tier, 'analytics')).toBe(true);
  });
});

describe('isWithinLimit', () => {
  it('should return true when within max_destinations limit', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isWithinLimit(tier, 'max_destinations', 1)).toBe(true);
    expect(isWithinLimit(tier, 'max_destinations', tier.limits.max_destinations)).toBe(true);
  });

  it('should return false when exceeding max_destinations limit', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isWithinLimit(tier, 'max_destinations', tier.limits.max_destinations + 1)).toBe(false);
  });

  it('should return true for any limit on jet tier (high limits)', () => {
    const tier = getTierBySlug('jet')!;
    expect(isWithinLimit(tier, 'max_destinations', 100)).toBe(true);
    expect(isWithinLimit(tier, 'max_events_per_month', 1_000_000)).toBe(true);
  });

  it('should return false for retention_days exceeding tier limit', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isWithinLimit(tier, 'retention_days', tier.limits.retention_days + 1)).toBe(false);
  });
});

describe('getUpgradePath', () => {
  it('should return 3 upgrade options for paper-plane', () => {
    const upgrades = getUpgradePath('paper-plane');
    expect(upgrades).toHaveLength(3);
    const slugs = upgrades.map((t) => t.slug);
    expect(slugs).toContain('biplane');
    expect(slugs).toContain('warbird');
    expect(slugs).toContain('jet');
  });

  it('should return tiers in ascending price order', () => {
    const upgrades = getUpgradePath('paper-plane');
    for (let i = 1; i < upgrades.length; i++) {
      expect(upgrades[i]!.price_monthly_usd).toBeGreaterThan(upgrades[i - 1]!.price_monthly_usd);
    }
  });

  it('should return empty array for jet (no upgrades)', () => {
    expect(getUpgradePath('jet')).toHaveLength(0);
  });

  it('should return 1 upgrade for warbird (only jet above it)', () => {
    const upgrades = getUpgradePath('warbird');
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]?.slug).toBe('jet');
  });

  it('should return empty array for unknown slug', () => {
    expect(getUpgradePath('unknown')).toHaveLength(0);
  });
});

describe('tier limits monotonic increase', () => {
  it('should have max_destinations increasing across all tiers', () => {
    const values = DEFAULT_TIERS.map((t) => t.limits.max_destinations);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('should have max_events_per_month increasing across all tiers', () => {
    const values = DEFAULT_TIERS.map((t) => t.limits.max_events_per_month);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('should have retention_days increasing across all tiers', () => {
    const values = DEFAULT_TIERS.map((t) => t.limits.retention_days);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe('TierConfigSchema validation', () => {
  it('should reject config with missing required fields', () => {
    expect(() => TierConfigSchema.parse({ slug: 'test' })).toThrow();
  });

  it('should reject negative max_destinations', () => {
    const invalid = {
      slug: 'test',
      name: 'Test',
      price_monthly_usd: 0,
      limits: {
        max_destinations: -1,
        max_events_per_month: 1000,
        max_payload_size_bytes: 65536,
        max_retry_attempts: 3,
        retention_days: 7,
        rate_limit_per_second: 10,
      },
      features: {
        custom_headers: false,
        ip_whitelist: false,
        transformations: false,
        dead_letter_queue: false,
        priority_delivery: false,
        webhook_signing: false,
        analytics: false,
        team_members: 1,
      },
    };
    expect(() => TierConfigSchema.parse(invalid)).toThrow();
  });

  it('should reject negative price', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(() => TierConfigSchema.parse({ ...tier, price_monthly_usd: -1 })).toThrow();
  });
});
