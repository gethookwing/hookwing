# Event Routing Visibility — Implementation Spec

**Task:** Make event routing visible on the website and fully documented.
**Directive:** Don't bloat the website. Keep main sections clear and concise. Focus on documentation.

## 1. Homepage — Agent-Ready Card

Add ONE bullet to the Agent-Ready feature card (after "Agents can self-provision via API"):

```
Event routing — filter, transform, and deliver by condition
```

Use the same `feature-detail-item` pattern with the green check SVG. That's it — one line.

## 2. Why Hookwing — Agent-Ready Section

Add ONE new `trust-feature-item` to the Agent-Ready section (after the MCP server item, before the billing item):

**Bold lead:** "Event routing. Send the right event to the right endpoint, automatically."
**Body:** "Define conditions — match by event type, payload fields, headers. Transform payloads before delivery. Route to specific endpoints per rule. All via API. Available on Warbird and above."

Use the same `trust-feature-item` + `icon-check-amber` pattern as the existing items.

## 3. Docs Navigation

Add "Event Routing" to the docs nav. Place it after "Endpoints" in the sidebar/nav order.

## 4. Docs Page — `/docs/event-routing/`

Create `website/content/docs/event-routing.md` with this content:

```markdown
---
title: "Event Routing"
slug: "event-routing"
summary: "Route, filter, and transform webhook events with conditional rules. Match by event type, payload, or headers — then deliver to specific endpoints."
updatedAt: "2026-03-26"
---

## Overview

Event routing lets you control which events reach which endpoints. Instead of delivering every event to every endpoint, you define rules: conditions that match events, optional transforms that reshape payloads, and actions that route matched events to specific endpoints — or drop them entirely.

Rules are evaluated in priority order. All conditions within a rule use AND logic — every condition must match for the rule to fire.

**Available on Warbird ($19/mo) and above.** Paper Plane (free) does not include routing rules.

## Concepts

### Rules

A rule has:
- **Name** — human-readable identifier
- **Priority** — integer 0–1000, lower = evaluated first
- **Conditions** — one or more match criteria (all must match)
- **Action** — what happens when conditions match (deliver to endpoint, or drop)
- **Enabled** — toggle without deleting

### Conditions

Each condition has a **field**, an **operator**, and a **value**.

**Fields** — what to match against:

| Field pattern | Example | Description |
|---------------|---------|-------------|
| `event.type` | `event.type` | The event type string |
| `$.payload.*` | `$.payload.amount` | JSON path into the event payload |
| `$.payload.user.name` | `$.payload.user.name` | Nested payload fields |
| `headers.*` | `headers.X-Source` | Request header value |
| `$.headers.*` | `$.headers.X-Source` | Same as above (alternate syntax) |

**Operators** — how to compare:

| Operator | Description | Example value |
|----------|-------------|---------------|
| `equals` | Exact match | `"order.created"` |
| `not_equals` | Does not match | `"test"` |
| `contains` | String contains substring | `"order"` |
| `starts_with` | String starts with prefix | `"payment."` |
| `gt` | Greater than (numeric) | `100` |
| `gte` | Greater than or equal | `100` |
| `lt` | Less than (numeric) | `1000` |
| `lte` | Less than or equal | `1000` |
| `exists` | Field exists (true) or is absent (false) | `true` |
| `in` | Value is in array | `["us", "ca", "gb"]` |
| `regex` | Matches regular expression | `"^order\\."` |

### Actions

| Action | Description |
|--------|-------------|
| `deliver` | Deliver the event to a specific endpoint (optionally with a transform) |
| `drop` | Discard the event — it won't be delivered |

### Transforms (Warbird: extract only · Stealth Jet: all)

Transforms reshape the payload before delivery.

| Type | Description | Config |
|------|-------------|--------|
| `extract` | Keep only specified fields | `{ "fields": ["order_id", "amount"] }` |
| `rename` | Rename payload keys | `{ "mapping": { "old_name": "new_name" } }` |
| `template` | String template with variable substitution | `{ "template": "Order {{order_id}} for {{amount}}" }` |

**Tier access:**
- **Warbird** — `extract` transforms only
- **Stealth Jet** — all transform types (`extract`, `rename`, `template`)

## API Reference

All routing rule endpoints require authentication and the appropriate API key scopes.

**Required scopes:** `endpoints:read` (GET), `endpoints:write` (POST, PATCH, DELETE)

### Create a rule

```bash
curl -X POST https://api.hookwing.com/v1/routing-rules \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Route orders to fulfillment",
    "priority": 10,
    "conditions": [
      {
        "field": "event.type",
        "operator": "starts_with",
        "value": "order."
      }
    ],
    "action": {
      "type": "deliver",
      "endpointId": "ep_fulfillment_abc123"
    },
    "enabled": true
  }'
