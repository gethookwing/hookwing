# @hookwing/agent-skills

[![npm version](https://img.shields.io/npm/v/@hookwing/agent-skills.svg)](https://www.npmjs.com/package/@hookwing/agent-skills)
[![License](https://img.shields.io/npm/l/@hookwing/agent-skills.svg)](LICENSE)

Pre-baked webhook handler templates for AI coding agents. Built for developers and AI agents who need secure, production-ready webhook integrations in minutes.

## Why @hookwing/agent-skills?

- **Real signature verification** — HMAC-SHA256 with timing-safe comparison
- **Type-safe** — Full TypeScript support with typed event handlers
- **MCP-discoverable** — Recipe files for Model Context Protocol integration
- **Minimal dependencies** — Just Node.js built-ins for crypto
- **Hookwing-ready** — Auto-provision endpoints with the Hookwing API

## Supported Integrations

| Integration | Events | Signature Header |
|------------|--------|------------------|
| [Stripe](src/integrations/stripe/README.md) | payment_intent.*, customer.subscription.*, invoice.*, charge.* | `Stripe-Signature` |
| [GitHub](src/integrations/github/README.md) | push, pull_request, issues, release, workflow_dispatch | `X-Hub-Signature-256` |

**Coming soon:** Shopify, Slack, Twilio, SendGrid, Discord

## Quick Start

### Install

```bash
npm install @hookwing/agent-skills
# or
pnpm add @hookwing/agent-skills
```

### Stripe Handler

```typescript
import { createStripeHandler } from '@hookwing/agent-skills/stripe';

const handler = createStripeHandler({
  signingSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  toleranceSeconds: 300, // 5 minutes
});

// In your webhook route
app.post('/webhooks/stripe', async (req) => {
  const signature = req.headers['stripe-signature'];
  const payload = JSON.stringify(req.body);

  const event = handler.verify(payload, signature);

  await handler.handle(event, {
    'payment_intent.succeeded': async (evt) => {
      console.log('Payment succeeded:', evt.data.object.id);
    },
    'customer.subscription.created': async (evt) => {
      console.log('New subscription:', evt.data.object.id);
    },
  });

  return { received: true };
});
```

### GitHub Handler

```typescript
import { createGitHubHandler } from '@hookwing/agent-skills/github';

const handler = createGitHubHandler({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
});

// In your webhook route
app.post('/webhooks/github', async (req) => {
  const signature = req.headers['x-hub-signature-256'];
  const eventType = req.headers['x-github-event'];
  const payload = JSON.stringify(req.body);

  const event = handler.verify(payload, signature);

  await handler.handle(eventType, event, {
    'push': async (evt) => {
      console.log('Pushed to:', evt.ref);
    },
    'pull_request': async (evt) => {
      console.log('PR action:', evt.action);
    },
  });

  return { received: true };
});
```

## CLI

Scaffold a handler with the CLI:

```bash
# List available integrations
npx @hookwing/agent-skills list

# Scaffold a Stripe handler
npx @hookwing/agent-skills init stripe ./src

# Scaffold a GitHub handler
npx @hookwing/agent-skills init github ./src
```

## Hookwing Integration

Auto-provision endpoints with the Hookwing API:

```typescript
import { provisionEndpoint } from '@hookwing/agent-skills';

const endpoint = await provisionEndpoint({
  apiKey: process.env.HOOKWING_API_KEY!,
  integration: 'stripe',
  url: 'https://your-app.com/webhooks/stripe',
});

console.log('Endpoint created:', endpoint.id);
console.log('Secret:', endpoint.secret);
```

## Security

All handlers implement **real HMAC-SHA256 signature verification**:

1. **Stripe**: Uses timestamp + payload signing with tolerance checking
2. **GitHub**: Uses `sha256=` prefix with timing-safe comparison

No shortcuts — your webhooks are protected against replay attacks and tampering.

## Made for AI Agents

This package was designed for AI coding agents that need to:

- Set up webhook integrations quickly
- Handle multiple event types with type-safe handlers
- Verify signatures correctly without implementation errors

The MCP-discoverable recipe files enable AI agents to understand your integration's capabilities automatically.

## API Reference

### Stripe

- `createStripeHandler(config)` — Create a Stripe handler
- `verifyStripeSignature(payload, signature, secret, tolerance)` — Verify signature

### GitHub

- `createGitHubHandler(config)` — Create a GitHub handler
- `verifyGitHubSignature(payload, signature, secret)` — Verify signature

### Hookwing

- `provisionEndpoint(options)` — Create a webhook endpoint
- `listEndpoints(options)` — List all endpoints
- `deleteEndpoint(options)` — Delete an endpoint

## License

MIT
