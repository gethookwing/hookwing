---
title: "Security"
slug: "security"
summary: "Two-factor authentication, webhook signature verification, API key best practices, and security recommendations."
updatedAt: "2026-04-03"
---

## Overview

Hookwing is built with security as a core principle. This page covers the security features available to protect your account and webhook infrastructure.

## Two-Factor Authentication (2FA)

Hookwing supports TOTP-based two-factor authentication (RFC 6238), compatible with authenticator apps like Google Authenticator, Authy, and 1Password.

### Enable 2FA

**Step 1:** Generate a TOTP secret

```bash
curl -X POST https://api.hookwing.com/v1/auth/2fa/setup \
  -H "Authorization: Bearer hk_live_your_key"
```

Response:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpUri": "otpauth://totp/Hookwing:you@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Hookwing"
}
```

Scan the `otpUri` as a QR code in your authenticator app, or enter the `secret` manually.

**Step 2:** Verify with a code from your authenticator

```bash
curl -X POST https://api.hookwing.com/v1/auth/2fa/verify \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

Once verified, 2FA is enabled. All future logins will require a TOTP code.

### Login with 2FA

When 2FA is enabled, the login endpoint returns a temporary token instead of an API key:

```json
{
  "requiresTwoFactor": true,
  "tempToken": "base64-encoded-temp-token"
}
```

Complete the login by validating the TOTP code:

```bash
curl -X POST https://api.hookwing.com/v1/auth/2fa/validate \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "base64-encoded-temp-token",
    "code": "123456"
  }'
```

The temp token expires after 5 minutes.

### Disable 2FA

Requires a valid TOTP code to disable:

```bash
curl -X POST https://api.hookwing.com/v1/auth/2fa/disable \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

## Webhook Signature Verification

Every delivery includes HMAC-SHA256 signatures. See the [Webhook Signatures](/docs/webhooks/) page for full verification details and SDK examples.

Key points:
- Signatures use the endpoint's signing secret (`whsec_...`)
- Verify the `X-Hookwing-Timestamp` is within 5 minutes to prevent replay attacks
- Use constant-time comparison to prevent timing attacks
- Never expose your signing secret in client-side code

## API Key Best Practices

### Use scoped keys

Create separate API keys for different purposes with minimal permissions:

```bash
# Read-only key for monitoring
curl -X POST https://api.hookwing.com/v1/auth/keys \
  -H "Authorization: Bearer hk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "monitoring-dashboard",
    "scopes": ["events:read", "deliveries:read", "analytics:read"]
  }'
```

### Rotate keys regularly

1. Create a new key with the same scopes
2. Update your application to use the new key
3. Revoke the old key

### Store keys securely

- Use environment variables — never hardcode API keys
- Use secrets managers in production (AWS Secrets Manager, Vault, Doppler)
- Never commit keys to source control
- Never expose keys in client-side code or browser requests

### Revoke compromised keys immediately

```bash
curl -X DELETE https://api.hookwing.com/v1/auth/keys/key_abc123 \
  -H "Authorization: Bearer hk_live_your_key"
```

Revocation is immediate — all requests with the revoked key will return `401`.

## Rate Limiting

Hookwing enforces rate limits per workspace to protect against abuse:

| Tier | Requests/second |
|------|----------------|
| Paper Plane (Free) | 10 |
| Warbird ($19/mo) | 50 |
| Stealth Jet ($89/mo) | 100 |

Rate limit headers are included on every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

When rate limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

## Infrastructure Security

- **TLS everywhere** — all API traffic is encrypted in transit
- **Cloudflare edge network** — DDoS protection and global distribution
- **No credential storage** — passwords are hashed with bcrypt, never stored in plain text
- **Workspace isolation** — all data is scoped to workspaces with enforced access controls

## Required Scopes

| Operation | Scope |
|-----------|-------|
| Setup, verify, and disable 2FA | `workspace:write` |
| Validate 2FA on login | No auth required (uses temp token) |
