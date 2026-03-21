import { DEFAULT_TIERS, getTierBySlug } from '@hookwing/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import customDomainRoutes from './routes/custom-domains';
import deadLetterRoutes from './routes/dead-letter';
import deliveryRoutes from './routes/deliveries';
import endpointRoutes from './routes/endpoints';
import eventRoutes from './routes/events';
import feedbackRoutes from './routes/feedback';
import ingestRoutes from './routes/ingest';
import playgroundRoutes from './routes/playground';

// Pre-built OpenAPI spec (YAML → JSON at build time, CF Workers has no filesystem)
import openapiSpec from './generated/openapi-spec.json';

type Bindings = {
  DB?: D1Database;
  DELIVERY_QUEUE?: Queue;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow website origins to call the API
app.use(
  '*',
  cors({
    origin: [
      'https://dev.hookwing.com',
      'https://staging.hookwing.com',
      'https://hookwing.com',
      'https://www.hookwing.com',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Playground-Secret'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  }),
);

app.get('/health', async (c) => {
  const health: { status: string; version: string; timestamp: string; db?: string } = {
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };

  // Try to check DB connection if available
  if (c.env?.DB) {
    try {
      await c.env.DB.exec('SELECT 1');
      health.db = 'ok';
    } catch {
      health.db = 'error';
    }
  } else {
    health.db = 'not configured';
  }

  return c.json(health);
});

app.get('/tiers', (c) => {
  return c.json(DEFAULT_TIERS);
});

app.get('/tiers/:slug', (c) => {
  const slug = c.req.param('slug');
  const tier = getTierBySlug(slug);

  if (!tier) {
    return c.json({ error: 'Tier not found', slug }, 404);
  }

  return c.json(tier);
});

// Public endpoint: /openapi.json — returns OpenAPI spec as JSON
app.get('/openapi.json', (c) => {
  return c.json(openapiSpec);
});

// Public endpoint: /api/pricing — returns tier metadata
app.get('/api/pricing', (c) => {
  const tiers = DEFAULT_TIERS.map((t) => ({
    name: t.name,
    slug: t.slug,
    price: t.price_monthly_usd,
    features: t.features,
    limits: t.limits,
  }));
  return c.json({ tiers, currency: 'USD', billingPeriod: 'monthly' });
});

// Public endpoint: /api/status — returns structured status JSON
app.get('/api/status', async (c) => {
  const status: {
    status: string;
    version: string;
    timestamp: string;
    services: { api: string; db: string };
  } = {
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      db: 'not configured',
    },
  };

  // Try to check DB connection if available
  if (c.env?.DB) {
    try {
      await c.env.DB.exec('SELECT 1');
      status.services.db = 'ok';
    } catch {
      status.services.db = 'error';
    }
  }

  return c.json(status);
});

// Mount auth routes at /v1/auth/*
app.route('/v1/auth', authRoutes);

// Mount endpoint routes at /v1/endpoints/*
app.route('/v1/endpoints', endpointRoutes);

// Mount ingest routes at /v1/ingest/* (public webhook endpoint)
app.route('/v1/ingest', ingestRoutes);

// Mount event routes at /v1/events/* (authenticated)
app.route('/v1/events', eventRoutes);
app.route('/v1/analytics', analyticsRoutes);

// Mount delivery routes at /v1/deliveries/* (authenticated)
app.route('/v1/deliveries', deliveryRoutes);

// Mount dead letter routes at /v1/dead-letter/* (authenticated)
app.route('/v1/dead-letter', deadLetterRoutes);

// Mount custom domain routes at /v1/domains/* (authenticated)
app.route('/v1/domains', customDomainRoutes);

// Mount feedback routes at /v1/feedback/* (POST is public, GET/PATCH require auth)
app.route('/v1/feedback', feedbackRoutes);

// Mount playground routes at /v1/playground/* (no auth required)
app.route('/v1/playground', playgroundRoutes);

app.notFound((c) => {
  return c.json({ error: 'Not found', status: 404 }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', status: 500 }, 500);
});

// Export Hono app for tests (app.request())
export { app };

// Worker export with fetch + queue handlers for Cloudflare Workers runtime
import type { DeliveryMessage } from './worker/deliver';
import { processDelivery } from './worker/deliver';

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<DeliveryMessage>, env: Bindings): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processDelivery(message.body, env);
      } catch (err) {
        console.error(`Error processing delivery ${message.id}:`, err);
      }
    }
  },
};
