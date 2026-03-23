/**
 * Tests for SendGrid webhook handler
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createSendGridHandler,
  verifySendGridSignature,
} from '../integrations/sendgrid/handler.js';

describe('SendGrid Handler', () => {
  const signingKey = 'sendgrid_test_key';

  it('should verify valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const events = [
      {
        sg_event_id: 'evt1',
        event: 'delivered',
        email: 'test@example.com',
        timestamp: Number.parseInt(timestamp),
      },
    ];
    const payload = JSON.stringify(events);
    const signedPayload = `${timestamp}.${payload}`;
    const computed = createHmac('sha256', signingKey).update(signedPayload).digest();

    const result = verifySendGridSignature(
      payload,
      computed.toString('base64'),
      timestamp,
      signingKey,
    );
    expect(result).toHaveLength(1);
    expect(result[0].event).toBe('delivered');
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify([{ event: 'delivered' }]);

    expect(() => {
      verifySendGridSignature(payload, 'invalid_signature', timestamp, signingKey);
    }).toThrow('SendGrid signature verification failed');
  });

  it('should reject non-array payload', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ event: 'delivered' });
    const signedPayload = `${timestamp}.${payload}`;
    const computed = createHmac('sha256', signingKey).update(signedPayload).digest();

    expect(() => {
      verifySendGridSignature(payload, computed.toString('base64'), timestamp, signingKey);
    }).toThrow('SendGrid payload must be an array of events');
  });

  it('should create handler and verify payload', () => {
    const handler = createSendGridHandler({ signingSecret: signingKey });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const events = [
      {
        sg_event_id: 'evt_123',
        event: 'delivered',
        email: 'test@example.com',
        timestamp: Number.parseInt(timestamp),
        message_id: 'msg_456',
      },
    ];
    const payload = JSON.stringify(events);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac('sha256', signingKey).update(signedPayload).digest('base64');

    const event = handler.verify(payload, signature, timestamp);

    expect(event.type).toBe('delivered');
    expect(event.id).toBe('evt_123');
  });

  it('should route event to correct handler', async () => {
    const handler = createSendGridHandler({ signingSecret: signingKey });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const events = [
      {
        sg_event_id: 'evt_123',
        event: 'open',
        email: 'test@example.com',
        timestamp: Number.parseInt(timestamp),
      },
    ];
    const payload = JSON.stringify(events);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac('sha256', signingKey).update(signedPayload).digest('base64');

    const event = handler.verify(payload, signature, timestamp);

    let handled = false;
    await handler.handle(event, {
      open: async () => {
        handled = true;
      },
    });

    expect(handled).toBe(true);
  });
});
