import { type TierConfig, getTierBySlug, isFeatureEnabled } from '@hookwing/shared';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Hardcoded tier for now (auth/DB lookup comes in PROD-58/59)
 */
const CURRENT_TIER_SLUG = 'free';

/**
 * Get the current tier config for the request.
 * Currently hardcoded, will be replaced with real auth lookup later.
 */
export function getCurrentTier(_c: Context): TierConfig {
  const tier = getTierBySlug(CURRENT_TIER_SLUG);
  if (!tier) {
    throw new Error('Default tier not found');
  }
  return tier;
}

/**
 * Middleware factory: check if a feature is enabled on the user's tier.
 * Returns 403 if feature is not available. Calls next() if allowed.
 */
export function checkTierFeature(feature: keyof TierConfig['features']): MiddlewareHandler {
  return async (c, next) => {
    const tier = getCurrentTier(c);
    if (!isFeatureEnabled(tier, feature)) {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: CURRENT_TIER_SLUG,
          feature,
        },
        403,
      );
    }
    return await next();
  };
}
