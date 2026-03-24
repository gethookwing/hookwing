---
title: "Agent Integrations"
slug: "agent-integrations"
summary: "How AI agents and coding assistants integrate with Hookwing — MCP server, API self-provisioning, and programmatic management."
updatedAt: "2026-03-24"
---

## Hookwing for AI Agents

Hookwing is built for autonomous agents. No browser, no CAPTCHA, no human in the loop. Agents can create accounts, provision endpoints, manage billing, and inspect events — entirely via HTTP.

## MCP Server

Install the Hookwing MCP server to give your IDE (Claude Code, Cursor, Cline) full webhook capabilities:

```bash
npm install -g @hookwing/mcp
export HOOKWING_API_KEY=hk_live_your_key
hookwing-mcp
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_endpoints` | List all webhook endpoints |
| `create_endpoint` | Create a new endpoint |
| `get_endpoint` | Get endpoint details |
| `list_events` | List received events |
| `get_event` | Get event details with payload |
| `replay_event` | Replay a failed event |
| `get_deliveries` | List delivery attempts |

## Self-Provisioning via API

Agents can create their own infrastructure programmatically:

### 1. Create an account

```bash
curl -X POST https://api.hookwing.com/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "agent@your-org.com", "password": "secure-random-password"}'
```

The response includes an API key — the agent stores this for all future requests.

### 2. Create endpoints

```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://agent-server.internal/webhooks",
    "name": "stripe-listener",
    "eventTypes": ["payment_intent.succeeded", "charge.failed"]
  }'
```

### 3. Poll for events (no public URL needed)

Agents don't need a public endpoint. They can poll Hookwing for new events:

```bash
curl "https://api.hookwing.com/v1/events?limit=10" \
  -H "Authorization: Bearer $API_KEY"
```

### 4. Manage keys with scoped permissions

Create limited-scope keys for specific tasks:

```bash
curl -X POST https://api.hookwing.com/v1/auth/keys \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "read-only-monitor",
    "scopes": ["events:read", "deliveries:read", "analytics:read"]
  }'
```

## Machine-Readable Pricing

Agents can query pricing programmatically before making decisions:

```bash
curl https://api.hookwing.com/api/pricing
```

Returns JSON with all tiers, limits, and features — no scraping needed.

## Agent Code Examples

### Python agent setup

```python
import httpx

class HookwingAgent:
    def __init__(self, api_key: str):
        self.client = httpx.AsyncClient(
            base_url="https://api.hookwing.com",
            headers={"Authorization": f"Bearer {api_key}"}
        )

    async def setup(self, webhook_url: str):
        """Self-provision a webhook endpoint."""
        resp = await self.client.post("/v1/endpoints", json={
            "url": webhook_url,
            "name": "agent-managed",
        })
        return resp.json()

    async def poll_events(self, since: int = 0):
        """Poll for new events."""
        resp = await self.client.get(f"/v1/events?since={since}")
        return resp.json()["events"]
```

### Node.js agent setup

```javascript
const agent = {
  apiKey: process.env.HOOKWING_API_KEY,

  async provision(url) {
    const res = await fetch('https://api.hookwing.com/v1/endpoints', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, name: 'agent-endpoint' }),
    });
    return res.json();
  },

  async getEvents(since = 0) {
    const res = await fetch(`https://api.hookwing.com/v1/events?since=${since}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
    return (await res.json()).events;
  },
};
```

## Full API Reference

See the [API documentation](/docs/) and [interactive explorer](/docs/api/) for complete endpoint details.
