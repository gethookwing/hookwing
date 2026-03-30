---
title: "How to build a webhook receiver for AI agents"
slug: "agent-webhook-receiver"
description: "The four design decisions that make a webhook receiver work for autonomous agents: fast ACK, async processing, typed routing, and API provisioning."
author: "alex-morgan"
publishDate: "2026-03-30T00:00:00.000Z"
updatedDate: "2026-03-30T00:00:00.000Z"
tags: ["webhooks", "ai-agents", "architecture", "tutorials", "getting-started"]
category: "Tutorials"
readingTime: "7 min read"
heroImage: "/assets/blog/generated/agent-webhook-receiver-hero.jpg"
heroImageAlt: "Dark technical diagram showing an agent-ready webhook receiver with fast acknowledgment, async queue, and event routing to agent handlers"
draft: false
---

## In short

- Most webhook receivers are built around a human review loop: log the event, send a notification, wait for someone to act.
- An agent-ready receiver is different. It acknowledges in milliseconds, routes events to the right handler, and provisions itself without a dashboard.
- The four decisions that matter: sub-200ms acknowledgment, async processing, typed event routing, and API-provisioned endpoints.
- Get these right and the receiver becomes invisible. The agent just reacts.

---

A webhook receiver is not complicated to build. A webhook receiver that works well for autonomous agents requires a few specific decisions that most tutorials skip over.

The difference is the consumer. When a human is reading the logs, it is fine for the handler to do a bunch of work synchronously, send a Slack message, and write to a spreadsheet. When an agent is the consumer, it needs structured input it can act on, reliably, without a human checking whether anything went wrong.

These are the four decisions that shape the design.

---

## 1. Acknowledge fast: always

The first rule is not new, but agents make it more important. Webhook senders have delivery timeout windows, typically between 3 and 30 seconds depending on the provider. If your handler does meaningful work before returning a response, you will eventually timeout under load and trigger a retry storm.

Return 200 immediately. Do the work in the background.

```python
from fastapi import FastAPI, Request, BackgroundTasks, Response
import json

app = FastAPI()

@app.post("/hooks")
async def receive(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()

    if not verify_signature(raw_body, request.headers):
        return Response(status_code=401)

    payload = json.loads(raw_body)
    background_tasks.add_task(process_event, payload)
    return Response(status_code=200)
```

The handler does three things: verify the signature, enqueue the payload, return 200. Nothing else. The agent logic lives in `process_event`, which runs after the response is sent.

For higher-volume receivers, replace `BackgroundTasks` with a proper queue: Redis, SQS, or any broker that gives you durability and retry on the worker side. The pattern is the same: decouple receipt from processing.

See [webhook retry best practices](/blog/webhook-retry-best-practices/) for how retry storms develop and why fast acknowledgment is part of the reliability story, not just a performance concern.

---

## 2. Process idempotently in the background

The queue worker is where agent logic lives. One design requirement that matters more for agents than for human-facing systems: the worker must be idempotent. If the same event is delivered twice (because the sender retried after a slow response, or because your queue replayed it), the outcome should be identical.

The standard approach: use the event ID as a deduplication key.

```python
import redis

r = redis.Redis()

async def process_event(payload: dict):
    event_id = payload.get("id")
    if not event_id:
        return  # nothing to deduplicate on: skip

    key = f"processed:{event_id}"
    if r.exists(key):
        return  # already handled

    r.setex(key, 86400, "1")  # mark as processed, expire after 24h

    await route_event(payload["type"], payload)
```

This is a thin guard. It does not need to be clever. The webhook [idempotency checklist](/blog/webhook-idempotency-checklist/) covers more complex cases: state transitions, partial failures, and when the deduplication window matters.

---

## 3. Route by event type, not by handler logic

A generic `on_webhook` handler that branches on `if event_type == ...` works fine at small scale. It becomes a maintenance problem as the number of event types grows, and it makes it harder to reason about what the agent actually does in response to each trigger.

A route table is cleaner.

```python
from typing import Callable

async def handle_payment_completed(payload: dict):
    customer_id = payload["data"]["customer_id"]
    await trigger_fulfillment_agent(customer_id, payload)

async def handle_subscription_cancelled(payload: dict):
    customer_id = payload["data"]["customer_id"]
    await trigger_churn_workflow(customer_id, payload)

async def handle_unknown(payload: dict):
    pass  # log and discard: providers add types without notice

ROUTES: dict[str, Callable] = {
    "payment.completed": handle_payment_completed,
    "subscription.cancelled": handle_subscription_cancelled,
}

async def route_event(event_type: str, payload: dict):
    handler = ROUTES.get(event_type, handle_unknown)
    await handler(payload)
```

The default handler for unknown types is important. Providers add new event types in their own release cycles. A receiver that errors on unknown types will start failing silently the moment an upstream provider ships a new event. Discard what you do not recognize. Do not crash.

For receivers that need to deliver the same event to multiple independent agent handlers, see the [fan-out patterns article](/blog/webhook-fan-out/). The routing table above is the single-consumer version.

---

## 4. Provision the endpoint via API

An agent that needs a human to click "Create endpoint" in a dashboard before it can start working is not fully autonomous.

Hookwing provisions endpoints via a single API call. The agent can do this at boot, register with the upstream provider, and start receiving events. No manual setup, no CAPTCHA, no 2FA.

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-agent.example.com/hooks",
    "events": ["payment.completed", "subscription.cancelled"],
    "description": "Fulfillment agent receiver"
  }'
```

The response includes the endpoint ID and a signing secret. The agent stores both. When it shuts down, it can DELETE the endpoint. When it scales out, each instance can provision its own.

This is the part of the receiver design that most tutorials leave as a manual step. If you are building agents that need to operate without human intervention, the provisioning step needs to be in the code, not in a setup guide.

The [agent endpoint guide](/blog/webhook-endpoint-for-ai-agents/) covers this in more detail, including how to handle the signing secret lifecycle and local development with tunnels.

---

## Signature verification belongs in the receiver

One thing that cuts across all four sections: signature verification is not optional for an agent receiver. A receiver that processes unverified payloads can be triggered by anyone with the URL. For a human-facing system, that might mean a spurious log entry. For an agent, it could mean triggering a fulfillment workflow, a billing action, or a state change from a spoofed event.

Verify before you enqueue. Reject with a 401 and move on.

The full implementation is in the [signature verification guide](/blog/webhook-signature-verification/), including the three mistakes that break it silently: parsing JSON before reading raw bytes, string comparison instead of constant-time compare, and header name mismatches.

---

## The receiver is infrastructure, not logic

The four decisions above (fast ACK, idempotent processing, typed routing, API provisioning) are infrastructure concerns. They do not depend on what the agent does. They are the same whether the agent is handling payments, monitoring deployments, or responding to sensor data.

Getting them right means the receiver becomes invisible. Events arrive, the agent acts, failures are handled by the retry and DLQ layer. The agent code stays focused on what it is supposed to do.

---

**Build reliable webhooks with Hookwing**

Hookwing handles delivery, retries, dead-letter queues, and observability. Your agent receiver stays focused on routing and action.

[Start free](https://hookwing.com). No 2FA, no CAPTCHA. Or jump straight to the [getting started guide](https://hookwing.com/getting-started) and [API docs](https://hookwing.com/docs).
