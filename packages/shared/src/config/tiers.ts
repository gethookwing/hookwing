import { z } from 'zod';

const TierLimitsSchema = z.object({
  max_destinations: z.number().int().min(1),
  max_endpoints: z.number().int().min(1),
  max_events_per_month: z.number().int().min(1),
  max_payload_size_bytes: z.number().int().min(1),
  max_retry_attempts: z.number().int().min(0),
  retention_days: z.number().int().min(1),
  rate_limit_per_second: z.number().int().min(1),
});

const TierFeaturesSchema = z.object({
  custom_headers: z.boolean(),
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
      max_destinations: 3,
      max_endpoints: 3,
      max_events_per_month: 10_000,
      max_payload_size_bytes: 64 * 1024, // 64KB
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
  },
  {
    slug: 'biplane',
    name: 'Biplane',
    price_monthly_usd: 29,
    limits: {
      max_destinations: 10,
      max_endpoints: 10,
      max_events_per_month: 100_000,
      max_payload_size_bytes: 256 * 1024, // 256KB
      max_retry_attempts: 5,
      retention_days: 30,
      rate_limit_per_second: 50,
    },
    features: {
      custom_headers: true,
      ip_whitelist: false,
      transformations: false,
      dead_letter_queue: false,
      priority_delivery: false,
      webhook_signing: true,
      analytics: false,
      team_members: 3,
    },
  },
  {
    slug: 'warbird',
    name: 'Warbird',
    price_monthly_usd: 99,
    limits: {
      max_destinations: 50,
      max_endpoints: 50,
      max_events_per_month: 1_000_000,
      max_payload_size_bytes: 1024 * 1024, // 1MB
      max_retry_attempts: 7,
      retention_days: 90,
      rate_limit_per_second: 200,
    },
    features: {
      custom_headers: true,
      ip_whitelist: true,
      transformations: false,
      dead_letter_queue: true,
      priority_delivery: false,
      webhook_signing: true,
      analytics: true,
      team_members: 10,
    },
  },
  {
    slug: 'jet',
    name: 'Jet',
    price_monthly_usd: 299,
    limits: {
      max_destinations: 999_999,
      max_endpoints: 500,
      max_events_per_month: 10_000_000,
      max_payload_size_bytes: 10 * 1024 * 1024, // 10MB
      max_retry_attempts: 10,
      retention_days: 365,
      rate_limit_per_second: 1000,
    },
    features: {
      custom_headers: true,
      ip_whitelist: true,
      transformations: true,
      dead_letter_queue: true,
      priority_delivery: true,
      webhook_signing: true,
      analytics: true,
      team_members: 9999,
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

  return DEFAULT_TIERS.filter(
    (tier) => tier.price_monthly_usd > currentTier.price_monthly_usd,
  ).sort((a, b) => a.price_monthly_usd - b.price_monthly_usd);
}
