import { createHmac, randomBytes } from 'node:crypto';
import {
  apiKeys,
  generateApiKey,
  generateId,
  getTierBySlug,
  hashPassword,
  oauthAccounts,
  passwordResetTokens,
  validateScopes,
  verifyPassword,
  workspaces,
} from '@hookwing/shared';
import { and, eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';
import { applyRateLimit, createRateLimitMiddleware } from '../middleware/rateLimit';

// OAuth provider types
type OAuthProvider = 'github' | 'google';

type AuthBindings = {
  DB?: D1Database;
  APP_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

const auth = new Hono<{ Bindings: AuthBindings }>();
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS = 60_000;
const FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 3;
const RESET_PASSWORD_RATE_LIMIT_WINDOW_MS = 60_000;
const RESET_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
const RESET_PASSWORD_TOKEN_EXPIRY_MS = 3600_000; // 1 hour

// ============================================================================
// Validation schemas
// ============================================================================

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1).optional(),
  turnstileToken: z.string().optional(), // Only validated if TURNSTILE_SECRET is set
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  turnstileToken: z.string().optional(), // Only validated if TURNSTILE_SECRET is set
});

const createKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

function getClientIp(c: Context): string {
  const forwardedFor = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For');
  const candidate = forwardedFor?.split(',')[0]?.trim() || c.req.header('X-Real-IP')?.trim();
  return candidate && candidate.length > 0 ? candidate : 'unknown';
}

function normalizeEmailForRateLimit(email: string): string {
  return email.toLowerCase().trim();
}

async function fingerprintEmailForRateLimit(email: string): Promise<string> {
  const normalized = normalizeEmailForRateLimit(email);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Dummy hash for nonexistent users - used to prevent timing enumeration.
// This is a valid PBKDF2-SHA256 hash format that will be used for dummy verification.
const DUMMY_PASSWORD_HASH = 'dGVzdGluZ19kdW1teV9oYXNo:dGVzdGluZ19kdW1teV9oYXNo';

const authAbuseProtection = createRateLimitMiddleware({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  keyFn: (c) => {
    const action = c.req.path.endsWith('/signup') ? 'signup' : 'login';
    const ip = getClientIp(c);

    // Email-based rate limiting is applied inside the route handler after parsing.
    // This IP-based rate limiter provides a first layer of defense.

    return `auth:${action}:${ip}`;
  },
  getLimit: () => AUTH_RATE_LIMIT_MAX_ATTEMPTS,
});

const forgotPasswordRateLimit = createRateLimitMiddleware({
  windowMs: FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS,
  keyFn: (c) => `auth:forgot-password:${getClientIp(c)}`,
  getLimit: () => FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
});

const resetPasswordRateLimit = createRateLimitMiddleware({
  windowMs: RESET_PASSWORD_RATE_LIMIT_WINDOW_MS,
  keyFn: (c) => `auth:reset-password:${getClientIp(c)}`,
  getLimit: () => RESET_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
});

// ============================================================================
// Email sending helpers
// ============================================================================

async function sendResetEmail(
  email: string,
  token: string,
  env: { RESEND_API_KEY?: string; APP_URL?: string } | undefined,
): Promise<void> {
  if (!env?.RESEND_API_KEY) {
    // Skip in dev/test environments
    console.log(`[DEV] Would send reset email to ${email} with token ${token}`);
    return;
  }

  const appUrl = env.APP_URL ?? 'https://hookwing.com';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hookwing <no-reply@hookwing.com>',
        to: email,
        subject: 'Reset your Hookwing password',
        html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you didn't request this, ignore this email.</p>`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Resend] Failed to send email: ${response.status} ${error}`);
    }
  } catch (error) {
    console.error(`[Resend] Error sending email: ${error}`);
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Cloudflare Turnstile CAPTCHA verification
// ============================================================================

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

// ============================================================================
// TOTP 2FA Implementation (RFC 6238)
// ============================================================================

// Base32 encoding/decoding for TOTP secret
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

function base32Decode(encoded: string): Uint8Array {
  const cleaned = encoded
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
    .replace(/=+$/, '');
  const buffer: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      buffer.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(buffer);
}

function generateTOTPSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

function generateTOTP(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const code =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    ((hmac[offset + 1] ?? 0) << 16) |
    ((hmac[offset + 2] ?? 0) << 8) |
    (hmac[offset + 3] ?? 0);
  return (code % 1000000).toString().padStart(6, '0');
}

function verifyTOTP(secret: string, code: string, window = 1): boolean {
  const now = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, now + i) === code) return true;
  }
  return false;
}

