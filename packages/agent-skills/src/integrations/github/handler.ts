/**
 * GitHub webhook handler with HMAC-SHA256 signature verification
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GitHubEvent, GitHubWebhookConfig, GitHubHandler, GitHubEventHandler } from './types.js';

export { type GitHubEvent, type GitHubWebhookConfig, type GitHubHandler, type GitHubEventHandler } from './types.js';

/**
 * Verify GitHub webhook signature
 *
 * @param payload - Raw request body string
 * @param signatureHeader - Value of X-Hub-Signature-256 header (format: sha256=<hex>)
 * @param secret - Webhook secret from GitHub repo settings
 * @returns Parsed GitHub event
 * @throws Error if signature is invalid
 */
export function verifyGitHubSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string
): GitHubEvent {
  if (!signatureHeader) {
    throw new Error('Missing X-Hub-Signature-256 header');
  }

  if (!signatureHeader.startsWith('sha256=')) {
    throw new Error('Invalid GitHub signature format. Expected: sha256=<hex>');
  }

  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8');
  const expectedSig = 'sha256=' + createHmac('sha256', secret).update(payloadStr).digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length) {
      throw new Error('GitHub signature verification failed');
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new Error('GitHub signature verification failed');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('GitHub signature')) {
      throw err;
    }
    throw new Error('GitHub signature verification failed');
  }

  return JSON.parse(payloadStr);
}

/**
 * Create a GitHub webhook handler with configuration
 *
 * @param config - Configuration including webhook secret
 * @returns Handler with verify() and handle() methods
 */
export function createGitHubHandler(config: GitHubWebhookConfig): GitHubHandler {
  return {
    verify: (payload: string, signatureHeader: string) =>
      verifyGitHubSignature(payload, signatureHeader, config.webhookSecret),

    handle: async (
      eventType: string,
      event: GitHubEvent,
      handlers: Partial<Record<string, GitHubEventHandler>>
    ) => {
      const handler = handlers[eventType];
      if (handler) {
        await handler(event);
      }
    },
  };
}

// Default export for convenience
export default createGitHubHandler;
