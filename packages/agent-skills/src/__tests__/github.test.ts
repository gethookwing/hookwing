/**
 * Tests for GitHub webhook handler
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type GitHubEvent,
  createGitHubHandler,
  verifyGitHubSignature,
} from '../integrations/github/handler.js';

const TEST_SECRET = 'github_webhook_secret';

function createValidSignature(payload: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

const sampleEvent: GitHubEvent = {
  action: 'opened',
  repository: {
    id: 12345678,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    html_url: 'https://github.com/testuser/test-repo',
    description: 'A test repository',
  },
  sender: {
    login: 'testuser',
    id: 12345,
    type: 'User',
  },
  ref: 'refs/heads/main',
  commits: [],
};

describe('GitHub signature verification', () => {
  it('should verify valid signature', () => {
    const payload = JSON.stringify(sampleEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    const result = verifyGitHubSignature(payload, signature, TEST_SECRET);

    expect(result.repository.name).toBe('test-repo');
  });

  it('should reject invalid signature', () => {
    const payload = JSON.stringify(sampleEvent);

    expect(() => {
      verifyGitHubSignature(payload, 'sha256=invalid', TEST_SECRET);
    }).toThrow('GitHub signature verification failed');
  });

  it('should reject tampered payload', () => {
    const payload = JSON.stringify(sampleEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    const tamperedPayload = JSON.stringify({ ...sampleEvent, action: 'closed' });

    expect(() => {
      verifyGitHubSignature(tamperedPayload, signature, TEST_SECRET);
    }).toThrow('GitHub signature verification failed');
  });

  it('should reject missing signature header', () => {
    expect(() => {
      verifyGitHubSignature('{}', '', TEST_SECRET);
    }).toThrow('Missing X-Hub-Signature-256 header');
  });

  it('should reject wrong signature format', () => {
    expect(() => {
      verifyGitHubSignature('{}', 'sha1=abc', TEST_SECRET);
    }).toThrow('Invalid GitHub signature format');
  });

  it('should reject signature with wrong prefix', () => {
    expect(() => {
      verifyGitHubSignature('{}', 'hmac=sha256=abc', TEST_SECRET);
    }).toThrow('Invalid GitHub signature format');
  });
});

describe('GitHub handler', () => {
  it('should create handler and verify signature', () => {
    const handler = createGitHubHandler({ webhookSecret: TEST_SECRET });
    const payload = JSON.stringify(sampleEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    const result = handler.verify(payload, signature);

    expect(result.repository.name).toBe('test-repo');
  });

  it('should route events to correct handlers', async () => {
    const handler = createGitHubHandler({ webhookSecret: TEST_SECRET });
    const payload = JSON.stringify(sampleEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    let handled = false;
    await handler.handle('push', handler.verify(payload, signature), {
      push: async (e) => {
        handled = true;
        expect(e.repository.name).toBe('test-repo');
      },
    });

    expect(handled).toBe(true);
  });

  it('should skip unknown event types', async () => {
    const handler = createGitHubHandler({ webhookSecret: TEST_SECRET });
    const payload = JSON.stringify(sampleEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    const event = handler.verify(payload, signature);

    // Should not throw - just skips unknown events
    await handler.handle('unknown_event', event, {
      push: async () => {},
    });
  });

  it('should handle pull_request events', async () => {
    const prEvent: GitHubEvent = {
      action: 'opened',
      number: 42,
      pull_request: {
        id: 1,
        number: 42,
        title: 'Test PR',
        body: 'Test body',
        state: 'open',
        html_url: 'https://github.com/test/test/pull/42',
        user: { login: 'testuser', id: 123 },
      },
      repository: sampleEvent.repository,
      sender: sampleEvent.sender,
    };

    const handler = createGitHubHandler({ webhookSecret: TEST_SECRET });
    const payload = JSON.stringify(prEvent);
    const signature = createValidSignature(payload, TEST_SECRET);

    let handled = false;
    await handler.handle('pull_request', handler.verify(payload, signature), {
      pull_request: async (e) => {
        handled = true;
        expect((e as GitHubEvent & { number: number }).number).toBe(42);
      },
    });

    expect(handled).toBe(true);
  });
});
