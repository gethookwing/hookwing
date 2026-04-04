---
title: "Endpoints"
slug: "endpoints"
summary: "Create, manage, and configure webhook endpoints. Event type routing, fan-out delivery, and custom headers."
updatedAt: "2026-03-24"
---

## Endpoint Management

Endpoints are where Hookwing delivers webhooks. Each endpoint has a URL, signing secret, and optional event type filters.

### Create an endpoint

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "description": "production-webhooks",
    "eventTypes": ["order.created", "payment.succeeded"]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | HTTPS URL where webhooks are delivered |
| `description` | string | No | Human-readable description (max 500 chars) |
| `eventTypes` | string[] | No | Filter — only deliver matching event types |
| `customHeaders` | object | No | Extra headers injected on delivery (Warbird+) |

### List endpoints

```bash
curl https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key"
```

### Update an endpoint

```bash
curl -X PATCH https://api.hookwing.com/v1/endpoints/ep_abc123 \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://new-url.com/webhooks"}'
```

### Delete an endpoint

```bash
curl -X DELETE https://api.hookwing.com/v1/endpoints/ep_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

## Event Type Routing

When you create an endpoint with `eventTypes`, Hookwing only delivers events that match. This enables fan-out — one event can be delivered to multiple endpoints based on type:

```
order.created  ──→ Endpoint A (order.*)
               ├──→ Endpoint B (order.created, payment.*)
               └──→ Endpoint C (all events — no filter)
```

## Custom Headers (Warbird+)

Inject extra headers on every delivery to an endpoint:

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "description": "with-custom-headers",
    "customHeaders": {
      "X-Service-Token": "your-token",
      "X-Environment": "production"
    }
  }'
```

Maximum 10 custom headers. Reserved headers (Authorization, Host, Content-Type, X-Hookwing-*) cannot be overridden.

## Endpoint Limits by Tier

| Tier | Endpoints |
|------|-----------|
| Paper Plane (Free) | 3 |
| Warbird ($19/mo) | 10 |
| Stealth Jet ($89/mo) | Unlimited |
