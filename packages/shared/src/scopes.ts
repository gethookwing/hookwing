/**
 * Canonical list of valid API key scopes.
 * Every route-level scope enforcement MUST use one of these values.
 */
export const VALID_SCOPES = [
  'workspace:read',
  'keys:read',
  'keys:write',
  'endpoints:read',
  'endpoints:write',
  'events:read',
  'events:write',
  'deliveries:read',
  'analytics:read',
  'billing:read',
  'billing:upgrade',
] as const;

export type ApiKeyScope = (typeof VALID_SCOPES)[number];

/**
 * Validate that all provided scopes are recognized.
 * Returns an array of invalid scopes, or empty array if all valid.
 */
export function validateScopes(scopes: string[]): string[] {
  return scopes.filter((s) => !(VALID_SCOPES as readonly string[]).includes(s));
}
