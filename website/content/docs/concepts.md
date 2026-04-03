---
title: "Concepts"
slug: "concepts"
summary: "Core Hookwing concepts: workspaces, endpoints, events, deliveries, ingest URLs, fan-out, and idempotency."
updatedAt: "2026-04-02"
---

## The Hookwing Data Model

Hookwing is organized around four core objects:

| Object | Description |
|--------|-------------|
| **Workspace** | Your account container. All endpoints, events, and keys belong to a workspace. |
| **Endpoint** | A destination URL where webhooks are delivered. Has a signing secret, optional event type filters, and optional custom headers. |
| **Event** | An incoming webhook payload received by Hookwing. Stored durably before delivery. |
| **Delivery** | A single attempt to deliver an event to an endpoint. Tracks HTTP status, request/response, and retry state. |

The relationship is: one workspace has many endpoints and many events. Each event can have many deliveries — one per matching endpoint, plus retries.

## Events

An event is created when a webhook payload arrives at an ingest URL. Hookwing:

1. Accepts the HTTP request immediately (returns `202 Accepted`)
2. Validates and stores the event payload durably
3. Queues delivery to all matching endpoints
4. Retries failed deliveries automatically (up to 6 attempts)

Events have a lifecycle status: `pending` → `delivered` or `failed` or `partial` (some endpoints delivered, some not).

### Ingest URL

Each endpoint has a unique ingest URL:

```
POST https://api.hookwing.com/v1/ingest/{endpoint_id}
```

You point your upstream service (Stripe, GitHub, your own app) at this URL. No authentication needed to ingest — Hookwing accepts any JSON payload.

You can optionally set `X-Event-Type` to help with routing and filtering:

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Event-Type: order.created" \
  -d '{"order_id": "123", "amount": 49.99}'
```

## Endpoints

An endpoint is where Hookwing delivers webhooks. You control:

- **URL** — your HTTPS destination
- **Event type filters** — only receive matching events (leave empty for all events)
- **Custom headers** — extra headers injected on every delivery (Warbird+ tier)
- **Active/paused state** — pause delivery without deleting the endpoint

When an endpoint is created, Hookwing generates a **signing secret** (`whsec_...`). Use this to verify webhook signatures in your handler.

## Fan-Out Delivery

One event can be delivered to multiple endpoints simultaneously. This is called fan-out:

```
order.created event
  ├── Endpoint A (eventTypes: ["order.*"])          → delivered
  ├── Endpoint B (eventTypes: ["order.created"])    → delivered
  └── Endpoint C (no filter — receives all events) → delivered
```

Each endpoint gets its own delivery attempt, independent retry state, and its own signed request.

## Deliveries

A delivery represents one HTTP request to one endpoint for one event. Each delivery tracks:

- HTTP status code returned by your server
- Full request body (what Hookwing sent)
- Full response body (what your server returned)
- Attempt number (1–6 for retries)
- Next retry time (exponential backoff)

### Retry Schedule

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 6 hours |

After 6 failed attempts, the delivery is marked `dead_lettered`. On Warbird+ tiers, dead-lettered events appear in the DLQ dashboard for manual replay.

## Idempotency

To prevent duplicate processing, include an idempotency key when ingesting events:

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Hookwing-Idempotency-Key: order-123-created" \
  -d '{"order_id": "123"}'
```

If Hookwing receives the same idempotency key within 24 hours, it returns the original response without creating a duplicate event.

## Rate Limits and Quotas

| Tier | Events/month | Endpoints | Retention |
|------|-------------|-----------|-----------|
| Paper Plane (Free) | 10,000 | 3 | 7 days |
| Warbird ($19/mo) | 500,000 | 10 | 30 days |
| Stealth Jet ($89/mo) | Unlimited | Unlimited | 90 days |

Rate limit headers are included on every API response:

- `X-RateLimit-Limit` — max requests per window
- `X-RateLimit-Remaining` — remaining requests
- `X-RateLimit-Reset` — Unix timestamp when window resets
