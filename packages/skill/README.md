# @hookwing/skill

Hookwing webhook management skill for AI agents. Manage webhooks via the Hookwing API directly from Claude Code, Cursor, or any MCP-compatible IDE.

## What is Hookwing?

Hookwing is a webhook management platform that helps you:
- **Receive webhooks** — Create endpoints to receive webhooks from any service
- **Inspect events** — View raw payloads and headers of incoming webhooks
- **Replay deliveries** — Replay failed webhooks with a single click
- **Monitor health** — Track delivery success/failure rates

## Features

- **8 MCP tools** for complete webhook lifecycle management
- **Easy setup** — Install once, configure your API key, start managing webhooks
- **IDE integration** — Works with Claude Code, Cursor, Windsurf, and any MCP client
- **Filtering & pagination** — Filter events by status, type, endpoint; paginate through results

## Installation

### Prerequisites

- Node.js 18+
- npm or pnpm

### Install MCP Server

```bash
npm install -g @hookwing/mcp
```

### Configure API Key

Set your Hookwing API key as an environment variable:

```bash
export HOOKWING_API_KEY=hk_your_api_key
```

Or pass it directly to each tool call.

## IDE Setup

### Claude Code (Claude CLI)

Add to your Claude Code config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "hookwing": {
      "command": "hookwing-mcp",
      "env": {
        "HOOKWING_API_KEY": "hk_your_api_key"
      }
    }
  }
}
```

### Cursor

1. Open Cursor Settings (Cmd+,)
2. Go to "Models" > "MCP"
3. Add new MCP server:
   - Name: `hookwing`
   - Command: `hookwing-mcp`
   - Environment: `HOOKWING_API_KEY=hk_your_api_key`

### Windsurf

Add to your Windsurf config:

```json
{
  "mcpServers": {
    "hookwing": {
      "command": "hookwing-mcp",
      "env": {
        "HOOKWING_API_KEY": "hk_your_api_key"
      }
    }
  }
}
```

## Usage Examples

### List All Endpoints

```json
{
  "name": "list_endpoints",
  "arguments": {}
}
```

Response:
```json
{
  "endpoints": [
    {
      "id": "ep_abc123",
      "url": "https://example.com/webhooks",
      "description": "Production orders",
      "eventTypes": ["order.created"],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create a New Endpoint

```json
{
  "name": "create_endpoint",
  "arguments": {
    "url": "https://example.com/webhooks",
    "description": "My webhook handler",
    "eventTypes": ["order.created", "order.updated"]
  }
}
```

### List Failed Events

```json
{
  "name": "list_events",
  "arguments": {
    "status": "failed",
    "limit": 20
  }
}
```

### Replay a Failed Event

```json
{
  "name": "replay_event",
  "arguments": {
    "eventId": "evt_abc123"
  }
}
```

### Check Delivery Status

```json
{
  "name": "list_deliveries",
  "arguments": {
    "status": "failed",
    "endpointId": "ep_abc123"
  }
}
```

## API Reference

For complete API documentation, see the [Hookwing API Docs](https://hookwing.com/docs).

- **Base URL**: `https://api.hookwing.com`
- **Authentication**: Bearer token (API key)
- **OpenAPI Spec**: `https://api.hookwing.com/openapi.json`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOOKWING_API_KEY` | Your Hookwing API key | Required |
| `HOOKWING_API_URL` | API base URL | `https://api.hookwing.com` |

## Troubleshooting

### "API key is required" error

Make sure `HOOKWING_API_KEY` is set in your environment, or pass `apiKey` parameter to each tool call.

### Connection refused

Ensure the MCP server is running:
```bash
hookwing-mcp
```

### Invalid endpoint URL

Endpoint URLs must use HTTPS (HTTP is only allowed for localhost).

## License

MIT
