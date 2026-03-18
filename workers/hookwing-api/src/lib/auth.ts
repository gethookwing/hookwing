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
