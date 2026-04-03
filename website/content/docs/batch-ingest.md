---
title: "Batch Ingest"
slug: "batch-ingest"
summary: "Send up to 100 webhook events in a single API call for high-throughput ingestion."
updatedAt: "2026-04-03"
---

## Overview

The batch ingest endpoint lets you send up to 100 events in a single HTTP request. This is ideal for:

- **Migrating events** from another webhook provider
- **High-throughput sources** that generate many events per second
- **Replay scenarios** where you need to re-inject a batch of events
- **Testing** with realistic event volumes

No authentication required — like single-event ingest, batch ingest uses the endpoint ID in the URL.

## Send a Batch

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc123/batch \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "eventType": "order.created",
        "payload": {"order_id": "ord_001", "amount": 49.99}
      },
      {
        "eventType": "order.created",
        "payload": {"order_id": "ord_002", "amount": 129.00}
      },
      {
        "eventType": "payment.succeeded",
        "payload": {"payment_id": "pay_001", "amount": 49.99}
      }
    ]
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `events` | array | Yes | Array of event objects (1–100 items) |
| `events[].eventType` | string | No | Event type for routing and filtering (defaults to `"unknown"`) |
| `events[].payload` | any | Yes | The event payload (any valid JSON) |
| `events[].headers` | object | No | Additional headers to store with the event |

### Response

Each event in the batch is processed independently. The response includes the status of each:

```json
{
  "results": [
    {"eventId": "evt_abc001", "status": "accepted"},
    {"eventId": "evt_abc002", "status": "accepted"},
    {"eventId": "", "status": "error", "error": "Payload too large (max 65536 bytes)"}
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | string | Generated event ID (empty string if error) |
| `status` | string | `accepted` or `error` |
| `error` | string | Error message if this event failed validation |

## Limits

| Constraint | Value |
|------------|-------|
| Max events per batch | 100 |
| Max payload size per event | Tier-dependent (64 KB default) |
| Rate limiting | Same as single ingest |

Events that exceed the payload size limit are rejected individually — the rest of the batch still processes normally.

## Batch vs. Single Ingest

| Feature | Single Ingest | Batch Ingest |
|---------|--------------|--------------|
| URL | `POST /v1/ingest/:id` | `POST /v1/ingest/:id/batch` |
| Events per request | 1 | 1–100 |
| Idempotency key | Supported | Not supported |
| Custom headers per event | Via HTTP headers | Via `headers` field in body |
| Response | `202 Accepted` | Per-event status array |

## Fan-Out Behavior

Each event in a batch is processed like a single ingest event — it fans out to all matching endpoints based on event type filters. A batch of 10 events delivered to 3 matching endpoints results in 30 delivery attempts.
