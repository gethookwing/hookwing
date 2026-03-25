# Event Routing & Filtering Layer — Design Spec

**Author:** Cody (hw-code)  
**Status:** Draft — awaiting Fabien review  
**Date:** 2026-03-25  

---

## 1. Problem Statement

Hookwing currently supports basic fan-out: one ingested event gets delivered to all endpoints in the workspace that match the event's type. This is 1:many but dumb — no conditional routing, no payload-based filtering, no transforms.

**What's missing:**
- Route events based on payload content (e.g., `$.amount > 100`)
- Filter by header values (e.g., `X-Source: production`)
- Transform payloads before delivery (e.g., extract fields, rename keys)
- Priority ordering for rule evaluation
- Dead-end rules (accept but don't deliver — useful for filtering noise)

**Competitive pressure:** Hookdeck owns this niche with their "connections" + "transformations" model. Svix has event type routing. Convoy has advanced filtering. We need at least basic rule-based routing to be competitive.

## 2. Proposed Solution

A lightweight rule-based routing layer that sits between ingest and delivery:

```
Ingest → [Event stored] → [Rule Engine evaluates] → [Matching endpoints] → Delivery
```

### Routing Rules
Each rule defines: **conditions** (when to match) + **action** (what to do).

```
Rule: "High-value orders to Slack"
  Conditions:
    - event.type = "order.created"
    - $.payload.amount > 100
  Action:
    - Deliver to endpoint ep_slack_notifications
    - Transform: extract { order_id, amount, customer_email }
```

### Fan-out Enhancement
Current: event type matching only (string equality on endpoint's `eventTypes` array).
New: rule-based matching with JSON path conditions + header conditions.

Both systems coexist — legacy event type matching still works, rules are additive.

## 3. API Design

### Routing Rules CRUD

```
POST   /v1/routing-rules          — Create a rule
GET    /v1/routing-rules          — List rules (paginated)
GET    /v1/routing-rules/:id      — Get rule details
PATCH  /v1/routing-rules/:id      — Update rule
DELETE /v1/routing-rules/:id      — Delete rule
POST   /v1/routing-rules/test     — Test a rule against a sample event (dry run)
```

### Create Rule Request
```json
{
  "name": "High-value orders to Slack",
  "priority": 10,
  "conditions": [
    { "field": "event.type", "operator": "equals", "value": "order.created" },
    { "field": "$.payload.amount", "operator": "gt", "value": 100 }
  ],
  "action": {
    "type": "deliver",
    "endpointId": "ep_slack_notifications",
    "transform": {
      "type": "extract",
      "fields": ["order_id", "amount", "customer_email"]
    }
  },
  "enabled": true
}
```

### Condition Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `event.type equals "order.created"` |
| `not_equals` | Not equal | `event.type not_equals "test.event"` |
| `contains` | String contains | `$.payload.email contains "@enterprise.com"` |
| `starts_with` | String prefix | `event.type starts_with "order."` |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison | `$.payload.amount gt 100` |
| `exists` | Field exists | `$.payload.metadata.priority exists true` |
| `in` | Value in array | `event.type in ["order.created", "order.updated"]` |
| `regex` | Regex match | `$.payload.sku regex "^SKU-[A-Z]{3}"` |

### Condition Fields
| Field | Source | Example |
|-------|--------|---------|
| `event.type` | X-Event-Type header | `"order.created"` |
| `$.payload.*` | JSON path into payload | `"$.payload.amount"` |
| `headers.*` | Request headers | `"headers.X-Source"` |

## 4. Data Model

### Migration: `routing_rules` table
```sql
CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions TEXT NOT NULL,  -- JSON array of conditions
  action_type TEXT NOT NULL DEFAULT 'deliver',
  action_endpoint_id TEXT,
  action_transform TEXT,     -- JSON transform config
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_rr_workspace ON routing_rules(workspace_id);
CREATE INDEX idx_rr_priority ON routing_rules(priority);
```

### Drizzle Schema
```typescript
export const routingRules = sqliteTable('routing_rules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  priority: integer('priority').notNull().default(0),
  conditions: text('conditions').notNull(), // JSON
  actionType: text('action_type').notNull().default('deliver'),
  actionEndpointId: text('action_endpoint_id'),
  actionTransform: text('action_transform'), // JSON
  enabled: integer('enabled').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

## 5. Tier Implications (Fabien-approved 2026-03-25)

| Feature | Paper Plane (free) | Warbird ($19) | Stealth Jet ($89) |
|---------|-------------------|---------------|-------------------|
| Event type matching | ✅ (existing) | ✅ | ✅ |
| Routing rules | ❌ (0 rules) | ✅ (up to 10 rules) | ✅ (unlimited / 999) |
| Condition operators | — | All (equals, contains, gt/lt, regex, JSON path) | All |
| Basic transforms (extract) | ❌ | ✅ | ✅ |
| Full transforms (rename, template) | ❌ | ❌ | ✅ |
| Rule dry-run testing | ❌ | ✅ | ✅ |

**Tier config change:** Add `max_routing_rules` to `TierLimitsSchema` in `packages/shared/src/config/tiers.ts`:
- Paper Plane: 0
- Warbird: 10
- Stealth Jet: 999

## 6. Competitive Analysis

### Hookdeck
- "Connections" model: Source → Connection (with rules) → Destination
- Transformation via JavaScript functions
- Advanced filtering with JSONPath
- Most mature routing system in the space

### Svix
- Event type routing only (no payload-based)
- Channel-based delivery groups
- Simpler model, less flexible

### Convoy
- Advanced filtering with JSON schema matching
- Payload mutation (transforms)
- Subscription-based routing

### Our Positioning
We sit between Svix (too simple) and Hookdeck (too complex). MVP ships with:
- Event type matching (existing, unchanged)
- Conditional routing with all operators (equals, contains, gt/lt, regex, JSON path)
- Basic transforms included in MVP (extract for Warbird, full for Stealth Jet)
- Fan-out to multiple endpoints per rule
- Backward compatible: existing `eventTypes` on endpoints continues to work, rules are additive

## 7. Implementation (single phase — Fabien directive)

**Ship everything in one PR:**
- Routing rules CRUD API with all condition operators
- Condition evaluation engine (equals, contains, starts_with, gt/lt, regex, JSON path, exists, in)
- Basic transforms: extract fields (Warbird), rename keys + template (Stealth Jet)
- Rule priority ordering
- Integration with existing delivery pipeline (augment, don't replace)
- Rule dry-run testing endpoint
- Tier gating via `max_routing_rules` in tier config
- D1 migration for routing_rules table
- Comprehensive tests

**Future (separate tickets):**
- Dashboard UI for rule management
- JavaScript transform functions
- Rule analytics
- Rule templates / presets

## 8. Decisions (Fabien-approved 2026-03-25)

| Question | Decision |
|----------|----------|
| Tier names | Paper Plane / Warbird / Stealth Jet (3 tiers only, no "Biplane") |
| Rule limits | Paper Plane: 0, Warbird: 10, Stealth Jet: unlimited (999) |
| Transforms | YES in MVP — extract for Warbird, full for Stealth Jet |
| Backward compat | AUGMENT — eventTypes + rules coexist |
| Priority | Ship before OAuth (PROD-190 blocked on Fabien anyway) |
| Pricing | Included in existing plans, no tier bump |
