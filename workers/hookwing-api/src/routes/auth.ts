/**
 * Auth Routes
 *
 * Endpoints:
 * - POST /v1/auth/signup - Create new account
 * - POST /v1/auth/login - Login
 * - POST /v1/auth/logout - Logout
 * - POST /v1/auth/password-reset - Request password reset
 * - GET /v1/auth/me - Get current user
 */

import { Hono, type Context } from 'hono';
import { createPasswordHasher, createUser, validateCredentials, createSession, logout, validateSession, getUser } from '../lib/auth';
import { createRateLimiter, RATE_LIMIT_CONFIGS } from '../lib/rate-limit';
import type { Env } from '../env';

const auth = new Hono<{ Bindings: Env }>();

// Rate limiters
const loginRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.login);
const signupRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.signup);
const passwordResetRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.passwordReset);

/**
 * Extract session ID from cookie or header
 */
function getSessionId(c: Context): string | null {
  // First check header
  const headerSessionId = c.req.header('X-Session-ID');
  if (headerSessionId) return headerSessionId;

  // Then check cookie
  const cookie = c.req.header('Cookie');
  if (cookie) {
    const match = cookie.match(/session=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * POST /v1/auth/signup
 * Create a new user account
 */
auth.post('/signup', signupRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const db = c.env.DB;
    const hasher = createPasswordHasher();

    const result = await createUser(db, email, password, hasher);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Create session
    const { cookie } = await createSession(db, result.userId!);

    return c.json({
      user: { id: result.userId, email }
    }, 201, {
      'Set-Cookie': cookie
    });

  } catch (e) {
    console.error('Signup error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /v1/auth/login
 * Login with email/password
 */
auth.post('/login', loginRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const db = c.env.DB;
    const hasher = createPasswordHasher();

    const result = await validateCredentials(db, email, password, hasher);

    if (!result.success) {
      return c.json({ error: result.error }, 401);
    }

    // Create session
    const { cookie } = await createSession(db, result.userId!);

    return c.json({
      user: { id: result.userId, email }
    }, 200, {
      'Set-Cookie': cookie
    });

  } catch (e) {
    console.error('Login error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /v1/auth/logout
 * Logout current user
 */
auth.post('/logout', async (c) => {
  const sessionId = getSessionId(c);

  if (!sessionId) {
    return c.json({ error: 'No session found' }, 401);
  }

  try {
    const db = c.env.DB;
    await logout(db, sessionId);

    return c.json({ success: true }, 200, {
      'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    });
  } catch (e) {
    console.error('Logout error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /v1/auth/password-reset
 * Request password reset (sends email with reset token)
 */
auth.post('/password-reset', passwordResetRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const db = c.env.DB;

    // Check if user exists (don't reveal if email exists or not for security)
    const user = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{ id: string }>();

    // Always return success to prevent email enumeration
    // In production, would send reset email here
    if (user) {
      // Generate reset token and store it
      const resetToken = crypto.randomUUID();
      const resetExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

      await db.prepare(
        'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)'
      ).bind(user.id, resetToken, resetExpiry).run();

      // In production: send email with reset link
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    return c.json({
      message: 'If the email exists, a reset link has been sent'
    }, 200);

  } catch (e) {
    console.error('Password reset error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /v1/auth/me
 * Get current authenticated user
 */
auth.get('/me', async (c) => {
  const sessionId = getSessionId(c);

  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const db = c.env.DB;
    const { valid, userId } = await validateSession(db, sessionId);

    if (!valid || !userId) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // Get user details
    const user = await getUser(db, userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user }, 200);

  } catch (e) {
    console.error('Get user error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;
