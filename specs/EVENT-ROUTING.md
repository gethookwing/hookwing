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

## 5. Tier Implications

| Feature | Paper Plane | Warbird | Stealth Jet |
|---------|-------------|---------|-------------|
| Event type matching | ✅ (existing) | ✅ | ✅ |
| Basic rules (equals, contains) | ❌ | ✅ (up to 10 rules) | ✅ (unlimited) |
| Advanced rules (regex, JSON path) | ❌ | ❌ | ✅ |
| Payload transforms | ❌ | ❌ | ✅ |
| Rule dry-run testing | ❌ | ✅ | ✅ |

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
We sit between Svix (too simple) and Hookdeck (too complex). Our MVP should offer:
- Event type matching (already have)
- Basic conditional routing (equals, contains, gt/lt)
- Fan-out to multiple endpoints per rule
- No transforms in MVP (phase 2)

## 7. Implementation Phases

### Phase 1: MVP (2-3 days)
- Routing rules CRUD API
- Basic condition evaluation (equals, contains, starts_with, gt/lt)
- Rule priority ordering
- Integration with existing delivery pipeline
- Tier gating (Warbird+)
- Tests

### Phase 2: Advanced (1 week)
- JSON path conditions (`$.payload.nested.field`)
- Regex matching
- Payload transforms (extract, rename, template)
- Rule dry-run testing endpoint
- Dashboard UI for rule management

### Phase 3: Power Features (future)
- JavaScript transform functions (like Hookdeck)
- Conditional retries per rule
- Rule analytics (match counts, latency)
- Rule templates / presets

## 8. Open Questions for Fabien

1. **Tier naming:** spec uses "Warbird" and "Stealth Jet" — confirm these are final tier names
2. **Rule limits:** 10 rules for Warbird? Or should all paid plans get unlimited?
3. **Transforms:** are payload transforms important for MVP, or can we ship routing-only first?
4. **Backward compatibility:** existing `eventTypes` on endpoints — should rules replace this or augment it?
5. **Pricing signal:** is this a feature worth a tier bump, or included in existing plans?
6. **Priority:** ship this before or after the OAuth integration?
