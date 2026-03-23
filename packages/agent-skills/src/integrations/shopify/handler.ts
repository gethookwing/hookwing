/**
 * Shopify webhook handler with HMAC-SHA256 signature verification.
 * @see https://shopify.dev/docs/api/webhooks
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  EventHandler,
  HandlerFactory,
  WebhookEvent,
  WebhookHandlerConfig,
} from '../../types.js';
import type { ShopifyEvent } from './types.js';

/**
 * Verify Shopify webhook signature from X-Shopify-Hmac-SHA256 header.
 * Shopify uses base64-encoded HMAC-SHA256.
 */
export function verifyShopifySignature(
  payload: string,
  hmacHeader: string,
  secret: string,
): Record<string, unknown> {
  const computed = createHmac('sha256', secret).update(payload, 'utf-8').digest('base64');

  // Use timing-safe comparison to prevent timing attacks
  const computedBuf = Buffer.from(computed, 'base64');
  const headerBuf = Buffer.from(hmacHeader, 'base64');

  if (computedBuf.length !== headerBuf.length || !timingSafeEqual(computedBuf, headerBuf)) {
    throw new Error('Shopify signature verification failed');
  }

  return JSON.parse(payload);
}

/**
 * Create a Shopify webhook handler factory.
 */
export function createShopifyHandler(config: WebhookHandlerConfig): HandlerFactory<ShopifyEvent> {
  const { signingSecret } = config;

  return {
    /**
     * Verify and parse the webhook payload.
     */
    verify(payload: string, signatureHeader: string): ShopifyEvent {
      const data = verifyShopifySignature(payload, signatureHeader, signingSecret);
      return {
        id: String(data.id ?? ''),
        type: String(data.topic ?? data.event_name ?? 'unknown'),
        data,
        created: data.created_at ? new Date(data.created_at as string).getTime() : undefined,
      } as ShopifyEvent;
    },

    /**
     * Route the event to the appropriate handler based on event type.
     */
    async handle(
      event: ShopifyEvent,
      handlers: Partial<Record<string, EventHandler<ShopifyEvent>>>,
    ): Promise<void> {
      const handler = handlers[event.type];
      if (handler) {
        await handler(event);
      }
    },
  };
}

export type { ShopifyEvent } from './types.js';
