/**
 * Stripe webhook handler with HMAC-SHA256 signature verification
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StripeEvent, StripeWebhookConfig, StripeHandler, StripeEventHandler } from './types.js';

export { type StripeEvent, type StripeWebhookConfig, type StripeHandler, type StripeEventHandler } from './types.js';

/**
 * Verify Stripe webhook signature and parse the event
 *
 * @param payload - Raw request body string
 * @param signatureHeader - Value of Stripe-Signature header
 * @param secret - Webhook signing secret from Stripe dashboard
 * @param toleranceSeconds - Max age of webhook (default 300s = 5min)
 * @returns Parsed Stripe event
 * @throws Error if signature is invalid or timestamp is too old
 */
export function verifyStripeSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): StripeEvent {
  if (!signatureHeader) {
    throw new Error('Missing Stripe-Signature header');
  }

  const elements = signatureHeader.split(',').reduce<{ timestamp: string; signatures: string[] }>(
    (acc, el) => {
      const [key, value] = el.split('=');
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    },
    { timestamp: '', signatures: [] }
  );

  if (!elements.timestamp || elements.signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header format');
  }

  const timestamp = parseInt(elements.timestamp, 10);
  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp in Stripe-Signature header');
  }

  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > toleranceSeconds) {
    throw new Error(`Stripe webhook timestamp too old (${Math.round(age)}s > ${toleranceSeconds}s)`);
  }

  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8');
  const signedPayload = `${elements.timestamp}.${payloadStr}`;
  const expectedSig = createHmac('sha256', secret).update(signedPayload).digest('hex');

  const isValid = elements.signatures.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    } catch {
      // timingSafeEqual throws if buffers have different lengths
      return false;
    }
  });

  if (!isValid) {
    throw new Error('Stripe signature verification failed');
  }

  return JSON.parse(payloadStr);
}

/**
 * Create a Stripe webhook handler with configuration
 *
 * @param config - Configuration including signing secret
 * @returns Handler with verify() and handle() methods
 */
export function createStripeHandler(config: StripeWebhookConfig): StripeHandler {
  return {
    verify: (payload: string, signatureHeader: string) =>
      verifyStripeSignature(payload, signatureHeader, config.signingSecret, config.toleranceSeconds),

    handle: async (
      event: StripeEvent,
      handlers: Partial<Record<string, StripeEventHandler>>
    ) => {
      const handler = handlers[event.type];
      if (handler) {
        await handler(event);
      }
    },
  };
}

// Default export for convenience
export default createStripeHandler;
