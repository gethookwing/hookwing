/**
 * Hookwing API - Webhook Infrastructure
 * 
 * A simple, developer-friendly webhook delivery service.
 * 
 * Endpoints:
 * - POST /webhooks - Create a new webhook delivery
 * - GET /webhooks/:id - Get webhook status
 * - GET /health - Health check
 */

import { Hono } from 'hono';

const app = new Hono();

// Environment variables
type Env = {
  ENVIRONMENT: string;
  DB: D1Database;
};

const API_VERSION = 'v1';

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    version: API_VERSION,
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Hookwing API',
    version: API_VERSION,
    docs: 'https://hookwing.com/docs',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Create webhook delivery
app.post(`/${API_VERSION}/webhooks`, async (c) => {
  const { destination, event, payload } = await c.req.json();
  
  if (!destination) {
    return c.json({ error: 'destination is required' }, 400);
  }
  
  const webhook = {
    id: `wh_${crypto.randomUUID()}`,
    destination,
    event: event || 'webhook',
    payload: payload || {},
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  
  // In production, this would:
  // 1. Store in D1 database
  // 2. Add to queue for delivery
  // 3. Process delivery asynchronously
  
  return c.json(webhook, 201);
});

// Get webhook status
app.get(`/${API_VERSION}/webhooks/:id`, (c) => {
  const id = c.req.param('id');
  
  // In production, this would fetch from D1
  return c.json({
    id,
    status: 'delivered',
    attempts: [
      { status: 'delivered', code: 200, timestamp: new Date().toISOString() }
    ]
  });
});

// Not found handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
