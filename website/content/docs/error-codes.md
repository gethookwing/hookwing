---
title: "Error Codes"
slug: "error-codes"
summary: "Complete list of Hookwing API error codes, HTTP status codes, and troubleshooting guidance."
updatedAt: "2026-03-24"
---

## Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "status": 400
}
```

Some errors include additional context:

```json
{
  "error": "Invalid input",
  "details": { "fieldErrors": { "email": ["Invalid email format"] } },
  "status": 400
}
```

## HTTP Status Codes

### Success (2xx)

| Code | Meaning |
|------|---------|
| 200 | Request succeeded |
| 201 | Resource created |

### Client Errors (4xx)

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| 400 | Invalid input | Missing or malformed request body | Check required fields and types |
| 401 | Unauthorized | Missing or invalid API key | Include `Authorization: Bearer hk_...` header |
| 403 | Forbidden | API key lacks required scope, or tier doesn't support this feature | Check key scopes, or upgrade tier |
| 404 | Not found | Resource doesn't exist or belongs to another workspace | Check the ID, verify you own the resource |
| 409 | Conflict | Resource already exists (e.g., duplicate domain) | Use a different value or check existing resources |
| 410 | Gone | Resource expired (e.g., playground session) | Create a new session |
| 429 | Rate limit exceeded | Too many requests in time window | Wait for `Retry-After` seconds, then retry |

### Server Errors (5xx)

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| 500 | Internal server error | Unexpected server failure | Retry the request; contact support if persistent |
| 503 | Service unavailable | Database or dependency unavailable | Wait and retry |

## Rate Limit Headers

Every response includes rate limit information:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds to wait (only on 429) |

## Scope Errors

When an API key lacks a required scope, the 403 response includes:

```json
{
  "error": "Forbidden",
  "message": "API key does not have the required scope for this route",
  "requiredScopes": ["endpoints:write"]
}
```

## Tier-Gated Feature Errors

When a feature requires a higher tier:

```json
{
  "error": "Forbidden",
  "message": "Custom headers require Warbird tier or higher",
  "requiredTier": "warbird"
}
```