// ============================================================================
// POST /v1/auth/signup - Create workspace + first API key
// ============================================================================

auth.use('/signup', authAbuseProtection);
auth.post('/signup', async (c) => {
  const body = await c.req.json();

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, password, workspaceName, turnstileToken } = parsed.data;

  // Apply email-based rate limiting to prevent distributed signup abuse.
  if (c.env?.DB) {
    const emailFingerprint = await fingerprintEmailForRateLimit(email);
    const emailRateLimitResult = await applyRateLimit(
      createDb(c.env.DB),
      `auth:signup:email:${emailFingerprint}`,
      AUTH_RATE_LIMIT_MAX_ATTEMPTS,
      AUTH_RATE_LIMIT_WINDOW_MS,
    );
    // Add email-based rate limit headers
    c.header('X-RateLimit-Limit-Email', String(emailRateLimitResult.limit));
    c.header('X-RateLimit-Remaining-Email', String(emailRateLimitResult.remaining));

    if (emailRateLimitResult.overLimit) {
      const retryAfter = Math.ceil((emailRateLimitResult.resetTime * 1000 - Date.now()) / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return c.json({ error: 'Too many signup attempts for this email' }, 429);
    }
  }

  // Cloudflare Turnstile CAPTCHA verification (if configured)
  // Skip verification if no token provided (agent/API mode) or no secret configured
  const turnstileSecret = c.env?.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && turnstileToken) {
    const clientIp = getClientIp(c);
    const isValid = await verifyTurnstile(turnstileToken, turnstileSecret, clientIp);
    if (!isValid) {
      return c.json({ error: 'CAPTCHA verification failed' }, 400);
    }
  } else if (turnstileSecret && !turnstileToken) {
    // TURNSTILE_SECRET_KEY is set but no token - reject unless it's an API-only request
    const accept = c.req.header('Accept') ?? '';
    const isApiClient = accept.includes('application/json') || c.req.header('X-Api-Client');
    if (!isApiClient) {
      return c.json({ error: 'CAPTCHA token required' }, 400);
    }
  }

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const emailPrefix =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? 'user';
  const slug = `${emailPrefix}-${generateId('ws').substring(3, 8)}`;

  const passwordHash = await hashPassword(password);

  const workspaceId = generateId('ws');
  const now = Date.now();

  await db.insert(workspaces).values({
    id: workspaceId,
    email: email.toLowerCase(),
    passwordHash,
    name: workspaceName ?? `${email.split('@')[0]}'s Workspace`,
    slug,
    tierSlug: 'paper-plane',
    createdAt: now,
    updatedAt: now,
  });

  const keyData = await generateApiKey();
  const keyId = generateId('key');

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId,
    name: 'Default',
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: null,
    isActive: 1,
    createdAt: now,
  });

  const tier = getTierBySlug('paper-plane');

  return c.json(
    {
      workspace: {
        id: workspaceId,
        name: workspaceName ?? `${email.split('@')[0]}'s Workspace`,
        slug,
        tier,
      },
      apiKey: keyData.key,
    },
    201,
  );
});

// ============================================================================
// POST /v1/auth/login - Authenticate and get API key
// ============================================================================

