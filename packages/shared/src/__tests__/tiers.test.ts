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
  it('should have exactly 3 tiers', () => {
    expect(DEFAULT_TIERS).toHaveLength(3);
  });

  it('should contain all required tier slugs', () => {
    const slugs = DEFAULT_TIERS.map((t) => t.slug);
    expect(slugs).toContain('free');
    expect(slugs).toContain('pro');
    expect(slugs).toContain('enterprise');
  });

  it('should NOT contain removed tiers', () => {
    const slugs = DEFAULT_TIERS.map((t) => t.slug);
    expect(slugs).not.toContain('paper-plane');
    expect(slugs).not.toContain('warbird');
    expect(slugs).not.toContain('stealth-jet');
    expect(slugs).not.toContain('biplane');
    expect(slugs).not.toContain('jet');
  });

  it('should have free at $0/mo', () => {
    const tier = getTierBySlug('free');
    expect(tier?.price_monthly_usd).toBe(0);
  });

  it('should have pro at $19/mo', () => {
    const tier = getTierBySlug('pro');
    expect(tier?.price_monthly_usd).toBe(19);
  });

  it('should have enterprise at $0/mo (custom pricing)', () => {
    const tier = getTierBySlug('enterprise');
    expect(tier?.price_monthly_usd).toBe(0);
  });

  it('should have free with 25K events/mo', () => {
    const tier = getTierBySlug('free');
    expect(tier?.limits.max_events_per_month).toBe(25_000);
  });

  it('should have pro with 100K events/mo', () => {
    const tier = getTierBySlug('pro');
    expect(tier?.limits.max_events_per_month).toBe(100_000);
  });

  it('should have free with 7-day retention', () => {
    const tier = getTierBySlug('free');
    expect(tier?.limits.retention_days).toBe(7);
  });

  it('should have pro with 30-day retention', () => {
    const tier = getTierBySlug('pro');
    expect(tier?.limits.retention_days).toBe(30);
  });

  it('should have enterprise with 90-day retention', () => {
    const tier = getTierBySlug('enterprise');
    expect(tier?.limits.retention_days).toBe(90);
  });

  it('should have unlimited endpoints on all tiers', () => {
    for (const tier of DEFAULT_TIERS) {
      expect(tier.limits.max_destinations).toBe(999);
    }
  });

  it('should pass zod validation for all tiers', () => {
    for (const tier of DEFAULT_TIERS) {
      expect(() => TierConfigSchema.parse(tier)).not.toThrow();
    }
  });
});

describe('getTierBySlug', () => {
  it('should return free tier by slug', () => {
    const tier = getTierBySlug('free');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Free');
  });

  it('should return pro tier by slug', () => {
    const tier = getTierBySlug('pro');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Pro');
  });

  it('should return enterprise tier by slug', () => {
    const tier = getTierBySlug('enterprise');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Enterprise');
  });

  it('should return undefined for removed tiers', () => {
    expect(getTierBySlug('paper-plane')).toBeUndefined();
    expect(getTierBySlug('warbird')).toBeUndefined();
    expect(getTierBySlug('stealth-jet')).toBeUndefined();
    expect(getTierBySlug('biplane')).toBeUndefined();
    expect(getTierBySlug('jet')).toBeUndefined();
  });

  it('should return undefined for unknown slug', () => {
    expect(getTierBySlug('unknown-tier')).toBeUndefined();
    expect(getTierBySlug('')).toBeUndefined();
  });
});

describe('isFeatureEnabled', () => {
  it('should return true for core features on free', () => {
    const tier = getTierBySlug('free')!;
    expect(isFeatureEnabled(tier, 'transformations')).toBe(true);
    expect(isFeatureEnabled(tier, 'webhook_signing')).toBe(true);
    expect(isFeatureEnabled(tier, 'analytics')).toBe(true);
  });

  it('should return false for premium features on free', () => {
    const tier = getTierBySlug('free')!;
    expect(isFeatureEnabled(tier, 'custom_headers')).toBe(false);
    expect(isFeatureEnabled(tier, 'ip_whitelist')).toBe(false);
    expect(isFeatureEnabled(tier, 'dead_letter_queue')).toBe(false);
  });

  it('should return true for all features on enterprise', () => {
    const tier = getTierBySlug('enterprise')!;
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
  it('should return true when within limits', () => {
    const tier = getTierBySlug('free')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 25_000)).toBe(true);
    expect(isWithinLimit(tier, 'max_events_per_month', 1)).toBe(true);
  });

  it('should return false when exceeding limits', () => {
    const tier = getTierBySlug('free')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 25_001)).toBe(false);
  });

  it('should return true for high limits on enterprise', () => {
    const tier = getTierBySlug('enterprise')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 1_000_000)).toBe(true);
  });
});

describe('getUpgradePath', () => {
  it('should return 2 upgrade options for free', () => {
    const upgrades = getUpgradePath('free');
    expect(upgrades).toHaveLength(2);
    expect(upgrades[0]?.slug).toBe('pro');
    expect(upgrades[1]?.slug).toBe('enterprise');
  });

  it('should return 1 upgrade for pro (enterprise)', () => {
    const upgrades = getUpgradePath('pro');
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]?.slug).toBe('enterprise');
  });

  it('should return empty for enterprise', () => {
    expect(getUpgradePath('enterprise')).toHaveLength(0);
  });

  it('should return empty array for unknown slug', () => {
    expect(getUpgradePath('unknown')).toHaveLength(0);
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
        max_retry_attempts: 6,
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
    const tier = getTierBySlug('free')!;
    expect(() => TierConfigSchema.parse({ ...tier, price_monthly_usd: -1 })).toThrow();
  });
});
