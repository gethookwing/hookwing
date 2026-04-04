---
title: "Events"
slug: "events"
summary: "Event object schema, lifecycle states, and API reference for listing, retrieving, and replaying events."
updatedAt: "2026-04-02"
---

## The Event Object

An event is created each time Hookwing receives a webhook payload at an ingest URL.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event ID (`evt_...`) |
| `workspaceId` | string | Workspace that owns this event |
| `endpointId` | string | Endpoint that received the ingest request |
| `eventType` | string | Value of `X-Event-Type` header, or `null` |
| `payload` | object | The raw JSON body received |
| `headers` | object | Headers from the ingest request |
| `status` | string | `pending`, `delivered`, `failed`, or `partial` |
| `receivedAt` | number | Unix timestamp (ms) when event was received |
| `deliveredAt` | number | Unix timestamp (ms) of last successful delivery |

### Event Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Received; delivery not yet attempted |
| `delivered` | Successfully delivered to all matching endpoints |
| `failed` | All delivery attempts failed (dead-lettered) |
| `partial` | Delivered to some endpoints; others failed |

## Ingest

Send any JSON payload to the ingest URL for an endpoint:

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Event-Type: order.created" \
  -d '{"order_id": "ord_123", "amount": 49.99, "currency": "USD"}'
```

Hookwing returns `202 Accepted` immediately. Processing is asynchronous.

Optional ingest headers:

| Header | Description |
|--------|-------------|
| `X-Event-Type` | Event type for routing and filtering |
| `X-Hookwing-Idempotency-Key` | Prevents duplicate events (24-hour window) |

## List Events

```bash
curl https://api.hookwing.com/v1/events \
  -H "Authorization: Bearer hk_live_your_key"
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default 20, max 100) |
| `cursor` | string | Pagination cursor from previous response |
| `eventType` | string | Filter by event type |
| `since` | number | Only events after this Unix timestamp (ms) |
| `status` | string | Filter: `pending`, `delivered`, `failed`, `partial` |

Response:

```json
{
  "events": [
    {
      "id": "evt_abc123",
      "eventType": "order.created",
      "status": "delivered",
      "receivedAt": 1774000000000,
      "deliveredAt": 1774000001000
    }
  ],
  "cursor": "evt_abc123",
  "hasMore": false
}
```

## Get Event

```bash
curl https://api.hookwing.com/v1/events/evt_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns the full event object including payload and headers.

## Replay Event

Re-deliver an event to all currently matching endpoints. Creates new delivery attempts — does not retry old failed deliveries.

```bash
curl -X POST https://api.hookwing.com/v1/events/evt_abc123/replay \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "replayed": true,
  "deliveryCount": 2
}
```

Replay requires the `events:write` scope.

## Required Scopes

| Operation | Scope |
|-----------|-------|
| List and view events | `events:read` |
| Replay events | `events:write` |
| Ingest (no auth required) | — |
