---
title: "Webhook Sources"
slug: "webhook-sources"
summary: "Pre-configured setup guides for popular webhook providers: Stripe, GitHub, Shopify, and Linear."
updatedAt: "2026-04-03"
---

## Overview

Hookwing provides pre-configured source presets for popular webhook providers. These presets include known event types, signature verification details, and setup instructions — making it faster to connect your sources.

Query source presets programmatically:

```bash
# List all available sources
curl https://api.hookwing.com/api/webhook-sources

# Get a specific source
curl https://api.hookwing.com/api/webhook-sources/stripe
```

## Stripe

Payment processing, subscriptions, and billing events.

### Setup

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Click **Add endpoint** and paste your Hookwing ingest URL
3. Select the event types you want to receive
4. Copy the signing secret — you'll need it for signature verification

### Signature

| Header | Algorithm |
|--------|-----------|
| `Stripe-Signature` | HMAC-SHA256 with timestamp (`t=...,v1=...`) |

### Recommended Event Types

| Event | Description |
|-------|-------------|
| `payment_intent.succeeded` | Payment completed successfully |
| `payment_intent.payment_failed` | Payment attempt failed |
| `customer.subscription.created` | New subscription started |
| `customer.subscription.updated` | Subscription plan or status changed |
| `customer.subscription.deleted` | Subscription cancelled |
| `invoice.paid` | Invoice payment succeeded |
| `invoice.payment_failed` | Invoice payment failed |
| `checkout.session.completed` | Checkout session completed |

### Example: Route Stripe payments to your billing agent

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/stripe",
    "name": "stripe-payments",
    "eventTypes": [
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "invoice.paid"
    ]
  }'
```

Then configure Stripe to send webhooks to: `https://api.hookwing.com/v1/ingest/<endpoint_id>`

---

## GitHub

Repository events, pull requests, issues, deployments, and CI/CD.

### Setup

1. Go to your repository → **Settings → Webhooks → Add webhook**
2. Paste your Hookwing ingest URL as the **Payload URL**
3. Set **Content type** to `application/json`
4. Enter a secret (save it for signature verification)
5. Select individual events or "Send me everything"

### Signature

| Header | Algorithm |
|--------|-----------|
| `X-Hub-Signature-256` | HMAC-SHA256 (prefixed with `sha256=`) |

### Recommended Event Types

| Event | Description |
|-------|-------------|
| `pull_request.opened` | New PR opened |
| `pull_request.closed` | PR closed or merged |
| `push` | Commits pushed to a branch |
| `issues.opened` | New issue created |
| `workflow_run.completed` | CI/CD workflow finished |
| `release.published` | New release published |

### Example: Route PR events to your coding agent

```json
{
  "name": "GitHub PRs to code reviewer",
  "conditions": [
    { "field": "event.type", "operator": "starts_with", "value": "pull_request." }
  ],
  "action": { "type": "deliver", "endpointId": "ep_code_reviewer" }
}
```

---

## Shopify

E-commerce events: orders, products, customers, and inventory.

### Setup

1. Go to **Shopify Admin → Settings → Notifications → Webhooks**
2. Click **Create webhook**
3. Select the event type and set format to **JSON**
4. Paste your Hookwing ingest URL
5. Note the HMAC verification key shown at the top of the Webhooks page

### Signature

| Header | Algorithm |
|--------|-----------|
| `X-Shopify-Hmac-Sha256` | HMAC-SHA256 (base64-encoded) |

### Recommended Event Types

| Event | Description |
|-------|-------------|
| `orders/create` | New order placed |
| `orders/paid` | Order payment completed |
| `orders/fulfilled` | Order shipped |
| `orders/cancelled` | Order cancelled |
| `products/update` | Product listing updated |
| `customers/create` | New customer registered |
| `inventory_levels/update` | Inventory quantity changed |

---

## Linear

Project management events: issues, projects, comments, and cycles.

### Setup

1. Go to **Linear → Settings → API → Webhooks**
2. Click **New webhook**
3. Paste your Hookwing ingest URL
4. Select the resource types you want to subscribe to
5. Save and copy the signing secret

### Signature

| Header | Algorithm |
|--------|-----------|
| `Linear-Signature` | HMAC-SHA256 (hex-encoded) |

### Recommended Event Types

| Event | Description |
|-------|-------------|
| `Issue.create` | New issue created |
| `Issue.update` | Issue status, assignee, or priority changed |
| `Comment.create` | New comment on an issue |
| `Project.update` | Project status or details changed |
| `Cycle.update` | Sprint/cycle progress updated |

### Example: Auto-assign issues to an agent

```json
{
  "name": "New Linear issues to triage agent",
  "conditions": [
    { "field": "event.type", "operator": "equals", "value": "Issue.create" }
  ],
  "action": { "type": "deliver", "endpointId": "ep_triage_agent" }
}
```

## Querying Sources Programmatically

Agents can discover available sources and their event types at runtime:

```bash
# List all sources
curl https://api.hookwing.com/api/webhook-sources

# Get Stripe's event types
curl https://api.hookwing.com/api/webhook-sources/stripe | jq '.eventTypes'

# Get recommended events for GitHub
curl https://api.hookwing.com/api/webhook-sources/github | jq '.recommendedEventTypes'
```

This enables agents to self-configure endpoint event type filters based on the source they're connecting to.
