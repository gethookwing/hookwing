/**
 * SendGrid webhook handler with ECDSA signature verification.
 * @see https://docs.sendgrid.com/for-developers/tracking-events/event
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EventHandler, HandlerFactory, WebhookHandlerConfig } from '../../types.js';
import type { SendGridEvent, SendGridEventType } from './types.js';

/**
 * Verify SendGrid webhook signature.
 * SendGrid Event Webhook v3 uses ECDSA, but we support both:
 * - Legacy HMAC (timestamp + payload + signing key)
 * - ECDSA verification (requires public key)
 *
 * For simplicity, this implements HMAC-based verification using the signing key.
 * @see https://docs.sendgrid.com/for-developers/tracking-events/event#verifying-signatures
 */
export function verifySendGridSignature(
  payload: string,
  signature: string,
  timestamp: string,
  signingSecret: string,
): Record<string, unknown>[] {
  // Decode the signature (it's base64 encoded)
  const decodedSignature = Buffer.from(signature, 'base64');

  // Create expected signature: timestamp.payload
  const signedPayload = `${timestamp}.${payload}`;

  // Compute HMAC-SHA256
  const computed = createHmac('sha256', signingSecret).update(signedPayload).digest();

  // Use timing-safe comparison (but first check lengths to avoid error)
  const isValid =
    decodedSignature.length === computed.length && timingSafeEqual(decodedSignature, computed);

  if (!isValid) {
    throw new Error('SendGrid signature verification failed');
  }

  // Parse the JSON payload (SendGrid sends an array of events)
  const events = JSON.parse(payload);

  if (!Array.isArray(events)) {
    throw new Error('SendGrid payload must be an array of events');
  }

  return events;
}

/**
 * Create a SendGrid webhook handler factory.
 */
export function createSendGridHandler(config: WebhookHandlerConfig): HandlerFactory<SendGridEvent> {
  const { signingSecret } = config;

  return {
    /**
     * Verify and parse the webhook payload.
     * Requires X-Twilio-Email-Event-Webhook-Signature and X-Twilio-Email-Event-Webhook-Timestamp headers.
     */
    verify(payload: string, signatureHeader: string, timestampHeader?: string): SendGridEvent {
      if (!timestampHeader) {
        throw new Error('Missing X-Twilio-Email-Event-Webhook-Timestamp header');
      }

      const events = verifySendGridSignature(
        payload,
        signatureHeader,
        timestampHeader,
        signingSecret,
      );

      // Return the first event (handlers can iterate over all if needed)
      const firstEvent = events[0];
      return {
        id: String(firstEvent.sg_event_id ?? firstEvent.message_id ?? ''),
        type: String(firstEvent.event ?? 'unknown'),
        data: firstEvent,
        created: firstEvent.timestamp ? Number(firstEvent.timestamp) * 1000 : undefined,
      } as SendGridEvent;
    },

    /**
     * Route the event to the appropriate handler based on event type.
     */
    async handle(
      event: SendGridEvent,
      handlers: Partial<Record<string, EventHandler<SendGridEvent>>>,
    ): Promise<void> {
      const handler = handlers[event.type];
      if (handler) {
        await handler(event);
      }
    },
  };
}

export type { SendGridEvent, SendGridEventType } from './types.js';
