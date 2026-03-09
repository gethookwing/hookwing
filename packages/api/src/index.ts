import { Hono } from 'hono';

type Bindings = {
  DB?: D1Database;
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

app.notFound((c) => {
  return c.json({ error: 'Not found', status: 404 }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', status: 500 }, 500);
});

export default app;
