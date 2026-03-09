import { z } from 'zod';

const TierLimitsSchema = z.object({
  max_destinations: z.number().int().positive(),
  max_events_per_month: z.number().int().positive(),
  max_payload_size_bytes: z.number().int().positive(),
  max_retry_attempts: z.number().int().nonnegative(),
  retention_days: z.number().int().positive(),
});

const TierFeaturesSchema = z.object({
  custom_headers: z.boolean(),
  ip_whitelist: z.boolean(),
  transformations: z.boolean(),
  dead_letter_queue: z.boolean(),
  priority_delivery: z.boolean(),
});

export const TierConfigSchema = z.object({
  name: z.string(),
  slug: z.string(),
  limits: TierLimitsSchema,
  features: TierFeaturesSchema,
});

export type TierConfig = z.infer<typeof TierConfigSchema>;

export const DEFAULT_TIERS: TierConfig[] = [
  {
    name: 'Paper Plane',
    slug: 'paper-plane',
    limits: {
      max_destinations: 5,
      max_events_per_month: 1000,
      max_payload_size_bytes: 10 * 1024, // 10KB
      max_retry_attempts: 3,
      retention_days: 7,
    },
    features: {
      custom_headers: false,
      ip_whitelist: false,
      transformations: false,
      dead_letter_queue: false,
      priority_delivery: false,
    },
  },
  {
    name: 'Biplane',
    slug: 'biplane',
    limits: {
      max_destinations: 25,
      max_events_per_month: 10000,
      max_payload_size_bytes: 64 * 1024, // 64KB
      max_retry_attempts: 5,
      retention_days: 30,
    },
    features: {
      custom_headers: true,
      ip_whitelist: false,
      transformations: false,
      dead_letter_queue: false,
      priority_delivery: false,
    },
  },
  {
    name: 'Warbird',
    slug: 'warbird',
    limits: {
      max_destinations: 100,
      max_events_per_month: 100000,
      max_payload_size_bytes: 256 * 1024, // 256KB
      max_retry_attempts: 10,
      retention_days: 90,
    },
    features: {
      custom_headers: true,
      ip_whitelist: true,
      transformations: true,
      dead_letter_queue: true,
      priority_delivery: false,
    },
  },
  {
    name: 'Jet',
    slug: 'jet',
    limits: {
      max_destinations: 500,
      max_events_per_month: 1000000,
      max_payload_size_bytes: 1024 * 1024, // 1MB
      max_retry_attempts: 20,
      retention_days: 365,
    },
    features: {
      custom_headers: true,
      ip_whitelist: true,
      transformations: true,
      dead_letter_queue: true,
      priority_delivery: true,
    },
  },
];

const tiersMap = new Map<string, TierConfig>(DEFAULT_TIERS.map((tier) => [tier.slug, tier]));

export function getTier(slug: string): TierConfig | undefined {
  return tiersMap.get(slug);
}
