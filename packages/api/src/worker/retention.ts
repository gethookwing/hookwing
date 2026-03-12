import { events, deliveries, getTierBySlug, workspaces } from '@hookwing/shared';
import { and, eq, lt } from 'drizzle-orm';
import { createDb } from '../db';

interface RetentionEnv {
  DB: D1Database;
}

/**
 * Clean up expired events and deliveries based on each workspace's tier retention limit.
 * Designed to be called from a Cron Trigger (scheduled()).
 */
export async function cleanupExpiredEvents(env: RetentionEnv): Promise<{ deleted: number }> {
  const db = createDb(env.DB);

  // Get all workspaces with their tiers
  const allWorkspaces = await db.select().from(workspaces);

  let totalDeleted = 0;

  for (const workspace of allWorkspaces) {
    const tier = getTierBySlug(workspace.tierSlug);
    const retentionDays = tier?.limits.retention_days ?? 7;
    const cutoffTs = Date.now() - retentionDays * 86400000;

    // Delete deliveries for expired events first (foreign key)
    const expiredEventIds = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.workspaceId, workspace.id), lt(events.receivedAt, cutoffTs)));

    if (expiredEventIds.length === 0) {
      continue;
    }

    for (const { id: eventId } of expiredEventIds) {
      await db.delete(deliveries).where(eq(deliveries.eventId, eventId));
    }

    // Delete the expired events
    await db
      .delete(events)
      .where(and(eq(events.workspaceId, workspace.id), lt(events.receivedAt, cutoffTs)));

    totalDeleted += expiredEventIds.length;
  }

  return { deleted: totalDeleted };
}
