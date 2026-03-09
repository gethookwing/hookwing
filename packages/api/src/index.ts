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

app.notFound((c) => {
  return c.json({ error: 'Not found', status: 404 }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', status: 500 }, 500);
});

export default app;
