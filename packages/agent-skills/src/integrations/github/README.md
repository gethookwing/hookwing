# GitHub Integration

Handle GitHub webhook events with signature verification.

## Installation

```bash
npm install @hookwing/agent-skills
```

## Usage

```typescript
import { createGitHubHandler } from '@hookwing/agent-skills/github';

const handler = createGitHubHandler({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
});

// In your webhook route handler:
app.post('/webhooks/github', async (req) => {
  const eventType = req.headers['x-github-event'] as string;
  const signatureHeader = req.headers['x-hub-signature-256'] as string;

  const event = handler.verify(JSON.stringify(req.body), signatureHeader);

  await handler.handle(eventType, event, {
    'push': async (event) => {
      console.log('Push to:', event.ref);
      console.log('Commits:', event.commits?.length);
    },
    'pull_request': async (event) => {
      console.log('PR action:', event.action);
      console.log('PR number:', event.number);
    },
    'issues': async (event) => {
      console.log('Issue action:', event.action);
      console.log('Issue:', event.issue?.title);
    },
  });
});
```

## Signature Verification

This handler implements real HMAC-SHA256 signature verification using Node.js crypto:

1. Validates `X-Hub-Signature-256` header format (`sha256=<hex>`)
2. Computes expected HMAC-SHA256 of the raw payload
3. Uses `timingSafeEqual` to prevent timing attacks

## Events Supported

- `push` - Code pushed to repository
- `pull_request` - Pull request opened, closed, synchronized, etc.
- `issues` - Issue opened, closed, labeled, etc.
- `release` - Release published, created, edited
- `workflow_dispatch` - Manual workflow trigger
- `workflow_run` - Workflow run completed
- `deployment` - Deployment created
- `deployment_status` - Deployment status changed

## GitHub Setup

1. Go to Repository Settings → Webhooks
2. Add new webhook:
   - Payload URL: `https://your-endpoint.com/webhooks/github`
   - Content type: `application/json`
   - Secret: Generate and save (use as `GITHUB_WEBHOOK_SECRET`)
3. Select events to receive
