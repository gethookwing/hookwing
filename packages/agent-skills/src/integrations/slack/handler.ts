/**
 * Slack webhook handler with HMAC-SHA256 signature verification.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookHandlerConfig, EventHandler, HandlerFactory } from '../../types.js';
import type { SlackEvent, SlackEventType } from './types.js';

/**
 * Verify Slack webhook signature from X-Slack-Signature and X-Slack-Request-Timestamp headers.
 * Slack uses HMAC-SHA256 with format: v0=<hex_signature>
 * Signed payload format: v0:{timestamp}:{body}
 */
export function verifySlackSignature(
  payload: string,
  signature: string,
  timestamp: string,
  signingSecret: string
): Record<string, unknown> {
  // Reject requests older than 5 minutes to prevent replay attacks
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTimestamp) > 60 * 5) {
    throw new Error('Slack request timestamp too old');
  }

  const sigBasestring = `v0:${timestamp}:${payload}`;
  const computed = 'v0=' + createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);

  if (computedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(computedBuf, signatureBuf)) {
    throw new Error('Slack signature verification failed');
  }

  return JSON.parse(payload);
}

/**
 * Create a Slack webhook handler factory.
 */
export function createSlackHandler(config: WebhookHandlerConfig): HandlerFactory<SlackEvent> {
  const { signingSecret } = config;

  return {
    /**
     * Verify and parse the webhook payload.
     */
    verify(payload: string, signatureHeader: string, timestampHeader?: string): SlackEvent {
      if (!timestampHeader) {
        throw new Error('Missing X-Slack-Request-Timestamp header');
      }

      const data = verifySlackSignature(payload, signatureHeader, timestampHeader, signingSecret);

      // Handle both URL-verification challenge and regular events
      if (data.type === 'url_verification') {
        return {
          id: 'url_verification',
          type: 'url_verification',
          data: { challenge: data.challenge },
        } as SlackEvent;
      }

      // Regular event payload
      const eventObj = data.event as Record<string, unknown> | undefined;
      return {
        id: String(eventObj?.event_id ?? `${data.event_time_ts}-${(eventObj?.channel as string)?.[0] ?? 'unknown'}`),
        type: String(eventObj?.type ?? 'unknown'),
        data,
        created: data.event_time_ts ? Number(data.event_time_ts) * 1000 : undefined,
      } as SlackEvent;
    },

    /**
     * Route the event to the appropriate handler based on event type.
     */
    async handle(event: SlackEvent, handlers: Partial<Record<string, EventHandler<SlackEvent>>>): Promise<void> {
      const handler = handlers[event.type];
      if (handler) {
        await handler(event);
      }
    },
  };
}

export type { SlackEvent, SlackEventType } from './types.js';
