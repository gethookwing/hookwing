# CLAUDE.md - Hookwing Development Guide

> Security is paramount. Never compromise.

---

## Security First

**ABSOLUTE RULES:**

1. **NEVER commit secrets to GitHub**
   - No API keys, tokens, credentials in code
   - No `.env` files in repo
   - Use `.env.example` as template only

2. **Use environment variables for all secrets**
   - Store in `.env` locally (add to `.gitignore`)
   - In production: Cloudflare Secrets or external vault

3. **Secrets management hierarchy:**
   ```
   Local dev:    .env file (never commit)
   Cloudflare:   wrangler secrets
   Production:   Cloudflare Secrets + rotation
   ```

4. **Never log secrets**
   - Don't print API keys, tokens, credentials
   - Redact in error messages
   - Use `[REDACTED]` in all outputs

---

## Project Structure

```
hookwing/tech/hookwing/
├── api/              # Cloudflare Workers
│   ├── src/          # Source code
│   ├── migrations/   # D1 migrations
│   ├── wrangler.jsonc
│   └── .gitignore   # Must include .env, secrets
├── website/          # Marketing site (future)
├── app/              # Dashboard (future)
└── docs/             # Documentation (future)
```

---

## Environment Setup

### Local Development

```bash
# 1. Copy example env
cp api/.env.example api/.env

# 2. Add your secrets
# - CLOUDFLARE_API_TOKEN
# - RESEND_API_KEY
# - DATABASE_URL (for local D1)

# 3. NEVER commit .env
```

### Cloudflare Secrets

```bash
# Add secrets to Workers
wrangler secret put RESEND_API_KEY
wrangler secret put DATABASE_URL
```

---

## Working with Claude Code

When spawning Claude Code:

1. **Never pass secrets in prompts**
2. **Use environment variables**
3. **Review all code before commit**

Example:
```bash
# Good - use env var in code
const apiKey = env.RESEND_API_KEY;

# Bad - hardcoded secret
const apiKey = "sk_live_xxxxx";  # NEVER
```

---

## Deployment Checklist

- [ ] No secrets in code
- [ ] `.env` in `.gitignore`
- [ ] Cloudflare secrets set
- [ ] D1 migrations applied
- [ ] Tests pass

---

## Incident Response

If you suspect a secret was leaked:
1. **Immediate:** Rotate the secret
2. **Notify:** Tell the team
3. **Fix:** Update the code/practice
4. **Learn:** Document what went wrong
