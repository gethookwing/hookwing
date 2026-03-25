---
name: hookwing
description: Manage webhooks via the Hookwing API. Create endpoints, ingest events, verify signatures, monitor deliveries, replay failed events.
metadata:
  openclaw:
    requires:
      bins: ["hookwing-mcp"]
    install:
      - id: mcp
        kind: node
        package: "@hookwing/mcp"
        bins: ["hookwing-mcp"]
        label: "Install Hookwing MCP server"
---

# Hookwing — Webhook Management Skill

## Description

Full webhook lifecycle management for AI coding agents. Hookwing provides webhook infrastructure that enables agents to receive, verify, and manage webhooks from any source — including GitHub, Stripe, Shopify, Slack, SendGrid, Twilio, and custom integrations.

## MCP Server

**Package:** `@hookwing/mcp`

The Hookwing MCP server exposes webhook management tools to AI agents via the Model Context Protocol.

### Available Tools

- `list_endpoints` — List all webhook endpoints in your workspace
- `create_endpoint` — Create a new webhook endpoint with a unique URL
- `get_endpoint` — Get details of a specific endpoint
- `update_endpoint` — Update endpoint configuration (URL, events, secret)
- `delete_endpoint` — Remove an endpoint
- `list_events` — List received webhook events with filtering
- `get_event` — Get full event details including payload
- `replay_event` — Re-deliver a failed event to the endpoint
- `get_deliveries` — List delivery attempts for an endpoint or event
- `get_delivery` — Get details of a specific delivery attempt
- `verify_signature` — Verify webhook payload signature (for manual verification)

### Configuration

The MCP server requires the following environment variables:

- `HOOKWING_API_KEY` — Your Hookwing API key (required)

## API Reference

### Base URL

```
https://api.hookwing.com
```

### Authentication

All requests require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-api-key>
```

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/endpoints` | List all endpoints |
| POST | `/v1/endpoints` | Create a new endpoint |
| GET | `/v1/endpoints/:id` | Get endpoint details |
| PATCH | `/v1/endpoints/:id` | Update endpoint |
| DELETE | `/v1/endpoints/:id` | Delete endpoint |
| GET | `/v1/events` | List received events |
| GET | `/v1/events/:id` | Get event details |
| POST | `/v1/events/:id/replay` | Replay failed event |
| GET | `/v1/deliveries` | List delivery attempts |
| POST | `/v1/verify` | Verify webhook signature |

### Webhook Payload Example

```json
{
  "id": "evt_abc123",
  "source": "github",
  "type": "push",
  "timestamp": "2026-03-25T12:00:00Z",
  "payload": {
    "ref": "refs/heads/main",
    "repository": {
      "name": "my-app",
      "full_name": "user/my-app"
    }
  },
  "deliveries": [
    {
      "id": "del_xyz789",
      "status": "success",
      "status_code": 200,
      "timestamp": "2026-03-25T12:00:01Z"
    }
  ]
}
```

## Use Cases

1. **Webhook Endpoint Management** — Create and manage webhook URLs for external services
2. **Event Processing** — Receive and process webhook events from integrated services
3. **Delivery Monitoring** — Track webhook delivery status and troubleshoot failures
4. **Event Replay** — Re-deliver failed events to fix delivery issues
5. **Signature Verification** — Verify webhook payloads are authentic

## Installation

```bash
npm install @hookwing/mcp
```

## Example Usage

```typescript
import { Client } from "@hookwing/mcp";

const client = new Client({
  apiKey: process.env.HOOKWING_API_KEY
});

// List all endpoints
const endpoints = await client.endpoints.list();

// Create a new endpoint
const endpoint = await client.endpoints.create({
  url: "https://your-server.com/webhooks",
  events: ["push", "pull_request"]
});

// Get event details
const event = await client.events.get("evt_abc123");

// Replay a failed event
await client.events.replay("evt_abc123");
```