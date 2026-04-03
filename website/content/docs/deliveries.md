---
title: "Deliveries"
slug: "deliveries"
summary: "Delivery object schema, status reference, retry schedule, dead-letter queue, and API for inspecting delivery attempts."
updatedAt: "2026-04-02"
---

## The Delivery Object

A delivery represents one HTTP request attempt from Hookwing to a webhook endpoint.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique delivery ID (`del_...`) |
| `eventId` | string | The event being delivered |
| `endpointId` | string | The target endpoint |
| `status` | string | Current delivery status |
| `statusCode` | number | HTTP status returned by your server (or `null`) |
| `requestBody` | string | The JSON body Hookwing sent |
| `responseBody` | string | The response body from your server |
| `responseHeaders` | object | Response headers from your server |
| `attemptNumber` | number | Which retry attempt (1–6) |
| `nextRetryAt` | number | Unix timestamp (ms) of next retry, or `null` |
| `createdAt` | number | Unix timestamp (ms) when attempt was made |
| `completedAt` | number | Unix timestamp (ms) when attempt completed |
| `isReplay` | boolean | Whether triggered by a manual replay |

### Delivery Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Queued, not yet attempted |
| `attempting` | HTTP request in flight |
| `success` | Your server returned 2xx |
| `failed` | Non-2xx response or network error; will retry |
| `dead_lettered` | All 6 attempts exhausted; no more retries |

Hookwing considers any `2xx` response a success. Redirects are not followed.

## Retry Schedule

Failed deliveries are retried automatically with exponential backoff:

| Attempt | Delay after previous failure | Cumulative time |
|---------|------------------------------|-----------------|
| 1 | Immediate | 0 |
| 2 | 30 seconds | ~30s |
| 3 | 5 minutes | ~6m |
| 4 | 30 minutes | ~36m |
| 5 | 2 hours | ~2.5h |
| 6 | 6 hours | ~8.5h |

After attempt 6, the delivery is marked `dead_lettered`. Hookwing stops retrying.

## Dead-Letter Queue

On Warbird+ tiers, dead-lettered deliveries appear in the DLQ dashboard at `app.hookwing.com`. You can:

- Inspect the full request and response for each failed attempt
- Replay individual deliveries manually
- Bulk replay all DLQ events for an endpoint

> Dead-lettered events can also be replayed via the API using the event replay endpoint.

## List Deliveries

```bash
curl https://api.hookwing.com/v1/deliveries \
  -H "Authorization: Bearer hk_live_your_key"
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default 20, max 100) |
| `cursor` | string | Pagination cursor |
| `eventId` | string | Filter by event |
| `endpointId` | string | Filter by endpoint |
| `status` | string | Filter: `pending`, `attempting`, `success`, `failed`, `dead_lettered` |

Response:

```json
{
  "deliveries": [
    {
      "id": "del_xyz789",
      "eventId": "evt_abc123",
      "endpointId": "ep_def456",
      "status": "success",
      "statusCode": 200,
      "attemptNumber": 1,
      "createdAt": 1774000001000,
      "completedAt": 1774000001250
    }
  ],
  "cursor": "del_xyz789",
  "hasMore": false
}
```

## Get Delivery

```bash
curl https://api.hookwing.com/v1/deliveries/del_xyz789 \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns the full delivery object including `requestBody`, `responseBody`, and `responseHeaders`.

## Required Scopes

| Operation | Scope |
|-----------|-------|
| List and view deliveries | `deliveries:read` |
