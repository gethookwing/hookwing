/**
 * Tests for Twilio webhook handler
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createTwilioHandler, verifyTwilioSignature } from '../integrations/twilio/handler.js';

describe('Twilio Handler', () => {
  const authToken = 'twilio_test_token';
  const url = 'https://example.com/webhooks/twilio';

  it('should verify valid signature', () => {
    const params = {
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
      To: '+1234567890',
      From: '+0987654321',
    };

    const sortedKeys = Object.keys(params).sort();
    const data =
      url + sortedKeys.reduce((s, key) => s + key + params[key as keyof typeof params], '');
    const signature = createHmac('sha1', authToken).update(data).digest('base64');

    const result = verifyTwilioSignature(url, params, signature, authToken);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const params = {
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
    };

    const result = verifyTwilioSignature(url, params, 'invalid_signature', authToken);
    expect(result).toBe(false);
  });

  it('should create handler and verify payload', () => {
    const handler = createTwilioHandler({ signingSecret: authToken });

    const params = {
      MessageSid: 'SM123456',
      MessageStatus: 'delivered',
      To: '+1234567890',
      From: '+0987654321',
      Body: 'Hello',
    };

    const sortedKeys = Object.keys(params).sort();
    const data =
      url + sortedKeys.reduce((s, key) => s + key + params[key as keyof typeof params], '');
    const signature = createHmac('sha1', authToken).update(data).digest('base64');

    const payload = JSON.stringify(params);
    const event = handler.verify(payload, signature, url, params);

    expect(event.type).toBe('delivered');
    expect(event.id).toBe('SM123456');
  });

  it('should route event to correct handler', async () => {
    const handler = createTwilioHandler({ signingSecret: authToken });

    const params = {
      MessageSid: 'SM123456',
      MessageStatus: 'delivered',
      To: '+1234567890',
      From: '+0987654321',
    };

    const sortedKeys = Object.keys(params).sort();
    const data =
      url + sortedKeys.reduce((s, key) => s + key + params[key as keyof typeof params], '');
    const signature = createHmac('sha1', authToken).update(data).digest('base64');

    const payload = JSON.stringify(params);
    const event = handler.verify(payload, signature, url, params);

    let handled = false;
    await handler.handle(event, {
      delivered: async () => {
        handled = true;
      },
    });

    expect(handled).toBe(true);
  });
});
