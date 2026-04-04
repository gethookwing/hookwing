---
title: "Dead Letter Queue"
slug: "dead-letter-queue"
summary: "Inspect, replay, and manage failed webhook deliveries that exhausted all retry attempts."
updatedAt: "2026-04-03"
---

## What is the Dead Letter Queue?

When a webhook delivery fails all 6 retry attempts, Hookwing moves it to the Dead Letter Queue (DLQ). The DLQ gives you full visibility into what went wrong and tools to replay or dismiss failed deliveries.

**Available on Warbird ($19/mo) and above.** Paper Plane (free) does not include the DLQ.

## DLQ Item Object

Each DLQ entry represents one delivery that exhausted all retries.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique DLQ item ID |
| `workspaceId` | string | Workspace that owns this item |
| `eventId` | string | The original event |
| `endpointId` | string | The endpoint that failed to receive the delivery |
| `deliveryId` | string | The failed delivery attempt |
| `errorMessage` | string | Last error message from the failed delivery |
| `attempts` | number | Total delivery attempts made (typically 6) |
| `status` | string | `pending`, `replayed`, or `dismissed` |
| `createdAt` | number | Unix timestamp (ms) when item entered the DLQ |
| `replayedAt` | number | Unix timestamp (ms) when replayed, or `null` |

## List DLQ Items

```bash
curl https://api.hookwing.com/v1/dead-letter \
  -H "Authorization: Bearer hk_live_your_key"
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default 50, max 100) |
| `offset` | number | Pagination offset (default 0) |
| `status` | string | Filter: `pending`, `replayed` |

Response:

```json
{
  "deadLetterItems": [
    {
      "id": "dlq_abc123",
      "eventId": "evt_xyz789",
      "endpointId": "ep_def456",
      "deliveryId": "del_ghi012",
      "errorMessage": "Connection refused",
      "attempts": 6,
      "status": "pending",
      "createdAt": 1774000000000,
      "replayedAt": null
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 12
  }
}
```

## Get DLQ Item

Retrieve a single DLQ item with full context — includes the related delivery, endpoint, and event details.

```bash
curl https://api.hookwing.com/v1/dead-letter/dlq_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "id": "dlq_abc123",
  "eventId": "evt_xyz789",
  "endpointId": "ep_def456",
  "deliveryId": "del_ghi012",
  "errorMessage": "Connection refused",
  "attempts": 6,
  "status": "pending",
  "createdAt": 1774000000000,
  "replayedAt": null,
  "delivery": {
    "id": "del_ghi012",
    "status": "dead_lettered",
    "responseStatusCode": null,
    "errorMessage": "Connection refused",
    "attemptNumber": 6
  },
  "endpoint": {
    "id": "ep_def456",
    "url": "https://your-app.com/webhooks",
    "description": "Production webhooks"
  },
  "event": {
    "id": "evt_xyz789",
    "eventType": "order.created",
    "receivedAt": 1773990000000
  }
}
```

## Replay a DLQ Item

Re-queue a failed delivery for a fresh attempt. The delivery starts from attempt 1 with a new retry cycle.

```bash
curl -X POST https://api.hookwing.com/v1/dead-letter/dlq_abc123/replay \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "message": "Delivery queued for replay",
  "itemId": "dlq_abc123",
  "deliveryId": "del_ghi012"
}
```

Items that have already been replayed cannot be replayed again — the API returns `400`.

## Dismiss a DLQ Item

Remove a DLQ item you've investigated and don't need to replay:

```bash
curl -X DELETE https://api.hookwing.com/v1/dead-letter/dlq_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns `200` with confirmation. This is permanent — dismissed items cannot be recovered.

## Common DLQ Scenarios

### Endpoint was temporarily down

Your server had an outage during all 6 retry windows (~8.5 hours total). Fix the issue, then replay the DLQ items.

### Wrong endpoint URL

A typo in the endpoint URL caused all deliveries to fail. Update the endpoint URL first, then replay the DLQ items — they'll deliver to the corrected URL.

### Payload too large for your server

Your server rejected the payload with a `413` status. Increase your server's request size limit, then replay.

## Required Scopes

| Operation | Scope |
|-----------|-------|
| List and view DLQ items | `deliveries:read` |
| Replay DLQ items | `events:write` |
| Dismiss DLQ items | `events:write` |
