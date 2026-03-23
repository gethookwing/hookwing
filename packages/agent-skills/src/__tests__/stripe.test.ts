/**
 * Tests for Stripe webhook handler
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type StripeEvent,
  createStripeHandler,
  verifyStripeSignature,
} from '../integrations/stripe/handler.js';

const TEST_SECRET = 'whsec_test_secret';

function createValidSignature(
  payload: string,
  secret: string,
): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return { signature: `t=${timestamp},v1=${signature}`, timestamp };
}

const sampleEvent: StripeEvent = {
  id: 'evt_test_123',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_test_123',
      amount: 2000,
      currency: 'usd',
    },
  },
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  api_version: '2024-12-18.acacia',
};

describe('Stripe signature verification', () => {
  it('should verify valid signature', () => {
    const payload = JSON.stringify(sampleEvent);
    const { signature, timestamp } = createValidSignature(payload, TEST_SECRET);

    const result = verifyStripeSignature(payload, signature, TEST_SECRET);

    expect(result.id).toBe(sampleEvent.id);
    expect(result.type).toBe(sampleEvent.type);
  });

  it('should reject invalid signature', () => {
    const payload = JSON.stringify(sampleEvent);
    const { timestamp } = createValidSignature(payload, TEST_SECRET);

    const badSignature = `t=${timestamp},v1=invalid_signature`;

    expect(() => {
      verifyStripeSignature(payload, badSignature, TEST_SECRET);
    }).toThrow('Stripe signature verification failed');
  });

  it('should reject tampered payload', () => {
    const payload = JSON.stringify(sampleEvent);
    const { signature } = createValidSignature(payload, TEST_SECRET);

    const tamperedPayload = JSON.stringify({ ...sampleEvent, type: 'payment_intent.failed' });

    expect(() => {
      verifyStripeSignature(tamperedPayload, signature, TEST_SECRET);
    }).toThrow('Stripe signature verification failed');
  });

  it('should reject expired timestamp', () => {
    const payload = JSON.stringify(sampleEvent);
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signedPayload = `${oldTimestamp}.${payload}`;
    const signature = `t=${oldTimestamp},v1=${createHmac('sha256', TEST_SECRET).update(signedPayload).digest('hex')}`;

    expect(() => {
      verifyStripeSignature(payload, signature, TEST_SECRET, 300);
    }).toThrow('timestamp too old');
  });

  it('should reject missing signature header', () => {
    expect(() => {
      verifyStripeSignature('{}', '', TEST_SECRET);
    }).toThrow('Missing Stripe-Signature header');
  });

  it('should reject malformed header', () => {
    expect(() => {
      verifyStripeSignature('{}', 'invalid', TEST_SECRET);
    }).toThrow('Invalid Stripe-Signature header format');
  });
});

describe('Stripe handler', () => {
  it('should create handler and verify signature', () => {
    const handler = createStripeHandler({ signingSecret: TEST_SECRET });
    const payload = JSON.stringify(sampleEvent);
    const { signature } = createValidSignature(payload, TEST_SECRET);

    const result = handler.verify(payload, signature);

    expect(result.id).toBe(sampleEvent.id);
  });

  it('should route events to correct handlers', async () => {
    const handler = createStripeHandler({ signingSecret: TEST_SECRET });
    const payload = JSON.stringify(sampleEvent);
    const { signature } = createValidSignature(payload, TEST_SECRET);

    const event = handler.verify(payload, signature);

    let handled = false;
    await handler.handle(event, {
      'payment_intent.succeeded': async (e) => {
        handled = true;
        expect(e.id).toBe(sampleEvent.id);
      },
    });

    expect(handled).toBe(true);
  });

  it('should skip unknown event types', async () => {
    const handler = createStripeHandler({ signingSecret: TEST_SECRET });
    const unknownEvent = { ...sampleEvent, type: 'unknown.event' };
    const payload = JSON.stringify(unknownEvent);
    const { signature } = createValidSignature(payload, TEST_SECRET);

    const event = handler.verify(payload, signature);

    // Should not throw - just skips unknown events
    await handler.handle(event, {
      'payment_intent.succeeded': async () => {},
    });
  });
});