auth.use('/login', authAbuseProtection);
auth.post('/login', async (c) => {
  const body = await c.req.json();

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, password, turnstileToken } = parsed.data;
  const normalizedEmail = normalizeEmailForRateLimit(email);

  // Cloudflare Turnstile CAPTCHA verification (if configured)
  // Skip verification if no token provided (agent/API mode) or no secret configured
  const turnstileSecret = c.env?.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && turnstileToken) {
    const clientIp = getClientIp(c);
    const isValid = await verifyTurnstile(turnstileToken, turnstileSecret, clientIp);
    if (!isValid) {
      return c.json({ error: 'CAPTCHA verification failed' }, 400);
    }
  } else if (turnstileSecret && !turnstileToken) {
    // TURNSTILE_SECRET_KEY is set but no token - reject unless it's an API-only request
    const accept = c.req.header('Accept') ?? '';
    const isApiClient = accept.includes('application/json') || c.req.header('X-Api-Client');
    if (!isApiClient) {
      return c.json({ error: 'CAPTCHA token required' }, 400);
    }
  }

  // Apply email-based rate limiting to prevent distributed attacks on specific accounts.
  if (c.env?.DB) {
    const emailFingerprint = await fingerprintEmailForRateLimit(email);
    const emailRateLimitResult = await applyRateLimit(
      createDb(c.env.DB),
      `auth:login:email:${emailFingerprint}`,
      AUTH_RATE_LIMIT_MAX_ATTEMPTS,
      AUTH_RATE_LIMIT_WINDOW_MS,
    );
    // Add email-based rate limit headers
    c.header('X-RateLimit-Limit-Email', String(emailRateLimitResult.limit));
    c.header('X-RateLimit-Remaining-Email', String(emailRateLimitResult.remaining));

    if (emailRateLimitResult.overLimit) {
      const retryAfter = Math.ceil((emailRateLimitResult.resetTime * 1000 - Date.now()) / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return c.json({ error: 'Too many login attempts for this email' }, 429);
    }
  }

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, normalizedEmail))
    .limit(1)
    .then((rows) => rows[0]);

  // Always verify password to prevent timing enumeration.
  // For nonexistent users, use a dummy hash that takes similar time to verify.
  const passwordHash = workspace?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const isValid = await verifyPassword(password, passwordHash);

  // Only check workspace existence after password verification to ensure
  // consistent timing regardless of whether account exists
  if (!workspace || !isValid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Check if TOTP 2FA is enabled - if so, return temp token instead of API key
  if (workspace.totpEnabled && workspace.totpSecret) {
    const timestamp = Date.now();
    const signature = createHmac('sha256', c.env?.TURNSTILE_SECRET_KEY ?? 'default')
      .update(`${workspace.id}:${timestamp}`)
      .digest('hex');
    const tempToken = btoa(`${workspace.id}:${timestamp}:${signature}`);

    return c.json({
      requiresTwoFactor: true,
      tempToken,
    });
  }

  // Get first active API key or create a new session key
  const existingKeys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.workspaceId, workspace.id), eq(apiKeys.isActive, 1)))
    .limit(1)
    .then((rows) => rows[0]);

  let apiKey: string;

  if (existingKeys) {
    // Return the existing key (we can't return the full key, so generate a new one)
    // Actually, we need to return a usable key. Let's check if there's a way to get it.
    // The key is hashed, so we can't return it. We need to generate a new one.
    const keyData = await generateApiKey();
    const keyId = generateId('key');
    const now = Date.now();

    await db.insert(apiKeys).values({
      id: keyId,
      workspaceId: workspace.id,
      name: 'Dashboard Session',
      keyHash: keyData.hash,
      keyPrefix: keyData.prefix,
      scopes: null,
      isActive: 1,
      createdAt: now,
    });

    apiKey = keyData.key;
  } else {
    const keyData = await generateApiKey();
    const keyId = generateId('key');
    const now = Date.now();

    await db.insert(apiKeys).values({
      id: keyId,
      workspaceId: workspace.id,
      name: 'Dashboard Session',
      keyHash: keyData.hash,
      keyPrefix: keyData.prefix,
      scopes: null,
      isActive: 1,
      createdAt: now,
    });

    apiKey = keyData.key;
  }

  const tier = getTierBySlug(workspace.tierSlug);

  return c.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      email: workspace.email,
      tier,
      createdAt: workspace.createdAt,
    },
    apiKey,
  });
});

// ============================================================================
// GET /v1/auth/me - Get current workspace info (authenticated)
// ============================================================================

auth.get('/me', authMiddleware, requireApiKeyScopes(['workspace:read']), async (c) => {
  const workspace = getWorkspace(c);
  const tier = getTierBySlug(workspace.tierSlug);

  return c.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      email: workspace.email,
      tier,
      createdAt: workspace.createdAt,
    },
  });
});

// ============================================================================
// POST /v1/auth/keys - Create additional API key (authenticated)
// ============================================================================

auth.post('/keys', authMiddleware, requireApiKeyScopes(['keys:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { name, scopes } = parsed.data;

  if (scopes && scopes.length > 0) {
    const invalidScopes = validateScopes(scopes);
    if (invalidScopes.length > 0) {
      return c.json({ error: 'Invalid scopes', invalidScopes }, 400);
    }
  }

  const keyData = await generateApiKey();
  const keyId = generateId('key');
  const now = Date.now();

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId: workspace.id,
    name,
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: scopes ? JSON.stringify(scopes) : null,
    isActive: 1,
    createdAt: now,
  });

  return c.json(
    {
      apiKey: {
        id: keyId,
        name,
        prefix: keyData.prefix,
        scopes,
      },
      key: keyData.key,
    },
    201,
  );
});

