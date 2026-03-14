---
title: "Webhook Fan-out: How to Deliver One Event to Many Endpoints"
slug: "webhook-fan-out"
description: "One incoming event, multiple consumers. Here's how webhook fan-out works, when you need it, and the patterns that hold up in production."
author: "james-wright"
publishDate: "2026-03-14T00:00:00.000Z"
updatedDate: "2026-03-14T00:00:00.000Z"
tags: ["webhooks", "architecture", "fan-out", "agents", "routing"]
category: "Architecture"
readingTime: "7 min read"
heroImage: "/assets/blog/generated/webhook-fan-out-hero.png"
heroImageAlt: "Dark aviation-themed illustration showing a single webhook event branching out to multiple endpoint nodes in parallel"
draft: false
---

## In short

- Fan-out means one incoming event delivered reliably to multiple consumers.
- Doing this inside a single handler is the obvious approach and the fragile one.
- Synchronous fan-out blocks on the slowest endpoint. Async fan-out is safer but adds complexity.
- A routing layer handles fan-out, retries, and failure isolation per consumer so your handler does not have to.
- Agent fleets make this pattern essential: each agent needs its own delivery, its own retry cycle, its own dead-letter queue.

---

Most webhook tutorials cover the simple case. Event arrives, handler runs, done. One sender, one consumer, one endpoint.

Production systems are rarely that clean. A `payment.completed` event might need to reach your billing service, a Slack notification bot, an analytics pipeline, and two agents running fraud detection and customer onboarding in parallel. The event is the same. The consumers are independent. Each one needs reliable delivery even when the others are down.

That is the fan-out problem.

---

## 1. The naive approach and why it breaks

The obvious solution is a single handler that loops over a list of endpoints and POSTes to each one.

```python
@app.post("/webhooks")
async def receive(request: Request):
    payload = await request.json()
    
    endpoints = [
        "https://billing.internal/hooks",
        "https://analytics.internal/hooks",
        "https://agent-fraud.internal/hooks",
        "https://agent-onboarding.internal/hooks",
    ]
    
    for url in endpoints:
        requests.post(url, json=payload)  # danger
    
    return {"ok": True}
```

This has several problems that compound under load.

**It's synchronous and sequential.** If `billing.internal` takes 800ms, every downstream consumer waits. If it times out entirely, the loop stalls. The webhook sender is waiting for your 200 response the whole time. Most senders time out after 5-30 seconds and mark the delivery failed.

**One failure affects all consumers.** If analytics is down, fraud detection and onboarding do not get the event either. Failure should be isolated per consumer, not shared.

**No retry logic.** If any endpoint returns a 500, you either swallow the error or retry the entire fan-out. There is no per-consumer retry cycle.

**No observability.** You know the event arrived. You do not know whether any of the four consumers processed it successfully.

---

## 2. Async fan-out: better, but not free

The first improvement is making fan-out asynchronous. Acknowledge the incoming webhook immediately, then deliver to consumers in the background.

```python
from fastapi import BackgroundTasks

@app.post("/webhooks")
async def receive(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    background_tasks.add_task(fan_out, payload)
    return {"ok": True}  # acknowledge fast

async def fan_out(payload: dict):
    endpoints = [...]
    tasks = [deliver(url, payload) for url in endpoints]
    await asyncio.gather(*tasks, return_exceptions=True)

async def deliver(url: str, payload: dict):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=10)
    except Exception as e:
        # log and move on: no retry, no DLQ
        logger.error(f"Delivery failed to {url}: {e}")
```

This is meaningfully better. The sender gets a fast 200. Consumers are hit in parallel, not sequentially. One failure does not block the others.

What it still does not solve: retries, dead-letter queues, per-consumer failure tracking, and delivery guarantees. If `agent-fraud.internal` is down during the async delivery window, that event is gone.

![Async fan-out flow: event arrives, handler acknowledges immediately, background tasks deliver in parallel to four consumer endpoints](/assets/blog/generated/webhook-fan-out-flow.png)

---

## 3. What production fan-out actually needs

Once you move past the prototype, the requirements sharpen:

**Per-consumer retry cycles.** If consumer A fails, it should be retried independently of consumers B, C, and D. A shared retry means consumers that succeeded get duplicate deliveries.

**Failure isolation.** A broken consumer should not block or affect delivery to healthy ones.

**Dead-letter queues per consumer.** When retries are exhausted for consumer A, its events should land in a [dead-letter queue](/blog/webhook-dead-letter-queues/) specific to that consumer, not a shared queue where failures are indistinguishable.

**Delivery visibility.** You need to know, per consumer, whether an event was delivered, is in retry, or has failed permanently. That is what [delivery observability](/blog/webhook-monitoring-observability/) is for.

**Schema or filter routing.** Not every consumer needs every event type. `payment.failed` should reach fraud detection and billing, but probably not the onboarding agent.

Building all of this in-process is a real infrastructure project. Most teams start with the async loop, hit a production incident, and then look for a routing layer.

---

## 4. Fan-out with a routing layer

A webhook routing layer sits between the sender and your consumers. You give the sender one URL. The routing layer handles fan-out, retries, filtering, and dead-letter management per consumer.

```bash
# Register your fan-out endpoints with Hookwing
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://billing.internal/hooks", "events": ["payment.*"]}'

curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://agent-fraud.internal/hooks", "events": ["payment.failed"]}'

curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://agent-onboarding.internal/hooks", "events": ["payment.completed"]}'
```

Each endpoint gets its own delivery lifecycle. Retries for `agent-fraud` do not affect `billing`. If `agent-onboarding` goes into a dead-letter state, `agent-fraud` keeps receiving. Hookwing tracks delivery status per endpoint per event. You can query delivery state programmatically or see it in the dashboard.

Filter routing (`"events": ["payment.*"]`) means each consumer only receives the event types it cares about. No event type sprawl, no consumers processing irrelevant payloads.

---

## 5. Fan-out and agent fleets

Fan-out is particularly important when multiple agents are consuming the same event stream. Each agent is an independent consumer with its own processing logic, its own failure modes, and its own latency characteristics.

An onboarding agent and a fraud detection agent both triggered by `payment.completed` should never share a delivery path. If the fraud agent is slow, the onboarding agent should not wait. If the fraud agent fails, the onboarding agent should not be retried.

Agents can also [register their own endpoints at runtime](/blog/webhook-endpoint-for-ai-agents/) via the API. In a self-provisioning agent fleet, each agent bootstraps its own delivery pipeline on startup. No manual configuration, no shared endpoints. When it shuts down, it deregisters. The fan-out layer handles the rest.

This is the pattern that makes event-driven agent architectures work in practice. Not a single handler trying to be clever, but a routing layer that treats each consumer as a first-class delivery target with its own lifecycle.

---

## Fan-out is a routing problem

The event is yours to produce once. Reliable delivery to each consumer is a separate concern, and trying to solve it in application code produces systems that are fragile under the exact conditions that matter most: high load, partial failures, consumer downtime.

A routing layer keeps those concerns separate. Your handler acknowledges and moves on. Each consumer gets what it needs, when it can handle it, with a full recovery path when it cannot.

---

**Build reliable webhooks with Hookwing**

Hookwing handles fan-out, per-consumer retries, dead-letter queues, and delivery visibility. Your event routing holds up when things go wrong.

[Start free](https://hookwing.com). No 2FA, no CAPTCHA. Or jump to the [getting started guide](https://hookwing.com/getting-started) and [API docs](https://hookwing.com/docs).
