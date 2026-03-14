# Hookwing Subdomain Namespace

> Source of truth for all hookwing.com subdomains.
> Updated: 2026-03-14

## Convention

```
{env.}{service}.hookwing.com
```

- **Production** = no prefix (e.g. `api.hookwing.com`)
- **Dev** = `dev.` prefix (e.g. `dev.api.hookwing.com`)
- **Staging** = `staging.` prefix (e.g. `staging.api.hookwing.com`)

## Subdomain Map

| Subdomain | Env | Service | Backend | Status |
|-----------|-----|---------|---------|--------|
| `hookwing.com` | prod | Marketing site | CF Pages (`hookwing-prod`) | ❌ Not deployed |
| `www.hookwing.com` | prod | Redirect → hookwing.com | CNAME → hookwing.com | ✅ DNS exists |
| `api.hookwing.com` | prod | API | CF Worker (`hookwing-api-prod`) | ❌ Not deployed |
| `app.hookwing.com` | prod | Customer dashboard | CF Pages (`hookwing-app`) | ❌ Not built |
| `blog.hookwing.com` | — | ~~Blog~~ | **DELETED** — blog lives at hookwing.com/blog/ | ❌ Removed |
| `docs.hookwing.com` | prod | Developer docs | CF Pages or hookwing.com/docs/ (TBD) | ❌ Not built |
| `dev.hookwing.com` | dev | Marketing site | CF Pages (`hookwing-dev`) | ✅ Live |
| `dev.api.hookwing.com` | dev | API | CF Worker (`hookwing-api-dev`) | 🔧 Worker exists, no custom domain |
| `dev.app.hookwing.com` | dev | Customer dashboard | CF Pages (`hookwing-dev`) /dashboard/ | ❌ Not wired to API |
| `dev.blog.hookwing.com` | — | ~~Blog~~ | **DELETED** — blog lives at dev.hookwing.com/blog/ | ❌ Removed |
| `staging.api.hookwing.com` | staging | API | CF Worker (`hookwing-api-staging`) | 🔧 Worker exists, no custom domain |

## Internal / Tooling (not customer-facing)

| Subdomain | Purpose | Status |
|-----------|---------|--------|
| `brand.hookwing.com` | Brand design showcase | ✅ Live (dev.brand.) |
| `illustrations.hookwing.com` | Asset CDN | ✅ Live |
| `send.hookwing.com` | Outbound email (Resend/SES) | ✅ Configured |

## Workers.dev URLs (to deprecate)

These use Fabien's personal subdomain — **must be replaced** by custom domains above:

| Current URL | Replace with |
|-------------|-------------|
| `hookwing-api-dev.fabien-punin.workers.dev` | `dev.api.hookwing.com` |
| `hookwing-api-staging.fabien-punin.workers.dev` | `staging.api.hookwing.com` |

## DNS Records Needed

### New records to add:
```
dev.api.hookwing.com     → Worker custom domain (hookwing-api-dev)
staging.api.hookwing.com → Worker custom domain (hookwing-api-staging)
api.hookwing.com         → Worker custom domain (hookwing-api-prod) [when ready]
app.hookwing.com         → CF Pages (hookwing-app) [when built]
docs.hookwing.com        → CF Pages (hookwing-docs) [when built]
```

### Cleanup:
- Remove `dev.brand.hookwing.com` after brand showcase moves to `brand.hookwing.com`

## CSP / CORS Notes

- All website pages must include `connect-src 'self' https://dev.api.hookwing.com` (dev) or `https://api.hookwing.com` (prod)
- API workers must set `Access-Control-Allow-Origin` for the corresponding website domain
- Playground already references `api.hookwing.com` in its CSP — needs to match actual API domain per env