```

**Request body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Rule name (1–100 chars) |
| `priority` | integer | No | 0 | Evaluation order (0–1000, lower first) |
| `conditions` | array | Yes | — | At least one condition |
| `action` | object | Yes | — | What to do on match |
| `action.type` | string | No | `"deliver"` | `"deliver"` or `"drop"` |
| `action.endpointId` | string | No | — | Target endpoint (required for deliver) |
| `action.transform` | object | No | — | Optional payload transform |
| `enabled` | boolean | No | `true` | Whether the rule is active |

**Response:** `201 Created` with the full rule object.

### List rules

```bash
curl https://api.hookwing.com/v1/routing-rules \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns rules ordered by priority (ascending).

### Get a rule

```bash
curl https://api.hookwing.com/v1/routing-rules/rule_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

### Update a rule

```bash
curl -X PATCH https://api.hookwing.com/v1/routing-rules/rule_abc123 \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Route all orders (updated)",
    "enabled": false
  }'
```

All fields are optional — only include what you want to change.

### Delete a rule

```bash
curl -X DELETE https://api.hookwing.com/v1/routing-rules/rule_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns `204 No Content`.

### Test rules (dry run)

Test an event against your rules without actually delivering anything:

```bash
curl -X POST https://api.hookwing.com/v1/routing-rules/test \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "order.created",
      "payload": {
        "order_id": "ord_123",
        "amount": 99.99,
        "currency": "usd",
        "customer_email": "alice@example.com"
      }
    }
  }'
```

**Response:**

```json
{
  "matched": true,
  "matchedRules": [
    {
      "ruleId": "rule_abc123",
      "name": "Route orders to fulfillment",
      "action": "deliver",
      "transform": null
    }
  ],
  "transforms": null
}
```

Test a specific rule by adding `"ruleId": "rule_abc123"` to the request body.

## Examples

### Route by event type

Send all payment events to your billing service:

```json
{
  "name": "Payments to billing",
  "conditions": [
    { "field": "event.type", "operator": "starts_with", "value": "payment." }
  ],
  "action": { "type": "deliver", "endpointId": "ep_billing_service" }
}
```

### Filter by payload field

Only route high-value orders (over $100):

```json
{
  "name": "High-value orders",
  "conditions": [
    { "field": "event.type", "operator": "equals", "value": "order.created" },
    { "field": "$.payload.amount", "operator": "gt", "value": 100 }
  ],
  "action": { "type": "deliver", "endpointId": "ep_vip_handler" }
}
```

### Drop test events

Discard events from a test source:

```json
{
  "name": "Drop test events",
  "priority": 0,
  "conditions": [
    { "field": "headers.X-Source", "operator": "equals", "value": "test" }
  ],
  "action": { "type": "drop" }
}
```

### Extract fields before delivery

Strip a payload down to only the fields your service needs (Warbird+):

```json
{
  "name": "Slim order payload",
  "conditions": [
    { "field": "event.type", "operator": "starts_with", "value": "order." }
  ],
  "action": {
    "type": "deliver",
    "endpointId": "ep_analytics",
    "transform": {
      "type": "extract",
      "config": { "fields": ["order_id", "amount", "currency"] }
    }
  }
}
```

### Route by region

Send events from specific countries to a regional endpoint:

```json
{
  "name": "EU orders to EU endpoint",
  "conditions": [
    { "field": "$.payload.country", "operator": "in", "value": ["de", "fr", "nl", "es", "it"] }
  ],
  "action": { "type": "deliver", "endpointId": "ep_eu_service" }
}
```

### Regex matching

Match event types with a pattern:

```json
{
  "name": "All user lifecycle events",
  "conditions": [
    { "field": "event.type", "operator": "regex", "value": "^user\\.(created|updated|deleted)$" }
  ],
  "action": { "type": "deliver", "endpointId": "ep_user_service" }
}
```

## Limits by Tier

| Tier | Routing Rules | Transforms |
|------|---------------|------------|
| Paper Plane (Free) | — | — |
| Warbird ($19/mo) | 10 | Extract only |
| Stealth Jet ($89/mo) | Unlimited | All types |
```

## 5. Build the docs page

The docs page uses `website/content/docs/event-routing.md` (frontmatter above). The build script at `website/scripts/build-content.mjs` should pick it up automatically. If there's a docs nav/sidebar config, add "Event Routing" after "Endpoints".

## Summary of changes

1. `website/index.html` — add 1 bullet to Agent-Ready card
2. `website/why-hookwing/index.html` — add 1 feature item to Agent-Ready section
3. `website/content/docs/event-routing.md` — new file (full docs page)
4. Docs nav config (if exists) — add entry
5. Build + verify
