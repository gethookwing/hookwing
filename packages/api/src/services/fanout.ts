/**
 * Fan-out service — distributes events to multiple endpoints
 */

import { type Endpoint, deliveries, endpoints, generateId, routingRules } from '@hookwing/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db';
import { type Condition, evaluateConditions } from './rule-engine';

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
 * @param priority - Priority level for delivery (higher = more priority, Warbird+ get 1)
 * @returns FanoutResult with delivery details
 */
export async function fanoutEvent(
  db: Database,
  queue: Queue | undefined,
  event: { id: string; workspaceId: string; eventType: string },
  receivingEndpointId?: string,
  priority = 0,
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
      priority,
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
        priority,
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
        priority,
        createdAt: now,
      });

      if (queue) {
        await queue.send({
          deliveryId,
          eventId,
          endpointId: receivingEndpointId,
          workspaceId,
          attempt: 1,
          priority,
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

/**
 * Process routing rules for an event and create additional deliveries
 *
 * This is additive to existing event type matching — both systems run.
 * Rules are evaluated in priority order, matching rules deliver to specified endpoints.
 *
 * @param db - Drizzle database instance
 * @param queue - Optional Cloudflare Queue for async delivery
 * @param event - Event details (id, workspaceId, eventType, payload, headers)
 * @param priority - Priority level for delivery
 * @returns Array of additional deliveries created by routing rules
 */
export async function processRoutingRules(
  db: Database,
  queue: Queue | undefined,
  event: {
    id: string;
    workspaceId: string;
    eventType: string;
    payload: unknown;
    headers: Record<string, string>;
  },
  priority = 0,
): Promise<Array<{ deliveryId: string; endpointId: string; status: string; ruleId: string }>> {
  // Load all enabled routing rules for the workspace, ordered by priority
  const rules = await db
    .select()
    .from(routingRules)
    .where(and(eq(routingRules.workspaceId, event.workspaceId), eq(routingRules.enabled, 1)))
    .orderBy(asc(routingRules.priority));

  if (rules.length === 0) {
    return [];
  }

  const eventContext = {
    type: event.eventType,
    payload: event.payload,
    headers: event.headers,
  };

  const additionalDeliveries: Array<{
    deliveryId: string;
    endpointId: string;
    status: string;
    ruleId: string;
  }> = [];
  const now = Date.now();

  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions) as Condition[];

    const matched = evaluateConditions(conditions, eventContext);
    if (!matched) {
      continue;
    }

    // If action is 'drop', skip delivery but continue evaluating other rules
    if (rule.actionType === 'drop') {
      continue;
    }

    // If action is 'deliver' but no endpoint specified, skip
    if (!rule.actionEndpointId) {
      continue;
    }

    // Verify the endpoint exists and is active
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, rule.actionEndpointId), eq(endpoints.isActive, 1)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!endpoint) {
      continue;
    }

    // Note: Transform support will be added in future when delivery worker supports transforms
    // For now, routing rules deliver the original event payload

    // Create delivery record
    const deliveryId = generateId('dlv');
    await db.insert(deliveries).values({
      id: deliveryId,
      eventId: event.id,
      endpointId: rule.actionEndpointId,
      workspaceId: event.workspaceId,
      attemptNumber: 1,
      status: 'pending',
      priority,
      createdAt: now,
    });

    // Enqueue for delivery
    if (queue) {
      await queue.send({
        deliveryId,
        eventId: event.id,
        endpointId: rule.actionEndpointId,
        workspaceId: event.workspaceId,
        attempt: 1,
        priority,
      });
    }

    additionalDeliveries.push({
      deliveryId,
      endpointId: rule.actionEndpointId,
      status: 'pending',
      ruleId: rule.id,
    });
  }

  return additionalDeliveries;
}