// ============================================================================
// GET /v1/auth/keys - List API keys for workspace (authenticated)
// ============================================================================

auth.get('/keys', authMiddleware, requireApiKeyScopes(['keys:read']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const keys = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspace.id));

  return c.json({
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      scopes: key.scopes ? JSON.parse(key.scopes) : null,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: Boolean(key.isActive),
      createdAt: key.createdAt,
    })),
  });
});

// ============================================================================
// DELETE /v1/auth/keys/:id - Revoke API key (authenticated)
// ============================================================================

auth.delete('/keys/:id', authMiddleware, requireApiKeyScopes(['keys:write']), async (c) => {
  const workspace = getWorkspace(c);
  const keyId = c.req.param('id');
  const db = createDb(c.env.DB);

  const key = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key || key.workspaceId !== workspace.id) {
    return c.json({ error: 'API key not found' }, 404);
  }

  const activeKeys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.workspaceId, workspace.id), eq(apiKeys.isActive, 1)));

  if (activeKeys.length === 1 && activeKeys[0]?.id === keyId) {
    return c.json({ error: 'Cannot delete the last active API key' }, 400);
  }

  await db.update(apiKeys).set({ isActive: 0 }).where(eq(apiKeys.id, keyId));

  return c.json({ success: true });
});

// ============================================================================
// OAuth helpers
// ============================================================================

function getOAuthConfig(c: Context) {
  return {
    github: {
      clientId: c.env?.GITHUB_CLIENT_ID ?? '',
      clientSecret: c.env?.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: c.env?.GOOGLE_CLIENT_ID ?? '',
      clientSecret: c.env?.GOOGLE_CLIENT_SECRET ?? '',
    },
  };
}

function isOAuthConfigured(c: Context, provider: OAuthProvider): boolean {
  const config = getOAuthConfig(c);
  return Boolean(config[provider].clientId && config[provider].clientSecret);
}

async function findOrCreateWorkspaceFromOAuth(
  db: ReturnType<typeof createDb>,
  email: string,
  name?: string,
): Promise<{ workspaceId: string; isNew: boolean; slug: string }> {
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, email.toLowerCase()))
    .limit(1);

  const workspace = existing[0];
  if (workspace) {
    return { workspaceId: workspace.id, isNew: false, slug: workspace.slug };
  }

  // Create new workspace
  const emailPrefix =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? 'user';
  const slug = `${emailPrefix}-${generateId('ws').substring(3, 8)}`;
  const workspaceId = generateId('ws');
  const now = Date.now();

  await db.insert(workspaces).values({
    id: workspaceId,
    email: email.toLowerCase(),
    passwordHash: DUMMY_PASSWORD_HASH, // OAuth users don't have password
    name: name ?? `${email.split('@')[0]}'s Workspace`,
    slug,
    tierSlug: 'paper-plane',
    createdAt: now,
    updatedAt: now,
  });

  return { workspaceId, isNew: true, slug };
}

async function generateApiKeyForWorkspace(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
): Promise<string> {
  const keyData = await generateApiKey();
  const keyId = generateId('key');
  const now = Date.now();

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId,
    name: 'Default',
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: null,
    isActive: 1,
    createdAt: now,
  });

  return keyData.key;
}

// ============================================================================
// GET /v1/auth/github - Redirect to GitHub OAuth
// ============================================================================

auth.get('/github', async (c) => {
  if (!isOAuthConfigured(c, 'github')) {
    return c.json({ error: 'GitHub OAuth not configured' }, 503);
  }

  const config = getOAuthConfig(c);
  const clientId = config.github.clientId;
  const redirectUri = `${c.env?.APP_URL ?? 'https://hookwing.com'}/v1/auth/github/callback`;

  const scope = 'read:user user:email';
  const state = generateId('oauth');

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);

  return c.redirect(authUrl.toString(), 302);
});

