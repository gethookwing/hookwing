# Promise Matrix — Feature Claims vs Reality

This document audits every feature claim on the Hookwing website and maps it to actual implementation status.

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Real | Fully implemented in code |
| ⚠️ Partial | Tier flag exists, but limited/no route enforcement or partial implementation |
| ❌ Not implemented | Feature claimed on website but no code exists |
| 🔧 Infrastructure only | Infrastructure exists but feature not exposed to users |

---

## Agent Features

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| API-key auth by default | pricing | ✅ Real | `packages/api/src/middleware/auth.ts` | Bearer token auth |
| MCP | pricing | ✅ Real | `packages/mcp/src/server.ts` | 7 tools: list/create/delete endpoints, list/get/replay events, list deliveries |
| Agent self-provisioning | pricing | ✅ Real | `packages/api/src/routes/auth.ts` | POST /v1/auth/signup creates workspace + API key |
| HTTP-native billing (agents can upgrade) | pricing | ❌ Not implemented | - | Tier flag exists, no API endpoint for upgrades |
| Machine-readable pricing (/api/pricing) | pricing | ✅ Real | `packages/api/src/index.ts:82` | Returns tier metadata JSON |

---

## Usage Limits

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| Events / month (25K/100K/10M) | pricing | ✅ Real | `packages/shared/src/config/tiers.ts` | Tier limits enforced |
| Retention (7/30/90 days) | pricing | ✅ Real | `packages/shared/src/config/tiers.ts` + `packages/api/src/routes/events.ts` | Events filtered by retention in API |
| Unlimited endpoints | pricing | ✅ Real | `packages/shared/src/config/tiers.ts` | max_destinations: 999 |

---

## Delivery Features

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| Retry policies (Standard/Priority/Custom) | pricing | ⚠️ Partial | `packages/shared/src/config/tiers.ts` + `packages/api/src/worker/retry.ts` | Only max_retry_attempts configurable (6/6/10). No custom retry schedules. |
| Webhook signing | pricing | ✅ Real | `packages/shared/src/auth/keys.ts` + `packages/api/src/worker/deliver.ts` | HMAC-SHA256, verified in SDK |
| Rate limiting | pricing | ✅ Real | `packages/api/src/middleware/rateLimit.ts` | Tier-based limits enforced |
| Replay events | pricing | ✅ Real | `packages/api/src/routes/events.ts` + `packages/mcp/src/server.ts` | POST /v1/events/:id/replay |
| Priority delivery | pricing | ⚠️ Partial | `packages/shared/src/config/tiers.ts` | Tier flag exists, no actual priority queue |
| 6 automatic retries | why-hookwing | ✅ Real | `packages/api/src/worker/retry.ts` | Exponential backoff: 30s, 60s, 120s... |

---

## Access & Integrations

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| Dashboard | pricing | ⚠️ Partial | `website/app/` | Static HTML, not React. API wired to `/api/endpoints`, `/api/events`, `/api/deliveries` |
| API access | pricing | ✅ Real | Full REST API | OpenAPI spec at /openapi.json |
| MCP | pricing | ✅ Real | `packages/mcp/src/server.ts` | 7 tools implemented |
| Custom domains | pricing | ❌ Not implemented | - | Tier flag exists, no route handling |

---

## Reliability & Compliance

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| SLA (99.9%) | pricing | ❌ Not implemented | - | Claimed on Fighter Jet tier, no SLA enforcement |
| Support level | pricing | ❌ Not implemented | - | No support ticket system |
| SSO / SAML | pricing | ❌ Not implemented | - | Not implemented |
| GDPR / DPA | pricing | ❌ Not implemented | - | No DPA endpoint or compliance features |

---

## Tier-Gated Features (Config Only)

These features have tier flags but no route-level enforcement:

| Feature Claim | Tier | Status | Implementation | Notes |
|--------------|------|--------|----------------|-------|
| Custom headers | Warbird, Fighter Jet | ⚠️ Config only | `packages/shared/src/config/tiers.ts` | Flag exists, no endpoint metadata storage |
| IP whitelist | Fighter Jet | ⚠️ Config only | `packages/shared/src/config/tiers.ts` | Flag exists, no IP checking middleware |
| Transformations | All tiers | ⚠️ Config only | `packages/shared/src/config/tiers.ts` | Flag exists, no transformation code |
| Dead letter queue | Warbird, Fighter Jet | ❌ Not implemented | `packages/shared/src/config/tiers.ts` | Flag exists, no DLQ table or worker |

---

## Homepage Claims

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| Webhook infrastructure for agents | index | ✅ Real | Full platform | API + MCP |
| Inspect and route | index | ⚠️ Partial | `website/app/` | Dashboard shows events, no routing rules UI |
| View full payload, headers, delivery status | index | ⚠️ Partial | `website/app/` | Basic event view, limited details |
| No hidden fees | index | ✅ Real | Tier pricing | Clear pricing page |

---

## Getting Started Claims

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| 60 seconds to first webhook | getting-started | ✅ Real | Simple 3-step flow | Create key → create endpoint → send webhook |
| Playground (no account needed) | getting-started | ✅ Real | `packages/api/src/routes/playground.ts` | Anonymous, ephemeral |
| API, MCP, playground, transformations — free forever | getting-started | ⚠️ Partial | Tier config | Transformations flag exists but code not implemented |

---

## Docs Claims

| Feature Claim | Source Page | Status | Implementation | Notes |
|--------------|-------------|--------|----------------|-------|
| HMAC-SHA256 signatures | docs | ✅ Real | `packages/shared/src/auth/keys.ts` | Full verification docs |
| @hookwing/sdk npm package | docs | ✅ Real | `packages/sdk/src/webhook.ts` | Signature verification helper |
| @hookwing/cli | docs | ✅ Real | `packages/cli/` | Endpoint management |
| Automatic retries | docs | ✅ Real | `packages/api/src/worker/deliver.ts` | 6 retries with exponential backoff |

---

## API Endpoints Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /health | ✅ Real | Health check |
| GET /api/status | ✅ Real | Structured status JSON |
| GET /api/pricing | ✅ Real | Tier metadata |
| GET /openapi.json | ✅ Real | OpenAPI spec |
| POST /v1/auth/signup | ✅ Real | Self-provisioning |
| POST /v1/endpoints | ✅ Real | Create endpoint |
| GET /v1/endpoints | ✅ Real | List endpoints |
| GET /v1/endpoints/:id | ✅ Real | Get endpoint |
| PATCH /v1/endpoints/:id | ✅ Real | Update endpoint |
| DELETE /v1/endpoints/:id | ✅ Real | Delete endpoint |
| POST /v1/ingest/:endpointId | ✅ Real | Public ingestion |
| GET /v1/events | ✅ Real | List with filters |
| GET /v1/events/:id | ✅ Real | Get event |
| POST /v1/events/:id/replay | ✅ Real | Replay event |
| GET /v1/deliveries | ✅ Real | List with filters |
| GET /v1/deliveries/:id | ✅ Real | Get delivery |
| GET /v1/analytics | ✅ Real | Workspace analytics |

---

## Summary

- **Fully Implemented**: ~20 features
- **Partial/Config Only**: ~8 features
- **Not Implemented**: ~10 features

Key gaps:
1. **DLQ** — Tier flag exists but no dead letter queue code
2. **Custom headers** — No endpoint metadata storage
3. **IP whitelist** — No IP checking middleware
4. **Transformations** — No transformation engine
5. **SSO/SAML** — Not started
6. **SLA/Support** — Not implemented
7. **Agent billing** — No upgrade API
8. **Custom domains** — No route handling
