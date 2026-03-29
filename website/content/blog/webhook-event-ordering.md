---
title: "Webhook event ordering: why it's not guaranteed, and how to handle it"
slug: "webhook-event-ordering"
description: "Webhooks make no ordering guarantees. Here's why events arrive out of sequence, what breaks when they do, and three receiver-side patterns that handle it correctly."
author: "sarah-kumar"
publishDate: "2026-03-26T00:00:00.000Z"
updatedDate: "2026-03-26T00:00:00.000Z"
tags: ["reliability", "webhooks", "idempotency", "event-handling"]
category: "Reliability"
readingTime: "6 min read"
heroImage: "/assets/blog/optimized/generated/webhooks-for-ai-agents-hero.webp"
heroImageAlt: "Diagram showing webhook events arriving out of sequence at a receiver endpoint"
draft: false
---

## In short

- Webhooks are delivered over HTTP, and HTTP makes no ordering guarantees
- Parallel retries, CDN routing, and network jitter mean events regularly arrive out of sequence
- Trusting the delivery order causes subtle state corruption — usually in production, not in tests
- The fix is receiver-side: design your handler to be order-independent, not order-dependent

---

Every webhook receiver hits this eventually. A `payment.completed` event lands before `payment.created`. A `user.deleted` arrives before `user.updated`. You debug it, confirm it wasn't a provider bug, and realise the events were sent in the right order — they just arrived in the wrong one.

This is expected behavior. The fix is not on the sender side.

## 1. Why ordering breaks

HTTP delivery is stateless and connectionless. Each webhook event is an independent POST request. The sender fires them in sequence, but the network doesn't preserve that sequence.

Several things disrupt order in practice:

- **Parallel retries.** A failed `event.created` gets retried while `event.updated` is already in flight. The retry may land after the update.
- **CDN and load balancer routing.** Two events from the same source can take different network paths with different latencies.
- **Network jitter.** Under load, a 50ms difference in delivery time is enough to invert two events.
- **Clock skew.** The sender system's `created_at` timestamp reflects when the event was generated, not when it was delivered. Two events created within the same second may arrive in any order.

Real-world examples: Stripe's `invoice.created` arriving after `invoice.paid`. GitHub's `push` event arriving after `pull_request.closed`. These aren't edge cases — they're documented behaviors from major providers.

## 2. The wrong fixes

Most teams try one of these first:

**Sleep before processing.** Adding a delay ("wait 100ms, then process") creates a race condition with a longer timeout. It helps in development and fails under production load.

**Trust `created_at` timestamps.** Provider timestamps reflect generation time, not delivery time. Clock skew between sender services makes them soft at best, misleading at worst.

**Process events synchronously in receipt order.** This only works with a single delivery thread. Most production setups use concurrent consumers — so events processed "in order" by thread still interleave by arrival time.

**Ignore it and hope.** Works until it doesn't. When it breaks, the failure is usually a subtle state inconsistency rather than a clear error, which makes it hard to detect and hard to roll back.

## 3. Pattern A — design for order-independence

The most durable fix: write handlers that produce the same result regardless of the order events arrive.

Two properties matter here:

**Idempotency** — processing the same event twice has no additional effect. This is a prerequisite for any reliable webhook handler. See the [webhook idempotency checklist](/blog/webhook-idempotency-checklist/) for implementation details.

**Commutativity** — processing events in any order produces the same final state. This is harder to achieve, but it's the goal.

In practice, the way to get there is to store state as a snapshot rather than a delta. If you're applying incremental updates (`quantity += 1`), an out-of-order event corrupts the total. If you're storing the full current state from each event payload, an out-of-order event simply overwrites with stale data — which you can guard against.

## 4. Pattern B — sequence IDs and version guards

Some providers include a `sequence` field, a `version` integer, or a monotonic counter per resource. When they do, use it.

The pattern:

1. On receipt, compare `incoming_sequence` to the `stored_sequence` for that resource
2. If `incoming_sequence > stored_sequence`: apply the event, update stored sequence
3. If not: discard (you already have newer state) or re-queue with a short delay

```typescript
async function handleWebhook(event: WebhookEvent) {
  const stored = await db.get(`resource:${event.resource_id}`);

  if (stored && event.sequence <= stored.sequence) {
    // Stale event — discard
    return;
  }

  await db.set(`resource:${event.resource_id}`, {
    ...event.data,
    sequence: event.sequence,
  });
}
```

This works well for resource state updates — user profiles, order statuses, account balances — where only the latest version matters.

## 5. Pattern C — fetch-on-receive

Instead of trusting the webhook payload, use the event as a trigger only.

On receipt: call the provider API to fetch the current state of the resource. Ignore the payload entirely.

```typescript
async function handleWebhook(event: WebhookEvent) {
  // Use event only as a trigger
  const current = await providerApi.getResource(event.resource_id);
  await db.set(`resource:${event.resource_id}`, current);
}
```

This eliminates the ordering problem entirely. The payload may be stale or out of order — it doesn't matter, because you always fetch the latest version.

The trade-off: one synchronous API call per event. This adds latency, consumes API quota, and fails if the provider API is slow or rate-limiting you.

Use this pattern for high-value state where eventual consistency is unacceptable — payment confirmations, permission changes, account status updates.

## 6. When ordering actually matters

Order-independence isn't always possible. Some event sequences encode irreversible operations that must be applied in the right sequence:

- Financial ledger entries
- Audit log chains
- Multi-step workflow transitions

For these, serialize processing per resource ID using a queue. Assign events to a queue partition by resource ID, and process each partition with a single consumer. Events for the same resource are processed in arrival order; different resources process in parallel.

```
Event A (resource: order-123)  → Queue partition: order-123 → Consumer 1
Event B (resource: order-456)  → Queue partition: order-456 → Consumer 2
Event C (resource: order-123)  → Queue partition: order-123 → Consumer 1 (after A)
```

A [dead letter queue](/blog/webhook-dead-letter-queues/) gives you a recovery path when events fail after correct ordering — without losing the sequence guarantee you've set up.

For retry behavior inside this queue, standard [exponential backoff patterns](/blog/webhook-retry-best-practices/) apply.

## Conclusion

Most webhook ordering problems are receiver-side problems, not sender-side failures. Providers don't guarantee delivery order, and building a receiver that depends on it is brittle by design.

The durable approach: make handlers idempotent and order-independent by default. Add sequence guards when providers supply them. Use fetch-on-receive for high-stakes state. Reserve queue-based serialization for genuinely irreversible event chains.

---

**Build reliable webhooks with Hookwing**

Hookwing helps you receive, route, retry, and monitor webhook events with clear delivery visibility and production-safe recovery workflows.

[Start free](https://hookwing.com/signup/) and ship faster with confidence.
