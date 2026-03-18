/**
 * Auth Library Setup
 *
 * Simple session-based auth for Cloudflare Workers with D1
 * Uses Web Crypto API for password hashing
 */

export interface DatabaseUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

/**
 * Simple password hasher using Web Crypto API
 */
export function createPasswordHasher() {
  return {
    async hash(password: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async verify(hash: string, password: string): Promise<boolean> {
      const newHash = await this.hash(password);
      return hash === newHash;
    }
  };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Minimum 8 characters
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Create a new user with email/password
 */
export async function createUser(
  db: D1Database,
  email: string,
  password: string,
  hasher: ReturnType<typeof createPasswordHasher>
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Validate email
  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Validate password
  if (!isValidPassword(password)) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  // Check if user exists
  const existing = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  // Hash password
  const passwordHash = await hasher.hash(password);

  // Create user
  const userId = 'u_' + crypto.randomUUID().replace(/-/g, '').substring(0, 21);

  await db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, email.toLowerCase(), passwordHash, Date.now()).run();

  return { success: true, userId };
}

/**
 * Validate user credentials
 */
export async function validateCredentials(
  db: D1Database,
  email: string,
  password: string,
  hasher: ReturnType<typeof createPasswordHasher>
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Find user
  const user = await db.prepare(
    'SELECT id, password_hash FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ id: string; password_hash: string }>();

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Verify password
  const validPassword = await hasher.verify(user.password_hash, password);

  if (!validPassword) {
    return { success: false, error: 'Invalid email or password' };
  }

  return { success: true, userId: user.id };
}

/**
 * Create session for user
 */
export async function createSession(
  db: D1Database,
  userId: string
): Promise<{ sessionId: string; cookie: string }> {
  const sessionId = 's_' + crypto.randomUUID().replace(/-/g, '').substring(0, 43);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();

  // Create cookie
  const cookie = `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

  return { sessionId, cookie };
}

/**
 * Validate session
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<{ valid: boolean; userId?: string }> {
  if (!sessionId) {
    return { valid: false };
  }

  const session = await db.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE id = ?'
  ).bind(sessionId).first<{ user_id: string; expires_at: number }>();

  if (!session) {
    return { valid: false };
  }

  // Check if expired
  if (session.expires_at < Date.now()) {
    // Clean up expired session
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return { valid: false };
  }

  return { valid: true, userId: session.user_id };
}

/**
 * Invalidate session (logout)
 */
export async function logout(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/**
 * Get user by ID
 */
export async function getUser(
  db: D1Database,
  userId: string
): Promise<{ id: string; email: string } | null> {
  return await db.prepare(
    'SELECT id, email FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string }>();
}

// ============ API Key Types and Functions ============

export interface ApiKey {
  id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  name: string;
  scopes: string[];
  last_used_at: number | null;
  expires_at: number | null;
  created_at: number;
  revoked_at: number;
}

/**
 * Available API key scopes
 */
export const API_KEY_SCOPES = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
} as const;

export type ApiKeyScope = typeof API_KEY_SCOPES[keyof typeof API_KEY_SCOPES];

/**
 * Required scopes per route
 */
export const ROUTE_SCOPES: Record<string, ApiKeyScope[]> = {
  'GET /v1/webhooks': [API_KEY_SCOPES.READ],
  'POST /v1/webhooks': [API_KEY_SCOPES.WRITE],
  'GET /v1/webhooks/:id': [API_KEY_SCOPES.READ],
  'GET /v1/auth/keys': [API_KEY_SCOPES.ADMIN],
  'POST /v1/auth/keys': [API_KEY_SCOPES.ADMIN],
  'DELETE /v1/auth/keys/:id': [API_KEY_SCOPES.ADMIN],
};

/**
 * Hash an API key for storage (SHA-256)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const prefix = 'hwk';
  const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  return `${prefix}_${randomPart}`;
}

/**
 * Get the prefix of an API key (for display)
 */
export function getApiKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

/**
 * Create a new API key
 */
export async function createApiKey(
  db: D1Database,
  userId: string,
  name: string,
  scopes: string[],
  expiresAt?: number
): Promise<{ key: ApiKey; rawKey: string }> {
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = getApiKeyPrefix(rawKey);
  const keyId = 'ak_' + crypto.randomUUID().replace(/-/g, '').substring(0, 21);
  const createdAt = Date.now();

  await db.prepare(
    `INSERT INTO api_keys (id, user_id, key_prefix, key_hash, name, scopes, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(keyId, userId, keyPrefix, keyHash, name, JSON.stringify(scopes), expiresAt || null, createdAt).run();

  const key: ApiKey = {
    id: keyId,
    user_id: userId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    name,
    scopes,
    last_used_at: null,
    expires_at: expiresAt || null,
    created_at: createdAt,
    revoked_at: 0,
  };

  return { key, rawKey };
}

/**
 * Validate an API key
 */
export async function validateApiKey(
  db: D1Database,
  rawKey: string
): Promise<{ valid: boolean; key?: ApiKey; userId?: string }> {
  if (!rawKey) {
    return { valid: false };
  }

  const keyHash = await hashApiKey(rawKey);

  const result = await db.prepare(
    `SELECT id, user_id, key_prefix, key_hash, name, scopes, last_used_at, expires_at, created_at, revoked_at
     FROM api_keys WHERE key_hash = ? AND revoked_at = 0`
  ).bind(keyHash).first<{
    id: string;
    user_id: string;
    key_prefix: string;
    key_hash: string;
    name: string;
    scopes: string;
    last_used_at: number | null;
    expires_at: number | null;
    created_at: number;
    revoked_at: number;
  }>();

  if (!result) {
    return { valid: false };
  }

  // Check expiration
  if (result.expires_at && result.expires_at < Date.now()) {
    return { valid: false };
  }

  // Update last used
  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(Date.now(), result.id).run();

  const key: ApiKey = {
    id: result.id,
    user_id: result.user_id,
    key_prefix: result.key_prefix,
    key_hash: result.key_hash,
    name: result.name,
    scopes: JSON.parse(result.scopes),
    last_used_at: result.last_used_at,
    expires_at: result.expires_at,
    created_at: result.created_at,
    revoked_at: result.revoked_at,
  };

  return { valid: true, key, userId: result.user_id };
}

/**
 * List API keys for a user
 */
export async function listApiKeys(
  db: D1Database,
  userId: string
): Promise<Omit<ApiKey, 'key_hash'>[]> {
  const results = await db.prepare(
    `SELECT id, user_id, key_prefix, name, scopes, last_used_at, expires_at, created_at, revoked_at
     FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all<{
    id: string;
    user_id: string;
    key_prefix: string;
    name: string;
    scopes: string;
    last_used_at: number | null;
    expires_at: number | null;
    created_at: number;
    revoked_at: number;
  }>();

  return results.results.map(r => ({
    id: r.id,
    user_id: r.user_id,
    key_prefix: r.key_prefix,
    key_hash: '', // Never expose hash
    name: r.name,
    scopes: JSON.parse(r.scopes),
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    revoked_at: r.revoked_at,
  }));
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  db: D1Database,
  userId: string,
  keyId: string
): Promise<boolean> {
  const result = await db.prepare(
    'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at = 0'
  ).bind(Date.now(), keyId, userId).run();

  return result.success && result.meta.changes && result.meta.changes > 0;
}

/**
 * Check if API key has required scope
 */
export function hasScope(key: ApiKey, requiredScopes: ApiKeyScope[]): boolean {
  if (!key.scopes) return false;
  return requiredScopes.every(scope => key.scopes.includes(scope));
}
