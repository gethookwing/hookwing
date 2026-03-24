# @hookwing/mcp

Hookwing MCP (Model Context Protocol) server — manage webhooks directly from Claude Code, Cursor, Cline, and other AI coding agents.

## Install

```bash
npm install -g @hookwing/mcp
```

## Setup

```bash
export HOOKWING_API_KEY=hk_live_your_key
hookwing-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `list_endpoints` | List all webhook endpoints |
| `create_endpoint` | Create a new endpoint with URL and event type filters |
| `get_endpoint` | Get endpoint details including signing secret |
| `list_events` | List received webhook events |
| `get_event` | Get event details with full payload |
| `replay_event` | Re-deliver a failed event |
| `get_deliveries` | List delivery attempts with status |

## IDE Integration

### Claude Code
Add to your Claude Code MCP config:
```json
{
  "mcpServers": {
    "hookwing": {
      "command": "hookwing-mcp",
      "env": { "HOOKWING_API_KEY": "hk_live_your_key" }
    }
  }
}
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "servers": {
    "hookwing": {
      "command": "hookwing-mcp",
      "env": { "HOOKWING_API_KEY": "hk_live_your_key" }
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HOOKWING_API_KEY` | Your Hookwing API key | Yes |
| `HOOKWING_API_URL` | API base URL (default: https://api.hookwing.com) | No |

## License

MIT
