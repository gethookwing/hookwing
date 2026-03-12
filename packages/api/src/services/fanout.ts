/**
 * Fan-out service — distributes events to multiple endpoints
 */

import { type Endpoint, deliveries, endpoints, generateId } from '@hookwing/shared';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db';

export interface FanoutResult {
  eventId: string;
  deliveries: Array<{ deliveryId: string; endpointId: string; status: string }>;
}

/**
 * Check if an endpoint should receive an event based on its eventType filter
 */
function shouldEndpointReceiveEvent(endpoint: Endpoint, eventType: string): boolean {
  // If eventTypes is null/empty, endpoint receives all events (wildcard)
  if (!endpoint.eventTypes) {
    return true;
  }

  try {
    const allowedTypes = JSON.parse(endpoint.eventTypes) as string[];
    return allowedTypes.includes(eventType);
  } catch {
    // Invalid JSON, treat as wildcard
    return true;
  }
}

/**
 * Fan-out an event to all eligible endpoints in the workspace
 *
 * The receiving endpoint always gets a delivery regardless of its event type filter.
 * Other endpoints only get the event if:
 * - They have fanoutEnabled = 1
 * - They match the event type filter (null/empty = wildcard)
 *
 * For replay (when receivingEndpointId is undefined), all endpoints with fanoutEnabled=1
 * and matching event type filter will receive the event.
 *
 * @param db - Drizzle database instance
 * @param queue - Optional Cloudflare Queue for async delivery
 * @param event - Event details (id, workspaceId, eventType)
 * @param receivingEndpointId - The endpoint that originally received the webhook (optional for replay)
 * @returns FanoutResult with delivery details
 */
export async function fanoutEvent(
  db: Database,
  queue: Queue | undefined,
  event: { id: string; workspaceId: string; eventType: string },
  receivingEndpointId?: string,
): Promise<FanoutResult> {
  const { id: eventId, workspaceId, eventType } = event;

  // Get all active endpoints in the workspace with fanout enabled
  const allEndpoints = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.workspaceId, workspaceId), eq(endpoints.isActive, 1)))
    .then((rows) => rows);

  const result: FanoutResult = {
    eventId,
    deliveries: [],
  };

  const now = Date.now();

  for (const endpoint of allEndpoints) {
    // For non-replay: receiving endpoint always gets delivery, others need fanoutEnabled
    // For replay (no receivingEndpointId): all endpoints need fanoutEnabled
    const isReceivingEndpoint = receivingEndpointId && endpoint.id === receivingEndpointId;
    const isReplay = !receivingEndpointId;

    if (!isReceivingEndpoint && !endpoint.fanoutEnabled) {
      continue;
    }

    // Check event type filter
    if (!shouldEndpointReceiveEvent(endpoint, eventType)) {
      // Receiving endpoint always gets delivery regardless of filter
      if (!isReceivingEndpoint && !isReplay) {
        continue;
      }
    }

    // Create delivery record
    const deliveryId = generateId('dlv');
    await db.insert(deliveries).values({
      id: deliveryId,
      eventId,
      endpointId: endpoint.id,
      workspaceId,
      attemptNumber: 1,
      status: 'pending',
      createdAt: now,
    });

    // Enqueue for delivery
    if (queue) {
      await queue.send({
        deliveryId,
        eventId,
        endpointId: endpoint.id,
        workspaceId,
        attempt: 1,
      });
    }

    result.deliveries.push({
      deliveryId,
      endpointId: endpoint.id,
      status: 'pending',
    });
  }

  // If receiving endpoint was not found in active endpoints, add it directly
  // (edge case: receiving endpoint might be inactive but we still want to deliver)
  if (receivingEndpointId) {
    const hasReceivingEndpoint = allEndpoints.some((ep) => ep.id === receivingEndpointId);
    if (!hasReceivingEndpoint) {
      const deliveryId = generateId('dlv');
      await db.insert(deliveries).values({
        id: deliveryId,
        eventId,
        endpointId: receivingEndpointId,
        workspaceId,
        attemptNumber: 1,
        status: 'pending',
        createdAt: now,
      });

      if (queue) {
        await queue.send({
          deliveryId,
          eventId,
          endpointId: receivingEndpointId,
          workspaceId,
          attempt: 1,
        });
      }

      result.deliveries.push({
        deliveryId,
        endpointId: receivingEndpointId,
        status: 'pending',
      });
    }
  }

  return result;
}
