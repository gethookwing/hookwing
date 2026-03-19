import { z } from 'zod';

const TierLimitsSchema = z.object({
  max_destinations: z.number().int().min(1),
  max_events_per_month: z.number().int().min(1),
  max_payload_size_bytes: z.number().int().min(1),
  max_retry_attempts: z.number().int().min(0),
  retention_days: z.number().int().min(1),
  rate_limit_per_second: z.number().int().min(1),
});

const TierFeaturesSchema = z.object({
  custom_headers: z.boolean(),
  custom_domains: z.boolean(),
  ip_whitelist: z.boolean(),
  transformations: z.boolean(),
  dead_letter_queue: z.boolean(),
  priority_delivery: z.boolean(),
  webhook_signing: z.boolean(),
  analytics: z.boolean(),
  team_members: z.number().int().min(1),
});

export const TierConfigSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  price_monthly_usd: z.number().min(0),
  limits: TierLimitsSchema,
  features: TierFeaturesSchema,
});

export type TierConfig = z.infer<typeof TierConfigSchema>;
export type TierLimits = z.infer<typeof TierLimitsSchema>;
export type TierFeatures = z.infer<typeof TierFeaturesSchema>;

export const DEFAULT_TIERS: TierConfig[] = [
  {
    slug: 'paper-plane',
    name: 'Paper Plane',
    price_monthly_usd: 0,
    limits: {
      max_destinations: 999, // unlimited endpoints
      max_events_per_month: 25_000,
      max_payload_size_bytes: 64 * 1024, // 64KB
      max_retry_attempts: 6,
      retention_days: 7,
      rate_limit_per_second: 10,
    },
    features: {
      custom_headers: false,
      custom_domains: false,
      ip_whitelist: false,
      transformations: true,
      dead_letter_queue: false,
      priority_delivery: false,
      webhook_signing: true,
      analytics: true,
      team_members: 3,
    },
  },
  {
    slug: 'warbird',
    name: 'Warbird',
    price_monthly_usd: 19,
    limits: {
      max_destinations: 999, // unlimited endpoints
      max_events_per_month: 100_000,
      max_payload_size_bytes: 256 * 1024, // 256KB
      max_retry_attempts: 6,
      retention_days: 30,
      rate_limit_per_second: 25,
    },
    features: {
      custom_headers: true,
      custom_domains: false,
      ip_whitelist: false,
      transformations: true,
      dead_letter_queue: true,
      priority_delivery: true,
      webhook_signing: true,
      analytics: true,
      team_members: 999, // unlimited
    },
  },
  {
    slug: 'stealth-jet',
    name: 'Stealth Jet',
    price_monthly_usd: 89,
    limits: {
      max_destinations: 999,
      max_events_per_month: 1_000_000,
      max_payload_size_bytes: 1024 * 1024, // 1MB
      max_retry_attempts: 10,
      retention_days: 90,
      rate_limit_per_second: 200,
    },
    features: {
      custom_headers: true,
      custom_domains: true,
      ip_whitelist: true,
      transformations: true,
      dead_letter_queue: true,
      priority_delivery: true,
      webhook_signing: true,
      analytics: true,
      team_members: 999,
    },
  },
];

const tiersMap = new Map<string, TierConfig>(DEFAULT_TIERS.map((tier) => [tier.slug, tier]));

export function getTierBySlug(slug: string): TierConfig | undefined {
  return tiersMap.get(slug);
}

export function isFeatureEnabled(tier: TierConfig, feature: keyof TierConfig['features']): boolean {
  return tier.features[feature] === true;
}

export function isWithinLimit(
  tier: TierConfig,
  limitKey: keyof TierConfig['limits'],
  value: number,
): boolean {
  const limit = tier.limits[limitKey];
  return value <= limit;
}

export function getUpgradePath(slug: string): TierConfig[] {
  const currentTier = getTierBySlug(slug);
  if (!currentTier) {
    return [];
  }

  const currentIndex = DEFAULT_TIERS.findIndex((t) => t.slug === slug);
  // Return all tiers that come after this one in the tier order
  return DEFAULT_TIERS.filter((_tier, index) => index > currentIndex);
}
