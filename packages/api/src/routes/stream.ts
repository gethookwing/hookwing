import { events } from '@hookwing/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';

const streamRoutes = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { workspace: import('@hookwing/shared').Workspace; apiKey: unknown };
}>();

streamRoutes.use('/*', authMiddleware);

// ============================================================================
// GET /v1/stream — Server-Sent Events endpoint for real-time event streaming
// ============================================================================

streamRoutes.get('/', async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  let lastEventTimestamp = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string, event?: string) => {
        if (event) {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
        }
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send initial connection event
      send(JSON.stringify({ connected: true, workspaceId: workspace.id }), 'connected');

      // Poll for new events every 2 seconds
      const interval = setInterval(async () => {
        try {
          const newEvents = await db
            .select()
            .from(events)
            .where(
              and(eq(events.workspaceId, workspace.id), gt(events.receivedAt, lastEventTimestamp)),
            )
            .orderBy(desc(events.receivedAt))
            .limit(50);

          for (const evt of newEvents) {
            send(
              JSON.stringify({
                id: evt.id,
                eventType: evt.eventType,
                status: evt.status,
                receivedAt: evt.receivedAt,
              }),
              'event',
            );
            if (evt.receivedAt > lastEventTimestamp) {
              lastEventTimestamp = evt.receivedAt;
            }
          }
        } catch {
          // Silently continue on query errors
        }
      }, 2000);

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(interval);
          clearInterval(keepAlive);
        }
      }, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

export default streamRoutes;
