import { type TierConfig, getTierBySlug, isFeatureEnabled } from '@hookwing/shared';
import type { Context, Next } from 'hono';

/**
 * Hardcoded tier for now (auth/DB lookup comes in PROD-58/59)
 */
const CURRENT_TIER_SLUG = 'paper-plane';

/**
 * Get the current tier config for the request.
 * Currently hardcoded, will be replaced with real auth lookup later.
 */
export function getCurrentTier(_c: Context): TierConfig {
  const tier = getTierBySlug(CURRENT_TIER_SLUG);
  if (!tier) {
    // This should never happen - paper-plane is always defined
    throw new Error('Default tier not found');
  }
  return tier;
}

/**
 * Middleware factory to check if a feature is enabled on the user's tier.
 *
 * @param feature - The feature key to check
 * @returns Hono middleware that allows or denies access
 */
export function checkTierFeature(feature: keyof TierConfig['features']) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const tier = getCurrentTier(c);

    if (isFeatureEnabled(tier, feature)) {
      await next();
    } else {
      return c.json(
        {
          error: 'Feature not available on your tier',
          tier: CURRENT_TIER_SLUG,
          feature,
        },
        403,
      );
    }
  };
}
