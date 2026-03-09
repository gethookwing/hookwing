import { DEFAULT_TIERS, getTierBySlug } from '@hookwing/shared';
import { Hono } from 'hono';

// Bindings will be extended as D1, Queues, KV are configured
// type Bindings = {
//   DB: D1Database;
//   DELIVERY_QUEUE: Queue;
// };

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
  });
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

app.notFound((c) => {
  return c.json({ error: 'Not found', status: 404 }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', status: 500 }, 500);
});

export default app;
