/**
 * Analytics service — tracks usage counts in the usage_daily table.
 * Increments counters on ingest, delivery success/failure.
 */

import { generateId, usageDaily } from '@hookwing/shared';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function upsertDaily(
  db: Database,
  workspaceId: string,
  date: string,
  increments: {
    eventsReceived?: number;
    deliveriesAttempted?: number;
    deliveriesSucceeded?: number;
    deliveriesFailed?: number;
  },
): Promise<void> {
  const existing = await db
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.workspaceId, workspaceId), eq(usageDaily.date, date)))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    await db
      .update(usageDaily)
      .set({
        eventsReceived: existing.eventsReceived + (increments.eventsReceived ?? 0),
        deliveriesAttempted: existing.deliveriesAttempted + (increments.deliveriesAttempted ?? 0),
        deliveriesSucceeded: existing.deliveriesSucceeded + (increments.deliveriesSucceeded ?? 0),
        deliveriesFailed: existing.deliveriesFailed + (increments.deliveriesFailed ?? 0),
      })
      .where(and(eq(usageDaily.workspaceId, workspaceId), eq(usageDaily.date, date)));
  } else {
    await db.insert(usageDaily).values({
      id: generateId('usg'),
      workspaceId,
      date,
      eventsReceived: increments.eventsReceived ?? 0,
      deliveriesAttempted: increments.deliveriesAttempted ?? 0,
      deliveriesSucceeded: increments.deliveriesSucceeded ?? 0,
      deliveriesFailed: increments.deliveriesFailed ?? 0,
    });
  }
}

export async function trackEventReceived(db: Database, workspaceId: string): Promise<void> {
  await upsertDaily(db, workspaceId, todayDate(), { eventsReceived: 1 });
}

export async function trackDeliveryAttempted(db: Database, workspaceId: string): Promise<void> {
  await upsertDaily(db, workspaceId, todayDate(), { deliveriesAttempted: 1 });
}

export async function trackDeliverySucceeded(db: Database, workspaceId: string): Promise<void> {
  await upsertDaily(db, workspaceId, todayDate(), { deliveriesSucceeded: 1 });
}

export async function trackDeliveryFailed(db: Database, workspaceId: string): Promise<void> {
  await upsertDaily(db, workspaceId, todayDate(), { deliveriesFailed: 1 });
}
