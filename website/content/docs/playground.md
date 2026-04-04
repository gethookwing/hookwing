---
title: "Playground"
slug: "playground"
summary: "Test webhooks without creating an account. Send, receive, and inspect events in a temporary sandbox environment."
updatedAt: "2026-04-03"
---

## Overview

The Hookwing Playground at [hookwing.com/playground](/playground/) lets you test webhook delivery without signing up. It creates a temporary workspace with a real endpoint — you can send events, watch deliveries in real time, and inspect payloads.

Playground sessions last **1 hour** and are automatically cleaned up after expiration.

## How It Works

1. **Create a session** — Hookwing provisions a temporary workspace and endpoint
2. **Send events** — POST JSON payloads to the session's ingest URL
3. **Watch deliveries** — See events arrive and deliveries succeed or fail
4. **Inspect payloads** — View full request/response bodies for each delivery

## API Reference

### Create a Playground Session

```bash
curl -X POST https://api.hookwing.com/v1/playground/sessions \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-test-endpoint.com/webhooks"}'
```

No authentication required. Rate limited to 10 sessions per minute per IP.

Response:

```json
{
  "sessionId": "pg_abc123",
  "ingestUrl": "https://api.hookwing.com/v1/ingest/ep_xyz789",
  "endpointId": "ep_xyz789",
  "expiresAt": 1774003600000,
  "secret": "X-Playground-Secret-header-value"
}
```

Use the `secret` value in the `X-Playground-Secret` header to access session data.

### Send a Test Event

Use the `ingestUrl` from the session response:

```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_xyz789 \
  -H "Content-Type: application/json" \
  -H "X-Event-Type: test.event" \
  -d '{"message": "Hello from the playground!"}'
```

### View Session Events

```bash
curl https://api.hookwing.com/v1/playground/sessions/pg_abc123/events \
  -H "X-Playground-Secret: your-session-secret"
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | number | Only events after this Unix timestamp (ms) |
| `limit` | number | Max results (default 50) |

### Send a Test Delivery

Trigger a test delivery to verify your endpoint is reachable:

```bash
curl -X POST https://api.hookwing.com/v1/playground/sessions/pg_abc123/test \
  -H "X-Playground-Secret: your-session-secret"
```

This sends a test event and immediately attempts delivery, returning the delivery result.

## Session Limits

| Constraint | Value |
|------------|-------|
| Session duration | 1 hour |
| Events per session | Subject to Paper Plane tier limits |
| Payload size | 64 KB |
| Sessions per minute (per IP) | 10 |

## When to Use the Playground

- **Evaluating Hookwing** — try it before committing to an account
- **Quick tests** — verify a webhook handler works without touching production
- **Demos** — show webhook delivery in action
- **CI/CD** — spin up a temporary session for integration tests

For production use, [create an account](/docs/getting-started/) to get persistent endpoints, retry handling, and full API access.
