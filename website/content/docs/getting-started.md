---
title: "Getting Started"
slug: "getting-started"
summary: "Your first webhook in 60 seconds. Create an account, set up an endpoint, and start receiving events."
updatedAt: "2026-03-24"
---

## Your first webhook in 60 seconds

Hookwing receives webhooks, verifies signatures, retries on failure, and delivers to your endpoints. Here's how to get started.

### 1. Create an account

```bash
curl -X POST https://api.hookwing.com/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@company.com", "password": "your-secure-password"}'
```

You'll get back a workspace and an API key:

```json
{
  "workspace": {
    "id": "ws_abc123",
    "name": "you's Workspace",
    "tier": { "slug": "paper-plane", "name": "Paper Plane" }
  },
  "apiKey": "hk_live_xxxxxxxxxxxxxxxx"
}
```

Save your API key — it's shown only once. Use it in the `Authorization` header for all API calls.

### 2. Create a webhook endpoint

Tell Hookwing where to deliver webhooks:

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "name": "my-first-endpoint"
  }'
```

Response:

```json
{
  "id": "ep_xyz789",
  "url": "https://your-app.com/webhooks",
  "name": "my-first-endpoint",
  "secret": "whsec_xxxxxxxx",
  "isActive": true
}
```

The `secret` is your signing secret — use it to verify webhook signatures.

### 3. Send a test webhook

Post any JSON payload to the ingest URL:

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_xyz789 \
  -H "Content-Type: application/json" \
  -H "X-Event-Type: order.created" \
  -d '{
    "event": "order.created",
    "order_id": "ord_123",
    "amount": 49.99,
    "currency": "USD"
  }'
```

Hookwing will:
1. Accept the event
2. Verify and store it
3. Deliver it to your endpoint URL with HMAC-SHA256 signature
4. Retry up to 6 times if delivery fails

### 4. Check your events

```bash
curl https://api.hookwing.com/v1/events \
  -H "Authorization: Bearer hk_live_your_key"
```

You'll see your event with delivery status:

```json
{
  "events": [
    {
      "id": "evt_abc",
      "eventType": "order.created",
      "status": "delivered",
      "receivedAt": 1774000000000
    }
  ]
}
```

### 5. Verify webhook signatures

When Hookwing delivers to your endpoint, it includes two headers:

- `X-Hookwing-Signature`: `sha256=<hex-encoded HMAC>`
- `X-Hookwing-Timestamp`: Unix timestamp in milliseconds

Use the SDK to verify:

**Node.js:**
```javascript
import { Webhook } from '@hookwing/sdk';

const wh = new Webhook('whsec_your_signing_secret');
const event = await wh.verify(payload, {
  signature: req.headers['x-hookwing-signature'],
  timestamp: req.headers['x-hookwing-timestamp']
});
```

**Python:**
```python
from hookwing import Webhook

wh = Webhook('whsec_your_signing_secret')
event = wh.verify(payload, {
    'signature': request.headers['x-hookwing-signature'],
    'timestamp': request.headers['x-hookwing-timestamp']
})
```

**Go:**
```go
wh := hookwing.NewWebhook("whsec_your_signing_secret")
event, err := wh.Verify([]byte(payload), req.Header)
```

## What's next?

- [API Reference](/docs/) — full endpoint documentation
- [Interactive API Explorer](/docs/api/) — try endpoints in your browser
- [Playground](/playground/) — test webhooks without an account
