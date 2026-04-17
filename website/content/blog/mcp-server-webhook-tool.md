---
title: "How to add a webhook tool to your MCP server"
slug: "mcp-server-webhook-tool"
description: "MCP tools are synchronous, but real-world agent workflows run on async events. Here's how to add a webhook tool to your MCP server so agents can listen without polling."
author: "alex-morgan"
publishDate: "2026-03-21T00:00:00.000Z"
updatedDate: "2026-03-21T00:00:00.000Z"
tags: ["mcp", "webhooks", "ai-agents", "tutorials", "async"]
category: "Tutorials"
readingTime: "7 min read"
heroImage: "/assets/blog/optimized/generated/mcp-server-webhook-tool-hero.webp"
heroImageAlt: "An MCP server exposing a webhook tool that lets an AI agent register an endpoint and receive async events from external systems"
draft: false
---


## In short

- MCP tools are synchronous, but most real-world agent workflows depend on async events
- A webhook tool lets your agent self-provision a listener endpoint without any human setup
- The pattern is three tools: `register_webhook`, `poll_events`, and optionally `ack_event`
- For production, the endpoint needs a stable public URL; ephemeral deployments break webhook registrations

---

## 1. The sync/async gap in MCP

Most MCP tools follow a simple pattern: the agent calls a tool, the server returns a result, the agent continues. That works well for queries, lookups, and actions that complete immediately.

It breaks down as soon as you need to wait for something external.

Say your agent kicks off a CI build, processes a payment, or triggers a data export job. The response isn't immediate. It comes back minutes or hours later via a webhook. With standard MCP tools, your options are polling (call a `check_status` tool on a loop) or blocking the session until the result arrives. Neither is good. Polling burns tool call budget and adds latency. Blocking is often not possible at all.

Webhook tools solve this by letting the agent register an endpoint, hand that URL to the provider, and come back when there's something to process. The agent doesn't wait. It just checks for events on its next turn.

---

## 2. The three-tool pattern

A minimal webhook integration needs three MCP tools:

**`register_webhook`** provisions an endpoint. Returns a URL and a signing secret. The agent passes the URL to whichever external service should send events.

**`poll_events`** drains any events that have arrived since the last call. Returns an array of event objects. The agent processes them and moves on.

**`ack_event`** is optional but useful. The agent acknowledges processed events so they're not returned again on the next poll. Keeps the queue clean.

```ts
// Tool schemas (simplified)
{
  name: "register_webhook",
  description: "Provision a webhook endpoint. Returns a URL and signing secret.",
  inputSchema: {
    type: "object",
    properties: {
      label: { type: "string", description: "Identifier for this registration" }
    }
  }
}

{
  name: "poll_events",
  description: "Return pending webhook events for this session.",
  inputSchema: { type: "object", properties: {} }
}

{
  name: "ack_event",
  description: "Acknowledge a processed event by ID.",
  inputSchema: {
    type: "object",
    properties: {
      event_id: { type: "string" }
    },
    required: ["event_id"]
  }
}
```

From the agent's perspective, the flow is clean: call `register_webhook`, get a URL, hand it to Stripe or GitHub or wherever, then call `poll_events` on the next turn to see what came in.

![Flow diagram, agent calls register_webhook → MCP server provisions URL → external provider posts event → server queues it → agent calls poll_events → agent acts](/assets/blog/generated/mcp-server-webhook-tool-flow.png)

---

## 3. Wiring up the HTTP endpoint

On the server side, you need an Express (or equivalent) handler that receives incoming POSTs, validates the signature, and queues the event.

Signature validation is non-negotiable. Without it, anyone who discovers your endpoint URL can POST arbitrary events and trigger your agent. The standard approach is HMAC-SHA256: generate a secret per registration, include it in the `register_webhook` response, and validate every incoming payload against it.

```ts
import crypto from 'crypto';
import express from 'express';

const app = express();
app.use(express.raw({ type: 'application/json' }));

// In-memory store, swap for Redis/Postgres in production
const registrations = new Map<string, { secret: string }>();
const eventQueue: Record<string, any[]> = {};

app.post('/webhook/:label', (req, res) => {
  const { label } = req.params;
  const reg = registrations.get(label);

  if (!reg) return res.status(404).send('Unknown endpoint');

  // Validate signature
  const sig = req.headers['x-webhook-signature'] as string;
  const expected = crypto
    .createHmac('sha256', reg.secret)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig ?? ''), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  // Enqueue the event
  if (!eventQueue[label]) eventQueue[label] = [];
  eventQueue[label].push({
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    payload: JSON.parse(req.body.toString()),
  });

  res.status(200).send('ok');
});
```

