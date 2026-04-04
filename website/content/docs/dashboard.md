---
title: "Dashboard"
slug: "dashboard"
summary: "Using the Hookwing dashboard at app.hookwing.com — endpoints, events, deliveries, API keys, analytics, and workspace settings."
updatedAt: "2026-04-02"
---

## Overview

The Hookwing dashboard at `app.hookwing.com` provides a visual interface for managing your webhook infrastructure. Everything available in the dashboard is also available via the [API](/docs/getting-started/).

## Endpoints

### Creating an Endpoint

1. Go to **Endpoints** → **New endpoint**
2. Enter a destination URL (must be HTTPS)
3. Optionally add a name and event type filters
4. Click **Create** — Hookwing generates a signing secret

The signing secret (`whsec_...`) is shown once on creation. Copy it now and store it in your application's environment variables.

### Managing Endpoints

From the endpoints list you can:

- **Pause** — stop deliveries without deleting the endpoint (deliveries resume on unpause)
- **Edit** — update URL, name, event type filters, or custom headers
- **Delete** — permanently remove the endpoint

Paused endpoints do not receive new deliveries. Events ingested while an endpoint is paused are not queued — they're skipped.

### Event Type Filters

Leave event types empty to receive all events. Add filters to receive only matching types:

```
order.*           matches order.created, order.updated, order.cancelled
payment.succeeded matches only payment.succeeded
```

Wildcards use `*` to match any suffix after the dot.

## Events

The events view shows all events received by your workspace:

- Filter by status (`pending`, `delivered`, `failed`, `partial`)
- Filter by event type
- Click any event to inspect the full payload and headers
- Use **Replay** to re-deliver an event to all matching endpoints

## Deliveries

The deliveries view shows individual HTTP delivery attempts:

- Filter by endpoint, event, or status
- Click a delivery to see:
  - Full request body (what Hookwing sent to your endpoint)
  - Full response body and headers (what your endpoint returned)
  - HTTP status code and timing
  - Retry history for the same event

Use **Retry now** on a failed delivery to immediately re-attempt instead of waiting for the next scheduled retry.

## API Keys

Go to **Settings** → **API Keys** to manage your workspace keys:

- **Create key** — choose a name and scopes
- **Revoke** — immediately invalidates the key
- View last-used timestamp per key

Keys created via the dashboard have full access by default. Create scoped keys for CI/CD pipelines, agents, or third-party integrations with least-privilege access.

### Available Scopes

| Scope | Grants |
|-------|--------|
| `workspace:read` | View workspace info |
| `keys:read` | List API keys |
| `keys:write` | Create and delete keys |
| `endpoints:read` | List and view endpoints |
| `endpoints:write` | Create, update, delete endpoints |
| `events:read` | List and view events |
| `events:write` | Replay events |
| `deliveries:read` | List and view deliveries |
| `analytics:read` | View usage analytics |

## Analytics

The analytics view (Warbird+ tiers) shows:

- **Success rate** — percentage of deliveries that succeeded (2xx)
- **p99 latency** — 99th-percentile response time from your endpoints
- **Events per day** — bar chart of ingested event volume
- **Top event types** — breakdown by event type

Analytics data is retained for 30 days on Warbird and 90 days on Stealth Jet.

## Workspace Settings

Go to **Settings** → **Workspace** to:

- Rename your workspace
- View your current tier and usage
- Manage team members (Warbird+ tiers)

### Team Management (Warbird+)

Invite team members by email. Each member gets their own login and can be assigned roles:

| Role | Access |
|------|--------|
| Owner | Full access, can delete workspace |
| Admin | Full access, cannot delete workspace |
| Member | Read-only access to events and deliveries |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard shortcuts |
| `G E` | Go to Endpoints |
| `G V` | Go to Events |
| `G D` | Go to Deliveries |
| `G K` | Go to API Keys |
| `/` | Focus search |
