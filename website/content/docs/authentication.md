---
title: "Authentication"
slug: "authentication"
summary: "API keys, scopes, and auth flows. Everything you need to secure your Hookwing integration."
updatedAt: "2026-03-24"
---

## API Key Authentication

Every authenticated request to the Hookwing API requires a Bearer token:

```
Authorization: Bearer hk_live_your_api_key
```

### Creating API keys

Your first key is generated when you sign up. Create additional keys with specific scopes:

```bash
curl -X POST https://api.hookwing.com/v1/auth/keys \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD key",
    "scopes": ["endpoints:read", "endpoints:write", "events:read"]
  }'
```

### API Key Scopes

Scopes control what each key can access:

| Scope | Access |
|-------|--------|
| `workspace:read` | Read workspace info |
| `keys:read` | List API keys |
| `keys:write` | Create and delete keys |
| `endpoints:read` | List and view endpoints |
| `endpoints:write` | Create, update, delete endpoints |
| `events:read` | List and view events |
| `events:write` | Replay events |
| `deliveries:read` | List and view deliveries |
| `analytics:read` | View usage analytics |

Keys without scopes (legacy keys from signup) have full access.

### Listing keys

```bash
curl https://api.hookwing.com/v1/auth/keys \
  -H "Authorization: Bearer hk_live_your_key"
```

### Revoking a key

```bash
curl -X DELETE https://api.hookwing.com/v1/auth/keys/key_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

### Rate limiting

Auth endpoints are rate-limited to 5 requests per minute per IP. All authenticated endpoints include rate limit headers:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when the window resets

## Social Login

Hookwing supports GitHub and Google OAuth for browser-based login:

- `GET /v1/auth/github` — redirects to GitHub OAuth
- `GET /v1/auth/google` — redirects to Google OAuth

Both create a workspace and return an API key on successful authentication.