// ============================================================================
// GET /v1/auth/github/callback - Handle GitHub OAuth callback
// ============================================================================

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: 'OAuth authorization denied' }, 400);
  }

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  if (!isOAuthConfigured(c, 'github')) {
    return c.json({ error: 'GitHub OAuth not configured' }, 503);
  }

  const config = getOAuthConfig(c);
  const redirectUri = `${c.env?.APP_URL ?? 'https://hookwing.com'}/v1/auth/github/callback`;

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return c.json({ error: 'Failed to exchange code for token' }, 500);
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return c.json({ error: 'No access token received' }, 500);
  }

  const accessToken = tokenData.access_token;

  // Fetch user profile
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!userResponse.ok) {
    return c.json({ error: 'Failed to fetch user profile' }, 500);
  }

  const userData = (await userResponse.json()) as {
    id: number;
    email?: string;
    name?: string;
    avatar_url?: string;
  };

  // Get primary email if not provided
  let email = userData.email;
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as Array<{ email: string; primary: boolean }>;
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail?.email ?? emails[0]?.email;
    }
  }

  if (!email) {
    return c.json({ error: 'Could not get email from GitHub' }, 400);
  }

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  // Find or create workspace
  const { workspaceId, isNew, slug } = await findOrCreateWorkspaceFromOAuth(
    db,
    email,
    userData.name,
  );

  // Link OAuth account
  const now = Date.now();
  const existingOAuth = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, 'github'),
        eq(oauthAccounts.providerAccountId, String(userData.id)),
      ),
    )
    .limit(1);

  if (existingOAuth.length === 0) {
    await db.insert(oauthAccounts).values({
      id: generateId('oauth'),
      workspaceId,
      provider: 'github',
      providerAccountId: String(userData.id),
      email: email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Generate API key
  const apiKey = await generateApiKeyForWorkspace(db, workspaceId);
  const tier = getTierBySlug('paper-plane');

  // Check if request accepts JSON or expects redirect
  const accept = c.req.header('Accept') ?? '';
  if (accept.includes('application/json') || c.req.header('X-Api-Client')) {
    return c.json({
      workspace: {
        id: workspaceId,
        name: isNew ? `${email.split('@')[0]}'s Workspace` : undefined,
        slug,
        tier,
      },
      apiKey,
    });
  }

  // Redirect to app with API key
  const appUrl = c.env?.APP_URL ?? 'https://hookwing.com';
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('apiKey', apiKey);
  redirectUrl.searchParams.set('workspaceId', workspaceId);

  return c.redirect(redirectUrl.toString(), 302);
});

// ============================================================================
// GET /v1/auth/google - Redirect to Google OAuth
// ============================================================================

auth.get('/google', async (c) => {
  if (!isOAuthConfigured(c, 'google')) {
    return c.json({ error: 'Google OAuth not configured' }, 503);
  }

  const config = getOAuthConfig(c);
  const clientId = config.google.clientId;
  const redirectUri = `${c.env?.APP_URL ?? 'https://hookwing.com'}/v1/auth/google/callback`;

  const scope = 'openid email profile';
  const state = generateId('oauth');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  return c.redirect(authUrl.toString(), 302);
});

// ============================================================================
// GET /v1/auth/google/callback - Handle Google OAuth callback
// ============================================================================

auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: 'OAuth authorization denied' }, 400);
  }

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  if (!isOAuthConfigured(c, 'google')) {
    return c.json({ error: 'Google OAuth not configured' }, 503);
  }

  const config = getOAuthConfig(c);
  const redirectUri = `${c.env?.APP_URL ?? 'https://hookwing.com'}/v1/auth/google/callback`;

  // Exchange code for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return c.json({ error: 'Failed to exchange code for token' }, 500);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };
  if (!tokenData.access_token) {
    return c.json({ error: 'No access token received' }, 500);
  }

  const accessToken = tokenData.access_token;

  // Fetch user profile
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    return c.json({ error: 'Failed to fetch user profile' }, 500);
  }

  const userData = (await userResponse.json()) as {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };

  if (!userData.email) {
    return c.json({ error: 'Could not get email from Google' }, 400);
  }

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  // Find or create workspace
  const { workspaceId, isNew, slug } = await findOrCreateWorkspaceFromOAuth(
    db,
    userData.email,
    userData.name,
  );

  // Link OAuth account
  const now = Date.now();
  const existingOAuth = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, userData.id)),
    )
    .limit(1);

  if (existingOAuth.length === 0) {
    await db.insert(oauthAccounts).values({
      id: generateId('oauth'),
      workspaceId,
      provider: 'google',
      providerAccountId: userData.id,
      email: userData.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Generate API key
  const apiKey = await generateApiKeyForWorkspace(db, workspaceId);
  const tier = getTierBySlug('paper-plane');

  // Check if request accepts JSON or expects redirect
  const accept = c.req.header('Accept') ?? '';
  if (accept.includes('application/json') || c.req.header('X-Api-Client')) {
    return c.json({
      workspace: {
        id: workspaceId,
        name: isNew ? `${userData.email.split('@')[0]}'s Workspace` : undefined,
        slug,
        tier,
      },
      apiKey,
    });
  }

  // Redirect to app with API key
  const appUrl = c.env?.APP_URL ?? 'https://hookwing.com';
  const redirectUrl = new URL(`${appUrl}/dashboard`);
  redirectUrl.searchParams.set('apiKey', apiKey);
  redirectUrl.searchParams.set('workspaceId', workspaceId);

  return c.redirect(redirectUrl.toString(), 302);
});

// ============================================================================
// POST /v1/auth/forgot-password - Request password reset
// ============================================================================

auth.use('/forgot-password', forgotPasswordRateLimit);
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json();

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  // Look up workspace by email
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, normalizedEmail))
    .limit(1)
    .then((rows) => rows[0]);

  // Always return 200 regardless of whether email exists (don't leak info)
  // If workspace exists, generate and send reset token
  if (workspace) {
    // Generate a random token
    const token = generateResetToken();
    const tokenHash = await hashToken(token);
    const expiresAt = Date.now() + RESET_PASSWORD_TOKEN_EXPIRY_MS;
    const now = Date.now();

    // Store token in database
    await db.insert(passwordResetTokens).values({
      id: generateId('prt'),
      workspaceId: workspace.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });

    // Send email (async, don't block response)
    sendResetEmail(workspace.email, token, c.env);
  }

  return c.json({ success: true });
});

