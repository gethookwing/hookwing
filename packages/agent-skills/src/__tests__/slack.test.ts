/**
 * Tests for Slack webhook handler
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { createSlackHandler, verifySlackSignature } from '../integrations/slack/handler.js';

describe('Slack Handler', () => {
  const secret = 'slack_test_secret';

  it('should verify valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    const sigBasestring = `v0:${timestamp}:${payload}`;
    const expected = 'v0=' + createHmac('sha256', secret).update(sigBasestring).digest('hex');

    const result = verifySlackSignature(payload, expected, timestamp, secret);
    expect(result).toBeDefined();
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ type: 'event_callback' });

    expect(() => {
      verifySlackSignature(payload, 'v0=invalid', timestamp, secret);
    }).toThrow('Slack signature verification failed');
  });

  it('should reject old timestamp', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes ago
    const payload = JSON.stringify({ type: 'event_callback' });
    const sigBasestring = `v0:${oldTimestamp}:${payload}`;
    const expected = 'v0=' + createHmac('sha256', secret).update(sigBasestring).digest('hex');

    expect(() => {
      verifySlackSignature(payload, expected, oldTimestamp, secret);
    }).toThrow('Slack request timestamp too old');
  });

  it('should handle URL verification challenge', () => {
    const handler = createSlackHandler({ signingSecret: secret });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const challengePayload = JSON.stringify({ type: 'url_verification', challenge: 'test_challenge' });
    // URL verification doesn't require signature verification - use valid timestamp
    const sigBasestring = `v0:${timestamp}:${challengePayload}`;
    const signature = 'v0=' + createHmac('sha256', secret).update(sigBasestring).digest('hex');

    const event = handler.verify(challengePayload, signature, timestamp);

    expect(event.type).toBe('url_verification');
    expect((event.data as { challenge: string }).challenge).toBe('test_challenge');
  });

  it('should create handler and verify event', () => {
    const handler = createSlackHandler({ signingSecret: secret });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      type: 'event_callback',
      event: { type: 'message', channel: 'C123', text: 'Hello' },
      event_time_ts: timestamp,
    });
    const sigBasestring = `v0:${timestamp}:${payload}`;
    const signature = 'v0=' + createHmac('sha256', secret).update(sigBasestring).digest('hex');

    const event = handler.verify(payload, signature, timestamp);

    expect(event.type).toBe('message');
  });
});
