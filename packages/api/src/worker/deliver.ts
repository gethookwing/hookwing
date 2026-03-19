import {
  events,
  deadLetterItems,
  deliveries,
  endpoints,
  generateWebhookSignature,
  getTierBySlug,
  isFeatureEnabled,
  workspaces,
} from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import {
  trackDeliveryAttempted,
  trackDeliveryFailed,
  trackDeliverySucceeded,
} from '../services/analytics';
import { calculateBackoff, shouldRetry } from './retry';

export interface DeliveryMessage {
  deliveryId: string;
  eventId: string;
  endpointId: string;
  workspaceId: string;
  attempt: number;
}

interface Env {
  DB?: D1Database;
  DELIVERY_QUEUE?: Queue;
}

export interface EnvWithBindings extends Env {
  DB: D1Database;
  DELIVERY_QUEUE: Queue;
}

/**
 * Process a single delivery message
 * @param message - The delivery message to process
 * @param env - The environment bindings
 */
export async function processDelivery(message: DeliveryMessage, env: Env): Promise<void> {
  const { deliveryId, eventId, endpointId, workspaceId, attempt } = message;

  // Ensure we have required bindings
  if (!env.DB) {
    console.error('DB binding not available');
    return;
  }

  const db = createDb(env.DB);

  // a. Fetch delivery record from DB
  const delivery = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)
    .then((rows) => rows[0]);

  // b. If delivery is already 'success' or 'failed', skip it
  if (!delivery || delivery.status === 'success' || delivery.status === 'failed') {
    console.log(`Delivery ${deliveryId} already completed or skipped, status: ${delivery?.status}`);
    return;
  }

  // c. Fetch event record (payload, headers)
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    console.error(`Event ${eventId} not found for delivery ${deliveryId}`);
    await db
      .update(deliveries)
      .set({ status: 'failed', errorMessage: 'Event not found' })
      .where(eq(deliveries.id, deliveryId));
    return;
  }

  // d. Fetch endpoint record (url, secret, isActive)
  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)
    .then((rows) => rows[0]);

  // e. If endpoint inactive or not found, mark delivery as 'failed', no retry
  if (!endpoint || !endpoint.isActive) {
    console.log(`Endpoint ${endpointId} inactive or not found, marking delivery as failed`);
    await db
      .update(deliveries)
      .set({ status: 'failed', errorMessage: 'Endpoint inactive or not found' })
      .where(eq(deliveries.id, deliveryId));
    return;
  }

  // f. Sign the payload
  const signature = await generateWebhookSignature(event.payload, endpoint.secret);

  // g. POST to endpoint.url
  const startTime = Date.now();
  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    // Build request headers - start with Hookwing headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hookwing-Signature': signature,
      'X-Hookwing-Event': event.eventType,
      'X-Hookwing-Delivery-Id': deliveryId,
      'X-Hookwing-Attempt': attempt.toString(),
    };

    // Inject custom headers from endpoint if present
    if (endpoint.customHeaders) {
      try {
        const customHeaders = JSON.parse(endpoint.customHeaders) as Record<string, string>;
        for (const [name, value] of Object.entries(customHeaders)) {
          requestHeaders[name] = value;
        }
      } catch (parseErr) {
        console.error(`Failed to parse custom headers for endpoint ${endpointId}:`, parseErr);
      }
    }

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: requestHeaders,
      body: event.payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    responseStatus = response.status;
    const bodyText = await response.text();
    // Truncate response body to first 1KB
    responseBody = bodyText.slice(0, 1024);
  } catch (err) {
    const error = err as Error;
    errorMessage = error.message || 'Network error';
    console.error(`Delivery ${deliveryId} failed:`, errorMessage);
  }

  const durationMs = Date.now() - startTime;

  // h. Record response
  // i. If response 2xx: mark delivery as 'success', update event status to 'completed'
  if (responseStatus && responseStatus >= 200 && responseStatus < 300) {
    const now = Date.now();
    await db
      .update(deliveries)
      .set({
        status: 'success',
        responseStatusCode: responseStatus,
        responseBody,
        durationMs,
        deliveredAt: now,
      })
      .where(eq(deliveries.id, deliveryId));

    // Update event status to completed
    await db
      .update(events)
      .set({ status: 'completed', processedAt: now })
      .where(eq(events.id, eventId));

    console.log(`Delivery ${deliveryId} succeeded on attempt ${attempt}`);
    trackDeliveryAttempted(db, workspaceId).catch(() => {});
    trackDeliverySucceeded(db, workspaceId).catch(() => {});
    return;
  }

  // j. If response non-2xx or network error
  // Get workspace tier, check max_retry_attempts
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    console.error(`Workspace ${workspaceId} not found for delivery ${deliveryId}`);
    await db
      .update(deliveries)
      .set({ status: 'failed', errorMessage: 'Workspace not found' })
      .where(eq(deliveries.id, deliveryId));
    return;
  }

  const tier = getTierBySlug(workspace.tierSlug);
  const maxAttempts = tier?.limits.max_retry_attempts ?? 3;

  if (shouldRetry(attempt, maxAttempts)) {
    // Update delivery status='retrying', next_retry_at = exponential backoff
    const nextRetryAt = Date.now() + calculateBackoff(attempt);
    await db
      .update(deliveries)
      .set({
        status: 'retrying',
        responseStatusCode: responseStatus,
        responseBody,
        errorMessage,
        durationMs,
        nextRetryAt,
        attemptNumber: attempt + 1,
      })
      .where(eq(deliveries.id, deliveryId));

    // Schedule retry via queue.send()
    if (env.DELIVERY_QUEUE) {
      await env.DELIVERY_QUEUE.send({
        deliveryId,
        eventId,
        endpointId,
        workspaceId,
        attempt: attempt + 1,
      });
    }

    console.log(
      `Delivery ${deliveryId} scheduled for retry at ${new Date(nextRetryAt).toISOString()}`,
    );
  } else {
    // If attempt >= max_retry_attempts: mark delivery as 'failed'
    await db
      .update(deliveries)
      .set({
        status: 'failed',
        responseStatusCode: responseStatus,
        responseBody,
        errorMessage,
        durationMs,
      })
      .where(eq(deliveries.id, deliveryId));

    // Update event status to failed
    await db
      .update(events)
      .set({ status: 'failed', processedAt: Date.now() })
      .where(eq(events.id, eventId));

    console.log(`Delivery ${deliveryId} failed after ${attempt} attempts (max: ${maxAttempts})`);
    trackDeliveryAttempted(db, workspaceId).catch(() => {});
    trackDeliveryFailed(db, workspaceId).catch(() => {});

    // Insert into Dead Letter Queue if workspace has DLQ enabled
    const tier = getTierBySlug(workspace.tierSlug);
    if (tier && isFeatureEnabled(tier, 'dead_letter_queue')) {
      const now = Date.now();
      const { nanoid } = await import('nanoid');
      await db.insert(deadLetterItems).values({
        id: `dlq_${nanoid(24)}`,
        workspaceId,
        eventId,
        endpointId,
        deliveryId,
        errorMessage: errorMessage || 'Delivery failed after all retry attempts',
        attempts: attempt,
        createdAt: now,
        status: 'pending',
      });
      console.log(`Delivery ${deliveryId} added to dead letter queue`);
    }
  }
}

/**
 * Queue batch handler for Cloudflare Queues
 */
export default {
  queue: async (batch: MessageBatch<DeliveryMessage>, env: Env): Promise<void> => {
    for (const message of batch.messages) {
      try {
        await processDelivery(message.body, env);
      } catch (err) {
        const error = err as Error;
        console.error(`Error processing message ${message.id}:`, error);
        // Don't rethrow - we want one failure to not kill the whole batch
      }
    }
  },
};