// ============================================================================
// POST /v1/auth/reset-password - Reset password with token
// ============================================================================

auth.use('/reset-password', resetPasswordRateLimit);
auth.post('/reset-password', async (c) => {
  const body = await c.req.json();

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { token, newPassword } = parsed.data;

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  // Hash the incoming token and look up in DB
  const tokenHash = await hashToken(token);

  const resetToken = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1)
    .then((rows) => rows[0]);

  // Check if token is valid
  if (!resetToken) {
    return c.json({ error: 'Invalid token' }, 400);
  }

  // Check if token has already been used
  if (resetToken.usedAt) {
    return c.json({ error: 'Token already used' }, 400);
  }

  // Check if token has expired
  if (Date.now() > resetToken.expiresAt) {
    return c.json({ error: 'Token expired' }, 400);
  }

  // Get the workspace
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, resetToken.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 400);
  }

  // Hash the new password and update workspace
  const newPasswordHash = await hashPassword(newPassword);
  const now = Date.now();

  await db
    .update(workspaces)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspace.id));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetToken.id));

  return c.json({ success: true });
});

// ============================================================================
// POST /v1/auth/2fa/setup - Generate TOTP secret for 2FA setup (authenticated)
// ============================================================================

auth.post('/2fa/setup', authMiddleware, requireApiKeyScopes(['workspace:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  // If already enabled, return error
  if (workspace.totpEnabled) {
    return c.json({ error: '2FA is already enabled' }, 400);
  }

  // Generate new TOTP secret
  const secret = generateTOTPSecret();
  const email = workspace.email;

  // Generate otpauth:// URI for QR code
  const otpUri = `otpauth://totp/Hookwing:${email}?secret=${secret}&issuer=Hookwing`;

  // Store the secret temporarily (not enabled yet)
  await db.update(workspaces).set({ totpSecret: secret }).where(eq(workspaces.id, workspace.id));

  return c.json({
    secret,
    otpUri,
  });
});

// ============================================================================
// POST /v1/auth/2fa/verify - Verify and enable TOTP 2FA (authenticated)
// ============================================================================

const verifyTwoFactorSchema = z.object({
  code: z.string().length(6),
});

auth.post('/2fa/verify', authMiddleware, requireApiKeyScopes(['workspace:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = verifyTwoFactorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { code } = parsed.data;

  // Get the stored secret
  const storedSecret = workspace.totpSecret;
  if (!storedSecret) {
    return c.json({ error: '2FA not set up. Call /2fa/setup first.' }, 400);
  }

  // Verify the code
  if (!verifyTOTP(storedSecret, code)) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }

  // Enable 2FA
  await db.update(workspaces).set({ totpEnabled: 1 }).where(eq(workspaces.id, workspace.id));

  return c.json({ success: true });
});

// ============================================================================
// POST /v1/auth/2fa/disable - Disable TOTP 2FA (authenticated)
// ============================================================================

const disableTwoFactorSchema = z.object({
  code: z.string().length(6),
});

auth.post('/2fa/disable', authMiddleware, requireApiKeyScopes(['workspace:write']), async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = disableTwoFactorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { code } = parsed.data;

  // If not enabled, just return success
  if (!workspace.totpEnabled) {
    return c.json({ success: true });
  }

  // Get the stored secret
  const storedSecret = workspace.totpSecret;
  if (!storedSecret) {
    return c.json({ error: '2FA not configured' }, 400);
  }

  // Verify the code before disabling
  if (!verifyTOTP(storedSecret, code)) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }

  // Disable 2FA and clear secret
  await db
    .update(workspaces)
    .set({ totpEnabled: 0, totpSecret: null })
    .where(eq(workspaces.id, workspace.id));

  return c.json({ success: true });
});

