import { DEFAULT_TIERS, getTierBySlug } from '@hookwing/shared';
import { Hono } from 'hono';
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/deliveries';
import endpointRoutes from './routes/endpoints';
import eventRoutes from './routes/events';
import ingestRoutes from './routes/ingest';
import playgroundRoutes from './routes/playground';

type Bindings = {
  DB?: D1Database;
  DELIVERY_QUEUE?: Queue;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', async (c) => {
  const health: { status: string; version: string; timestamp: string; db?: string } = {
    status: 'ok',
    version: '0.0.1',
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

// Mount auth routes at /v1/auth/*
app.route('/v1/auth', authRoutes);

// Mount endpoint routes at /v1/endpoints/*
app.route('/v1/endpoints', endpointRoutes);

// Mount ingest routes at /v1/ingest/* (public webhook endpoint)
app.route('/v1/ingest', ingestRoutes);

// Mount event routes at /v1/events/* (authenticated)
app.route('/v1/events', eventRoutes);

// Mount delivery routes at /v1/deliveries/* (authenticated)
app.route('/v1/deliveries', deliveryRoutes);

// Mount playground routes at /v1/playground/* (no auth required)
app.route('/v1/playground', playgroundRoutes);

app.notFound((c) => {
  return c.json({ error: 'Not found', status: 404 }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', status: 500 }, 500);
});

export default app;
