---
title: "Custom Domains"
slug: "custom-domains"
summary: "Use your own domain for webhook ingest URLs instead of api.hookwing.com. Available on Stealth Jet tier."
updatedAt: "2026-04-03"
---

## Overview

Custom domains let you use your own subdomain for ingest URLs:

```
# Default
POST https://api.hookwing.com/v1/ingest/ep_abc123

# With custom domain
POST https://webhooks.your-company.com/v1/ingest/ep_abc123
```

This gives your webhook infrastructure a branded, professional URL and lets you change webhook providers in the future without updating upstream integrations.

**Available on Stealth Jet ($89/mo) only.**

## Register a Custom Domain

```bash
curl -X POST https://api.hookwing.com/v1/domains \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"domain": "webhooks.your-company.com"}'
```

Response:

```json
{
  "id": "cd_abc123",
  "workspaceId": "ws_xyz789",
  "domain": "webhooks.your-company.com",
  "status": "pending",
  "verifiedAt": null,
  "createdAt": 1774000000000
}
```

### Domain Requirements

- Must be a valid domain or subdomain (e.g. `webhooks.acme.com`)
- Cannot use a bare top-level domain
- Must be unique across all Hookwing workspaces

## DNS Configuration

After registering your domain, add a CNAME record pointing to Hookwing:

| Type | Name | Value |
|------|------|-------|
| CNAME | `webhooks` | `ingest.hookwing.com` |

The domain status changes from `pending` to `verified` once DNS propagation completes and Hookwing confirms the CNAME record.

## List Custom Domains

```bash
curl https://api.hookwing.com/v1/domains \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "domains": [
    {
      "id": "cd_abc123",
      "domain": "webhooks.your-company.com",
      "status": "verified",
      "verifiedAt": 1774000100000,
      "createdAt": 1774000000000
    }
  ]
}
```

### Domain Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Registered, awaiting DNS verification |
| `verified` | DNS confirmed, domain is active |

## Remove a Custom Domain

```bash
curl -X DELETE https://api.hookwing.com/v1/domains/cd_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Returns `204 No Content`. After removal, the domain immediately stops accepting ingest requests. Update your upstream integrations to use `api.hookwing.com` before removing.

## Required Scopes

| Operation | Scope |
|-----------|-------|
| List domains | `endpoints:read` |
| Register and delete domains | `endpoints:write` |