Return 200 immediately. Processing happens when the agent calls `poll_events`, not here. Keeping ingestion fast prevents providers from timing out and retrying.

For a deeper look at signature validation patterns and the mistakes that break them silently, the [webhook signature verification guide](/blog/webhook-signature-verification/) covers HMAC-SHA256 in detail.

---

## 4. Registering and polling as MCP tools

With the HTTP layer in place, the MCP tool implementations are straightforward:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import crypto from 'crypto';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });
const BASE_URL = process.env.WEBHOOK_BASE_URL; // e.g. https://your-server.com

server.tool('register_webhook', { label: z.string() }, async ({ label }) => {
  const secret = crypto.randomBytes(32).toString('hex');
  registrations.set(label, { secret });
  eventQueue[label] = [];

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        url: `${BASE_URL}/webhook/${label}`,
        secret,
      })
    }]
  };
});

server.tool('poll_events', {}, async () => {
  // Aggregate all queued events across registrations
  const all = Object.entries(eventQueue).flatMap(([label, events]) =>
    events.map(e => ({ ...e, label }))
  );

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(all)
    }]
  };
});

server.tool('ack_event', { event_id: z.string() }, async ({ event_id }) => {
  for (const label of Object.keys(eventQueue)) {
    eventQueue[label] = eventQueue[label].filter(e => e.id !== event_id);
  }
  return { content: [{ type: 'text', text: 'ok' }] };
});
```

The agent calls `register_webhook({ label: "stripe-payment" })`, gets back a URL and secret, registers them with Stripe, and from then on calls `poll_events` at the start of any session to see what's come in. No polling loop, no blocking. Just event-driven turns.

---

## 5. The stable URL problem

There's one infrastructure detail that catches people: your webhook endpoint needs a stable, publicly reachable URL.

In local development, that means using a tunnel (ngrok, Cloudflare Tunnel, or similar) to expose your local server. That's fine for testing.

In production, the problem is ephemeral deployments. If your MCP server runs as a serverless function or a container that restarts, its URL might change. External providers have already registered the old URL. Those events go nowhere, and the agent's `poll_events` calls come back empty.

The cleanest fix is a dedicated subdomain on a stable host. But if your MCP server is otherwise stateless, standing up persistent infra just to receive webhooks adds friction.

![Architecture diagram, two deployment scenarios: self-hosted with stable subdomain (left) vs. managed endpoint via Hookwing tool call (right)](/assets/blog/generated/mcp-server-webhook-tool-architecture.png)

The alternative is to offload the endpoint entirely. With Hookwing, the agent calls a single API to provision a persistent webhook URL. No server config, no DNS, no infra. The URL stays stable across deployments because it lives outside your server. Events queue in Hookwing until the agent drains them. It's the same three-tool pattern, but the endpoint management is handled for you.

For a broader look at how agents acquire webhook endpoints without manual setup, [How to Give Your AI Agent a Webhook Endpoint](/blog/webhook-endpoint-for-ai-agents/) walks through the full provisioning flow.

---

## 6. When this pattern fits

This approach is well-suited to a few specific scenarios:

- **Event-driven agent workflows:** anything where the agent needs to react to an external trigger rather than being invoked directly (CI completed, payment confirmed, form submitted)
- **Multi-agent pipelines:** one agent finishes a task and signals another via webhook rather than a direct session handoff
- **Long-running tasks:** the agent kicks off a job, returns, and comes back when the result is ready
- **IoT and real-time data:** sensor readings, device state changes, stream events that arrive continuously

It's worth being clear about what this isn't. SSE and streaming transports handle real-time communication *within* an active MCP session. This pattern is for *between-session* events: things that happen while the agent isn't running. The two complement each other rather than compete.

For the broader picture of how webhooks fit into agent architectures, [Webhooks Are How AI Agents Listen to the World](/blog/webhooks-for-ai-agents/) covers the foundational patterns.

---

## Conclusion

Adding a webhook tool to your MCP server closes the gap between synchronous tool calls and the async reality of most real-world integrations. Three tools, one HTTP handler, a stable URL. Your agent can react to anything without polling.

The implementation above is intentionally minimal. Swap the in-memory queue for Redis, add event TTLs, and wire in proper persistence for production use. The core pattern stays the same.

---

**Build reliable webhooks with Hookwing**
Hookwing helps you receive, route, retry, and monitor webhook events with clear delivery visibility and production-safe recovery workflows.
Start free and ship faster with confidence.
