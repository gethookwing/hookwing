---
title: "CLI Reference"
slug: "cli-reference"
summary: "Complete command reference for the Hookwing CLI. Manage endpoints, events, deliveries, and API keys from the terminal."
updatedAt: "2026-03-24"
---

## Installation

```bash
npm install -g @hookwing/cli
```

## Authentication

Set your API key as an environment variable:

```bash
export HOOKWING_API_KEY=hk_live_your_key
```

Or pass it directly:

```bash
hookwing --api-key hk_live_your_key endpoints list
```

## Commands

### `hookwing endpoints list`
List all endpoints in your workspace.

```bash
hookwing endpoints list
```

Options:
- `--limit <n>` — Maximum results (default: 20)
- `--json` — Output as JSON

### `hookwing endpoints create`
Create a new webhook endpoint.

```bash
hookwing endpoints create \
  --url https://your-app.com/webhooks \
  --name my-endpoint \
  --event-types payment_intent.succeeded,charge.failed
```

Options:
- `--url <url>` — Destination URL (required)
- `--name <name>` — Human-readable name (required)
- `--event-types <types>` — Comma-separated event type filters

### `hookwing endpoints get <id>`
Get details for a specific endpoint.

```bash
hookwing endpoints get ep_abc123
```

### `hookwing endpoints delete <id>`
Delete an endpoint.

```bash
hookwing endpoints delete ep_abc123
```

### `hookwing events list`
List recent events.

```bash
hookwing events list --limit 10
```

Options:
- `--limit <n>` — Maximum results (default: 20)
- `--since <timestamp>` — Only events after this timestamp
- `--event-type <type>` — Filter by event type

### `hookwing events get <id>`
Get event details including payload.

```bash
hookwing events get evt_xyz789
```

### `hookwing events replay <id>`
Replay an event (re-deliver to all matching endpoints).

```bash
hookwing events replay evt_xyz789
```

### `hookwing deliveries list`
List delivery attempts.

```bash
hookwing deliveries list --limit 20
```

Options:
- `--limit <n>` — Maximum results
- `--status <status>` — Filter: delivered, failed, pending

### `hookwing keys list`
List API keys for your workspace.

```bash
hookwing keys list
```

### `hookwing keys create`
Create a new API key.

```bash
hookwing keys create \
  --name "CI/CD key" \
  --scopes endpoints:read,events:read
```

### `hookwing keys delete <id>`
Revoke an API key.

```bash
hookwing keys delete key_abc123
```

### `hookwing listen`
Stream real-time events via SSE. Opens a persistent connection to `/v1/stream` and prints incoming events to stdout.

```bash
hookwing listen
```

Options:
- `--json` — Output raw JSON events (default: formatted)
- `--endpoint <id>` — Filter events for a specific endpoint

## Global Options

| Flag | Description |
|------|-------------|
| `--api-key <key>` | API key (overrides HOOKWING_API_KEY) |
| `--base-url <url>` | API base URL (default: https://api.hookwing.com) |
| `--json` | Output as JSON |
| `--help` | Show help |
| `--version` | Show version |
