# @hookwing/cli

Hookwing CLI — Manage webhooks from the terminal

## Installation

```bash
# Install globally
npm install -g @hookwing/cli

# Or run with npx
npx @hookwing/cli
```

## Authentication

Before using the CLI, you need to authenticate with your API key:

```bash
# Save API key directly (recommended)
hookwing login --api-key hk_live_...

# Or interactive login
hookwing auth login

# Or set via environment variable
export HOOKWING_API_KEY=your_api_key
```

### Auth Commands

```bash
# Check authentication status and API health
hookwing status

# Full auth status (same as above)
hookwing auth status

# Logout (remove API key)
hookwing auth logout
```

## Endpoints

Manage your webhook endpoints.

### List Endpoints

```bash
hookwing endpoints list
hookwing endpoints list --json
```

### Create Endpoint

```bash
hookwing endpoints create --url https://example.com/webhook
hookwing endpoints create --url https://example.com/webhook --description "My endpoint"
hookwing endpoints create --url https://example.com/webhook --event-types event.foo event.bar
```

### Get Endpoint

```bash
hookwing endpoints get <endpoint-id>
hookwing endpoints get <endpoint-id> --json
```

### Update Endpoint

```bash
hookwing endpoints update <endpoint-id> --url https://new-url.com/webhook
hookwing endpoints update <endpoint-id> --description "New description"
hookwing endpoints update <endpoint-id> --active false
```

### Delete Endpoint

```bash
hookwing endpoints delete <endpoint-id>
hookwing endpoints delete <endpoint-id> --yes  # Skip confirmation
```

## Events

View and manage webhook events.

### List Events

```bash
hookwing events list
hookwing events list --limit 50
hookwing events list --status failed
hookwing events list --type event.foo
```

### Get Event

```bash
hookwing events get <event-id>
hookwing events get <event-id> --json
```

### Replay Event

```bash
# Top-level shorthand
hookwing replay <event-id>

# Or via events subcommand
hookwing events replay <event-id>

# Replay multiple events
hookwing events replay --bulk event-id-1,event-id-2,event-id-3
```

## Listen (WebSocket Tunnel)

Forward incoming webhooks to your local development server in real-time.

```bash
# Forward all events to a local URL
hookwing listen --forward-to http://localhost:3000/webhooks

# Filter to a specific endpoint
hookwing listen --endpoint ep_abc123 --forward-to http://localhost:3000/webhooks

# Legacy port+path mode (routes by event type, e.g. event.foo → /event/foo)
hookwing listen --port 3000 --path /webhooks

# Agent/script mode (JSON lines output)
hookwing listen --forward-to http://localhost:3000/webhooks --agent
```

When `--forward-to` is used, all events are POSTed to that exact URL with headers:
- `X-Hookwing-Event` — event type
- `X-Hookwing-Event-Id` — event ID

## Deliveries

View delivery attempts for events.

### List Deliveries

```bash
hookwing deliveries list
hookwing deliveries list --limit 50
hookwing deliveries list --status failed
hookwing deliveries list --endpoint-id <endpoint-id>
```

### Get Delivery

```bash
hookwing deliveries get <delivery-id>
hookwing deliveries get <delivery-id> --json
```

## API Keys

Manage API keys for programmatic access.

### List Keys

```bash
hookwing keys list
hookwing keys list --json
```

### Create Key

```bash
hookwing keys create --name "My API Key"
hookwing keys create --name "CI Key" --scopes endpoints:read events:write
```

### Delete Key

```bash
hookwing keys delete <key-id>
```

## Playground

Create temporary endpoints for testing webhooks.

### Create Session

```bash
hookwing playground create
hookwing playground create --json
```

### List Sessions

```bash
hookwing playground list
```

### Delete Session

```bash
hookwing playground delete <session-id>
```

## Output Formats

By default, the CLI outputs in table format for human-readable output. Use `--json` flag for JSON output, which is useful for scripting:

```bash
# Table output (default when TTY)
hookwing endpoints list

# JSON output (automatic when piped or with --json flag)
hookwing endpoints list --json
hookwing endpoints list | jq '.'
```

## Environment Variables

- `HOOKWING_API_KEY` — API key for authentication
- `HOOKWING_API_URL` — Base URL for the API (default: https://api.hookwing.com)

## Configuration

The CLI stores configuration in `~/.hookwing/config.json`:

```json
{
  "apiKey": "your-api-key",
  "baseUrl": "https://api.hookwing.com",
  "format": "table"
}
```

## License

MIT