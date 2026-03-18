/**
 * Hookwing API - Webhook Infrastructure
 *
 * Endpoints:
 * - POST /v1/webhooks - Create a new webhook delivery (requires write scope)
 * - GET /v1/webhooks/:id - Get webhook status (requires read scope)
 * - POST /v1/auth/signup - Create new account
 * - POST /v1/auth/login - Login
 * - POST /v1/auth/logout - Logout
 * - POST /v1/auth/password-reset - Request password reset
 * - GET /v1/auth/me - Get current user
 * - GET /v1/auth/keys - List API keys (requires admin scope)
 * - POST /v1/auth/keys - Create API key (requires admin scope)
 * - DELETE /v1/auth/keys/:id - Revoke API key (requires admin scope)
 * - GET /health - Health check
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateApiKey, hasScope, API_KEY_SCOPES, type ApiKey, type ApiKeyScope } from './lib/auth';
import authRoutes from './routes/auth';
import type { Env, Variables } from './env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
}));

/**
 * Health check
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: 'v1',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

/**
 * Root endpoint
 */
app.get('/', (c) => {
  return c.json({
    name: 'Hookwing API',
    version: 'v1',
    docs: 'https://hookwing.com/docs'
  });
});

/**
 * Auth routes (rate limited)
 */
app.route('/v1/auth', authRoutes);

/**
 * API Key authentication middleware for webhook routes
 * Validates API key and enforces scope-based access
 */
app.use('/v1/webhooks/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (apiKey) {
    const db = c.env.DB;
    const result = await validateApiKey(db, apiKey);

    if (result.valid && result.key && result.userId) {
      c.set('apiKey', result.key);
      c.set('userId', result.userId);
    }
  }

  await next();
});

/**
 * Scope enforcement middleware for webhook routes
 */
function requireScope(...requiredScopes: ApiKeyScope[]) {
  return async (c: any, next: () => Promise<void>) => {
    const apiKey = c.get('apiKey') as ApiKey | undefined;

    // If no API key, require session auth (handled by route)
    if (!apiKey) {
      return c.json({ error: 'API key required' }, 401);
    }

    // Check if API key has required scope
    if (!hasScope(apiKey, requiredScopes)) {
      return c.json({
        error: `Insufficient permissions: requires ${requiredScopes.join(' or ')} scope`
      }, 403);
    }

    await next();
  };
}

/**
 * Webhook routes
 */
app.post('/v1/webhooks', requireScope(API_KEY_SCOPES.WRITE), async (c) => {
  try {
    const body = await c.req.json();
    const { destination, event, payload } = body;

    if (!destination) {
      return c.json({ error: 'destination is required' }, 400);
    }

    const webhook = {
      id: 'wh_' + crypto.randomUUID(),
      destination,
      event: event || 'webhook',
      payload: payload || {},
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Store webhook in D1 (future: add database)
    // For now, just return the webhook

    return c.json(webhook, 201);
  } catch (e) {
    console.error('Webhook creation error:', e);
    return c.json({ error: 'Invalid JSON' }, 400);
  }
});

/**
 * Get webhook by ID (requires read scope)
 */
app.get('/v1/webhooks/:id', requireScope(API_KEY_SCOPES.READ), async (c) => {
  const id = c.req.param('id');

  return c.json({
    id,
    status: 'delivered',
    attempts: [
      { status: 'delivered', code: 200, timestamp: new Date().toISOString() }
    ]
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

/**
 * Error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
