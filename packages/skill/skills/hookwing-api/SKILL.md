# Hookwing API Skill

## Description
Manage webhook infrastructure via the Hookwing API. Create endpoints, ingest events, monitor deliveries, and manage API keys programmatically.

## When to Use
- Setting up webhook endpoints for a project
- Ingesting webhook events from external services
- Monitoring delivery status and failures
- Managing API keys and scopes
- Replaying failed events

## Authentication

All API requests use Bearer token authentication:

```bash
export HOOKWING_API_KEY=hk_live_your_key
```

```
Authorization: Bearer hk_live_your_key
```

## Endpoint Management

### Create an endpoint
```bash
curl -X POST https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer $HOOKWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "name": "production",
    "eventTypes": ["order.created", "payment.succeeded"]
  }'
```

### List endpoints
```bash
curl https://api.hookwing.com/v1/endpoints \
  -H "Authorization: Bearer $HOOKWING_API_KEY"
```

### Update endpoint
```bash
curl -X PATCH https://api.hookwing.com/v1/endpoints/ep_abc \
  -H "Authorization: Bearer $HOOKWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://new-url.com/webhooks"}'
```

### Delete endpoint
```bash
curl -X DELETE https://api.hookwing.com/v1/endpoints/ep_abc \
  -H "Authorization: Bearer $HOOKWING_API_KEY"
```

## Event Ingestion

### Send a single event
```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc \
  -H "Content-Type: application/json" \
  -H "X-Event-Type: order.created" \
  -d '{"order_id": "ord_123", "amount": 49.99}'
```

### Send a batch (up to 100 events)
```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc/batch \
  -H "Content-Type: application/json" \
  -d '{"events": [
    {"eventType": "order.created", "payload": {"id": "1"}},
    {"eventType": "order.created", "payload": {"id": "2"}}
  ]}'
```

### With idempotency key
```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc \
  -H "Idempotency-Key: unique-event-key-123" \
  -d '{"event": "order.created"}'
```

## Delivery Monitoring

### List events
```bash
curl "https://api.hookwing.com/v1/events?limit=10" \
  -H "Authorization: Bearer $HOOKWING_API_KEY"
```

### Check deliveries
```bash
curl https://api.hookwing.com/v1/deliveries \
  -H "Authorization: Bearer $HOOKWING_API_KEY"
```

### Replay a failed event
```bash
curl -X POST https://api.hookwing.com/v1/events/evt_abc/replay \
  -H "Authorization: Bearer $HOOKWING_API_KEY"
```

### Bulk replay
```bash
curl -X POST https://api.hookwing.com/v1/events/replay \
  -H "Authorization: Bearer $HOOKWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventIds": ["evt_abc", "evt_def"]}'
```

## API Key Management

### Create a scoped key
```bash
curl -X POST https://api.hookwing.com/v1/auth/keys \
  -H "Authorization: Bearer $HOOKWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "read-only", "scopes": ["events:read", "deliveries:read"]}'
```

### Available scopes
workspace:read, keys:read, keys:write, endpoints:read, endpoints:write, events:read, events:write, deliveries:read, analytics:read

## MCP Server
Install for IDE integration:
```bash
npm install -g @hookwing/mcp
hookwing-mcp
```

## Resources
- [Full API Docs](https://hookwing.com/docs/)
- [Interactive Explorer](https://hookwing.com/docs/api/)
- [SDK Quickstart](https://hookwing.com/docs/sdk-quickstart/)
- [Agent Integrations](https://hookwing.com/docs/agent-integrations/)
