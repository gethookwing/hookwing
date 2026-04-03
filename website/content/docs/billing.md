---
title: "Billing & Tiers"
slug: "billing"
summary: "Manage your subscription, upgrade or downgrade tiers, and query pricing programmatically."
updatedAt: "2026-04-03"
---

## Tiers

Hookwing offers three tiers:

| Feature | Paper Plane (Free) | Warbird ($19/mo) | Stealth Jet ($89/mo) |
|---------|-------------------|-----------------|---------------------|
| Events/month | 10,000 | 500,000 | Unlimited |
| Endpoints | 3 | 10 | Unlimited |
| Payload size | 64 KB | 64 KB | 256 KB |
| Rate limit | 10 req/s | 50 req/s | 100 req/s |
| Retention | 7 days | 30 days | 90 days |
| Event routing | — | ✓ (extract transforms) | ✓ (all transforms) |
| Dead letter queue | — | ✓ | ✓ |
| Custom headers | — | ✓ | ✓ |
| Custom domains | — | — | ✓ |
| Priority delivery | — | — | ✓ |
| Team members | — | ✓ | ✓ |
| Analytics | Basic | 30-day | 90-day |

## Query Pricing (Public)

Get machine-readable pricing without authentication:

```bash
curl https://api.hookwing.com/api/pricing
```

Returns JSON with all tier details, limits, and features.

## Query Tiers (Public)

```bash
# List all tiers
curl https://api.hookwing.com/tiers

# Get a specific tier
curl https://api.hookwing.com/tiers/warbird
```

## Check Billing Status

```bash
curl https://api.hookwing.com/v1/billing/status \
  -H "Authorization: Bearer hk_live_your_key"
```

Response includes your current tier, Stripe subscription status, and usage.

## Upgrade

### Via Stripe Checkout

Create a Stripe checkout session for upgrading:

```bash
curl -X POST https://api.hookwing.com/v1/billing/checkout \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"tier": "warbird"}'
```

Returns a `checkoutUrl` — redirect your user to complete payment.

### Direct Upgrade (with existing Stripe subscription)

```bash
curl -X POST https://api.hookwing.com/v1/billing/upgrade \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"tier": "stealth-jet"}'
```

## Downgrade

```bash
curl -X POST https://api.hookwing.com/v1/billing/downgrade \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"tier": "paper-plane"}'
```

Downgrades take effect at the end of the current billing period.

## Billing Portal

Access the Stripe customer portal to manage payment methods, view invoices, and cancel:

```bash
curl https://api.hookwing.com/v1/billing/portal \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns a `portalUrl` — redirect your user to the Stripe billing portal.

## Workspace Settings

Update workspace-level billing settings:

```bash
curl -X PATCH https://api.hookwing.com/v1/billing/settings \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Acme Corp"}'
```

## Required Scopes

| Operation | Scope |
|-----------|-------|
| View billing status | `billing:read` |
| Upgrade/downgrade | `billing:upgrade` |
| Update settings | `workspace:write` |
| Create checkout session | Authenticated (any scope) |
| Access billing portal | Authenticated (any scope) |
