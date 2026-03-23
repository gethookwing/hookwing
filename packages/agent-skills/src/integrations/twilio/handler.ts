/**
 * Twilio webhook handler with HMAC-SHA1 signature verification.
 * @see https://www.twilio.com/docs/usage/webhooks
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EventHandler, HandlerFactory, WebhookHandlerConfig } from '../../types.js';
import type { TwilioEvent, TwilioEventType } from './types.js';

/**
 * Verify Twilio webhook signature from X-Twilio-Signature header.
 * Twilio uses HMAC-SHA1 of URL + sorted POST params, base64 encoded.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): boolean {
  // Sort params alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.reduce((s, key) => s + key + params[key], '');

  const computed = createHmac('sha1', authToken).update(data).digest('base64');

  // Use timing-safe comparison to prevent timing attacks
  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);

  // Twilio signature length check
  if (signatureBuf.length < 20 || computedBuf.length < 20) {
    return false;
  }

  return timingSafeEqual(computedBuf, signatureBuf);
}

/**
 * Create a Twilio webhook handler factory.
 */
export function createTwilioHandler(config: WebhookHandlerConfig): HandlerFactory<TwilioEvent> {
  const { signingSecret } = config;

  return {
    /**
     * Verify and parse the webhook payload.
     * Note: Twilio signature verification requires the full URL (including query params).
     */
    verify(payload: string, signatureHeader: string, ...extra: unknown[]): TwilioEvent {
      // Extra args can include URL if needed
      const url = typeof extra[0] === 'string' ? extra[0] : 'https://example.com/webhook';
      const params = typeof extra[1] === 'object' ? (extra[1] as Record<string, string>) : {};

      if (!verifyTwilioSignature(url, params, signatureHeader, signingSecret)) {
        throw new Error('Twilio signature verification failed');
      }

      const data = JSON.parse(payload);
      const eventType = data.MessageStatus || data.CallStatus || data.EventType || 'unknown';

      return {
        id: String(data.MessageSid || data.CallSid || data.Sid || data.id || ''),
        type: eventType,
        data,
        created: data.Timestamp ? new Date(data.Timestamp).getTime() : undefined,
      } as TwilioEvent;
    },

    /**
     * Route the event to the appropriate handler based on event type.
     */
    async handle(
      event: TwilioEvent,
      handlers: Partial<Record<string, EventHandler<TwilioEvent>>>,
    ): Promise<void> {
      const handler = handlers[event.type];
      if (handler) {
        await handler(event);
      }
    },
  };
}

export type { TwilioEvent, TwilioEventType } from './types.js';
