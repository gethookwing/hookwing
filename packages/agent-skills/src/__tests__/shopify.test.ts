/**
 * Tests for Shopify webhook handler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { createShopifyHandler, verifyShopifySignature } from '../integrations/shopify/handler.js';

describe('Shopify Handler', () => {
  const secret = 'shopify_test_secret';
  const validPayload = JSON.stringify({
    id: 12345,
    topic: 'orders/create',
    order_number: 1001,
    email: 'test@example.com',
    total_price: '100.00',
  });

  it('should verify valid signature', () => {
    const hmac = createHmac('sha256', secret).update(validPayload, 'utf-8').digest('base64');
    const result = verifyShopifySignature(validPayload, hmac, secret);
    expect(result).toBeDefined();
    expect(result.id).toBe(12345);
  });

  it('should reject invalid signature', () => {
    expect(() => {
      verifyShopifySignature(validPayload, 'invalid_signature', secret);
    }).toThrow('Shopify signature verification failed');
  });

  it('should create handler and verify payload', () => {
    const handler = createShopifyHandler({ signingSecret: secret });
    const hmac = createHmac('sha256', secret).update(validPayload, 'utf-8').digest('base64');
    const event = handler.verify(validPayload, hmac);

    expect(event.type).toBe('orders/create');
    expect(event.id).toBe('12345');
  });

  it('should route event to correct handler', async () => {
    const handler = createShopifyHandler({ signingSecret: secret });
    const hmac = createHmac('sha256', secret).update(validPayload, 'utf-8').digest('base64');
    const event = handler.verify(validPayload, hmac);

    let handled = false;
    await handler.handle(event, {
      'orders/create': async () => { handled = true; },
    });

    expect(handled).toBe(true);
  });

  it('should not call handler for unmatched event type', async () => {
    const handler = createShopifyHandler({ signingSecret: secret });
    const hmac = createHmac('sha256', secret).update(validPayload, 'utf-8').digest('base64');
    const event = handler.verify(validPayload, hmac);

    let handled = false;
    await handler.handle(event, {
      'products/create': async () => { handled = true; },
    });

    expect(handled).toBe(false);
  });
});
