/**
 * Hookwing API - Webhook Infrastructure
 *
 * Endpoints:
 * - POST /v1/webhooks - Create a new webhook delivery
 * - GET /v1/webhooks/:id - Get webhook status
 * - POST /v1/auth/signup - Create new account
 * - POST /v1/auth/login - Login
 * - POST /v1/auth/logout - Logout
 * - POST /v1/auth/password-reset - Request password reset
 * - GET /v1/auth/me - Get current user
 * - GET /health - Health check
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

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
 * Webhook routes
 */
app.post('/v1/webhooks', async (c) => {
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
 * Get webhook by ID
 */
app.get('/v1/webhooks/:id', async (c) => {
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
