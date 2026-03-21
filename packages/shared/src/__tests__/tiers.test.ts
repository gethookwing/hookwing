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
    expect(slugs).toContain('paper-plane');
    expect(slugs).toContain('warbird');
    expect(slugs).toContain('stealth-jet');
  });

  it('should NOT contain removed tiers', () => {
    const slugs = DEFAULT_TIERS.map((t) => t.slug);
    expect(slugs).not.toContain('free');
    expect(slugs).not.toContain('pro');
    expect(slugs).not.toContain('enterprise');
    expect(slugs).not.toContain('biplane');
    expect(slugs).not.toContain('biplane');
    expect(slugs).not.toContain('jet');
  });

  it('should have Paper Plane at $0/mo', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier?.price_monthly_usd).toBe(0);
  });

  it('should have Warbird at $19/mo', () => {
    const tier = getTierBySlug('warbird');
    expect(tier?.price_monthly_usd).toBe(19);
  });

  it('should have Fighter Jet at $89/mo', () => {
    const tier = getTierBySlug('stealth-jet');
    expect(tier?.price_monthly_usd).toBe(89);
  });

  it('should have Paper Plane with 25K events/mo', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier?.limits.max_events_per_month).toBe(25_000);
  });

  it('should have Warbird with 100K events/mo', () => {
    const tier = getTierBySlug('warbird');
    expect(tier?.limits.max_events_per_month).toBe(100_000);
  });

  it('should have Paper Plane with 7-day retention', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier?.limits.retention_days).toBe(7);
  });

  it('should have Warbird with 30-day retention', () => {
    const tier = getTierBySlug('warbird');
    expect(tier?.limits.retention_days).toBe(30);
  });

  it('should have Fighter Jet with 90-day retention', () => {
    const tier = getTierBySlug('stealth-jet');
    expect(tier?.limits.retention_days).toBe(90);
  });

  it('should have correct endpoint limits per tier', () => {
    const expected: Record<string, number> = { 'paper-plane': 3, 'warbird': 10, 'stealth-jet': 999 };
    for (const tier of DEFAULT_TIERS) {
      expect(tier.limits.max_destinations).toBe(expected[tier.slug]);
    }
  });

  it('should pass zod validation for all tiers', () => {
    for (const tier of DEFAULT_TIERS) {
      expect(() => TierConfigSchema.parse(tier)).not.toThrow();
    }
  });
});

describe('getTierBySlug', () => {
  it('should return Paper Plane tier by slug', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Paper Plane');
  });

  it('should return Warbird tier by slug', () => {
    const tier = getTierBySlug('warbird');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Warbird');
  });

  it('should return Fighter Jet tier by slug', () => {
    const tier = getTierBySlug('stealth-jet');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Stealth Jet');
  });

  it('should return undefined for removed tiers', () => {
    expect(getTierBySlug('free')).toBeUndefined();
    expect(getTierBySlug('pro')).toBeUndefined();
    expect(getTierBySlug('enterprise')).toBeUndefined();
    expect(getTierBySlug('biplane')).toBeUndefined();
    expect(getTierBySlug('biplane')).toBeUndefined();
    expect(getTierBySlug('jet')).toBeUndefined();
  });

  it('should return undefined for unknown slug', () => {
    expect(getTierBySlug('unknown-tier')).toBeUndefined();
    expect(getTierBySlug('')).toBeUndefined();
  });
});

describe('isFeatureEnabled', () => {
  it('should return true for core features on Paper Plane', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isFeatureEnabled(tier, 'transformations')).toBe(true);
    expect(isFeatureEnabled(tier, 'webhook_signing')).toBe(true);
    expect(isFeatureEnabled(tier, 'analytics')).toBe(true);
  });

  it('should return false for premium features on Paper Plane', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isFeatureEnabled(tier, 'custom_headers')).toBe(false);
    expect(isFeatureEnabled(tier, 'ip_whitelist')).toBe(false);
    expect(isFeatureEnabled(tier, 'dead_letter_queue')).toBe(false);
  });

  it('should return true for all features on Fighter Jet', () => {
    const tier = getTierBySlug('stealth-jet')!;
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
    const tier = getTierBySlug('paper-plane')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 25_000)).toBe(true);
    expect(isWithinLimit(tier, 'max_events_per_month', 1)).toBe(true);
  });

  it('should return false when exceeding limits', () => {
    const tier = getTierBySlug('paper-plane')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 25_001)).toBe(false);
  });

  it('should return true for high limits on Fighter Jet', () => {
    const tier = getTierBySlug('stealth-jet')!;
    expect(isWithinLimit(tier, 'max_events_per_month', 1_000_000)).toBe(true);
  });
});

describe('getUpgradePath', () => {
  it('should return 2 upgrade options for Paper Plane', () => {
    const upgrades = getUpgradePath('paper-plane');
    expect(upgrades).toHaveLength(2);
    expect(upgrades[0]?.slug).toBe('warbird');
    expect(upgrades[1]?.slug).toBe('stealth-jet');
  });

  it('should return 1 upgrade for Warbird (Fighter Jet)', () => {
    const upgrades = getUpgradePath('warbird');
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]?.slug).toBe('stealth-jet');
  });

  it('should return empty for Fighter Jet', () => {
    expect(getUpgradePath('stealth-jet')).toHaveLength(0);
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
    const tier = getTierBySlug('paper-plane')!;
    expect(() => TierConfigSchema.parse({ ...tier, price_monthly_usd: -1 })).toThrow();
  });
});
