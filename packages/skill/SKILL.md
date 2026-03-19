# Hookwing — Webhook Management Skill

## Description
Manage webhooks via the Hookwing API. Create endpoints, inspect events, replay deliveries, and monitor webhook health — all from your AI agent or IDE.

## MCP Server
Package: @hookwing/mcp
Binary: hookwing-mcp
Version: 0.0.1

### Setup
```bash
npm install -g @hookwing/mcp
export HOOKWING_API_KEY=hk_your_key
hookwing-mcp
```

### Available Tools

| Tool | Description |
|------|-------------|
| list_endpoints | List all webhook endpoints |
| create_endpoint | Create a new webhook endpoint |
| delete_endpoint | Delete a webhook endpoint by ID |
| list_events | List recent events with optional filtering |
| get_event | Get a single event with delivery details |
| replay_event | Replay an event — re-deliver to all active endpoints |
| list_deliveries | List delivery attempts with optional filtering |

### Tool Details

#### list_endpoints
List all webhook endpoints for the workspace.

**Parameters:**
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "apiKey": "hk_xxx"
}
```

#### create_endpoint
Create a new webhook endpoint.

**Parameters:**
- `url` (required): Destination URL for webhooks (must use HTTPS)
- `description` (optional): Human-readable description
- `eventTypes` (optional): Event types to subscribe to (omit for all)
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "url": "https://example.com/webhooks",
  "description": "My production endpoint",
  "eventTypes": ["order.created", "order.updated"]
}
```

#### delete_endpoint
Delete a webhook endpoint by ID.

**Parameters:**
- `endpointId` (required): ID of the endpoint to delete
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "endpointId": "ep_xxx"
}
```

#### list_events
List recent events with optional filtering.

**Parameters:**
- `limit` (optional): Max events to return (1-100, default 50)
- `cursor` (optional): Pagination cursor
- `status` (optional): Filter by status (pending, processing, completed, failed)
- `event_type` (optional): Filter by event type
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "limit": 20,
  "status": "failed"
}
```

#### get_event
Get a single event with delivery details.

**Parameters:**
- `eventId` (required): ID of the event to retrieve
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "eventId": "evt_xxx"
}
```

#### replay_event
Replay an event — re-deliver to all active endpoints.

**Parameters:**
- `eventId` (required): ID of the event to replay
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "eventId": "evt_xxx"
}
```

#### list_deliveries
List delivery attempts with optional filtering.

**Parameters:**
- `limit` (optional): Max deliveries to return (1-100, default 50)
- `offset` (optional): Skip N deliveries for pagination
- `status` (optional): Filter by status (pending, success, failed, retrying)
- `endpointId` (optional): Filter by endpoint ID
- `eventId` (optional): Filter by event ID
- `apiKey` (optional): API key (or set HOOKWING_API_KEY env var)
- `baseUrl` (optional): API base URL (or set HOOKWING_API_URL env var)

**Example:**
```json
{
  "limit": 20,
  "status": "failed",
  "endpointId": "ep_xxx"
}
```

## API Reference
Base URL: https://api.hookwing.com
Auth: Bearer token (API key)
OpenAPI: https://api.hookwing.com/openapi.json

## Quick Start
1. Sign up: POST /v1/auth/signup
2. Create endpoint: POST /v1/endpoints
3. Send webhook: POST /v1/ingest/:endpointId
4. Check delivery: GET /v1/events
