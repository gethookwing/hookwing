/**
 * Environment type definitions
 */

export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespace for rate limiting
  RATE_LIMIT: KVNamespace;

  // Environment
  ENVIRONMENT?: string;
}

/**
 * Variables attached to request context
 */
export interface Variables {
  apiKey?: import('./lib/auth').ApiKey;
  userId?: string;
}