// ============================================================================
// POST /v1/auth/2fa/validate - Validate TOTP code to complete login (unauthenticated)
// ============================================================================

const validateTwoFactorSchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().length(6),
});

auth.post('/2fa/validate', async (c) => {
  const body = await c.req.json();

  const parsed = validateTwoFactorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { tempToken, code } = parsed.data;

  // Validate temp token and extract workspace ID
  // The temp token is a simple encoding for this flow
  let workspaceId: string;
  try {
    // Temp token format: workspaceId:timestamp:signature
    const decoded = atob(tempToken);
    const [id, timestamp, signature] = decoded.split(':');
    if (!id || !timestamp || !signature) {
      return c.json({ error: 'Invalid temp token' }, 400);
    }

    // Verify signature (simple HMAC for temp token validation)
    const expectedSignature = createHmac('sha256', c.env?.TURNSTILE_SECRET_KEY ?? 'default')
      .update(`${id}:${timestamp}`)
      .digest('hex');
    if (signature !== expectedSignature) {
      return c.json({ error: 'Invalid temp token' }, 400);
    }

    // Check expiry (5 minutes)
    const now = Date.now();
    if (now - Number.parseInt(timestamp) > 300000) {
      return c.json({ error: 'Temp token expired' }, 400);
    }

    workspaceId = id;
  } catch {
    return c.json({ error: 'Invalid temp token' }, 400);
  }

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  // Get workspace and verify TOTP
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  if (!workspace.totpEnabled || !workspace.totpSecret) {
    return c.json({ error: '2FA not enabled for this workspace' }, 400);
  }

  // Verify the TOTP code
  if (!verifyTOTP(workspace.totpSecret, code)) {
    return c.json({ error: 'Invalid verification code' }, 401);
  }

  // Generate API key
  const keyData = await generateApiKey();
  const keyId = generateId('key');
  const now = Date.now();

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId: workspace.id,
    name: 'Dashboard Session',
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: null,
    isActive: 1,
    createdAt: now,
  });

  const tier = getTierBySlug(workspace.tierSlug);

  return c.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      email: workspace.email,
      tier,
      createdAt: workspace.createdAt,
    },
    apiKey: keyData.key,
  });
});

// ============================================================================
// PUT /v1/auth/2fa/enable-captcha - Enable CAPTCHA for workspace (authenticated)
// ============================================================================

const enableCaptchaSchema = z.object({
  enabled: z.boolean(),
});

auth.put(
  '/2fa/enable-captcha',
  authMiddleware,
  requireApiKeyScopes(['workspace:write']),
  async (c) => {
    const workspace = getWorkspace(c);
    const db = createDb(c.env.DB);
    const body = await c.req.json();

    const parsed = enableCaptchaSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
    }

    const { enabled } = parsed.data;

    await db
      .update(workspaces)
      .set({ captchaEnabled: enabled ? 1 : 0 })
      .where(eq(workspaces.id, workspace.id));

    return c.json({ success: true, captchaEnabled: enabled });
  },
);

export default auth;
