# Hookwing — Claude Code Instructions

**Purpose:** This file tells Claude Code how to work with Hookwing. Updated based on best practices research.

---

## Project Overview

Hookwing is a webhook infrastructure SaaS (B2B). We're building:
- Cloudflare Workers for API
- D1 for database
- Terraform for infrastructure
- React dashboard (future)

---

## Key Principles (Based on Best Practices)

### 1. Keep It Simple
- Prefer 100 lines of code over 1000
- Don't over-engineer solutions
- Ship fast, iterate

### 2. State What, Not How
- Tell Claude WHAT to build, not HOW to build it step-by-step
- Trust Claude to find good implementations

### 3. Less Is More
- CLAUDE.md should be < 300 lines, ideally < 60
- Only universally applicable instructions go here
- Project-specific docs go in subfolders

### 4. Watch Like a Hawk
- Review ALL code changes in IDE
- Don't let Claude change code it doesn't understand
- Test before committing

---

## Project Structure

```
~/hookwing/
├── CLAUDE.md              # This file
├── terraform/             # Infrastructure as code
├── workers/               # Cloudflare Workers
├── dashboard/             # React dashboard (future)
└── scripts/              # DevOps scripts
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Infra | Terraform/OpenTofu |
| Workers | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 |
| Queue | Cloudflare Queues |
| Auth | Lucia |
| Payments | Stripe (test: pk_test_*, sk_test_*) |
| Email | Resend (dex@hookwing.com) |

---

## Secrets & Environment

- **Location:** `~/.openclaw/secrets.json` (NEVER print)
- **Cloudflare:** `CLOUDFLARE_API_TOKEN` env var
- **GitHub:** `GH_TOKEN` or SSH key

---

## Working with Claude Code

### For Infrastructure (Terraform)
```bash
cd ~/hookwing/terraform
terraform plan    # Review before apply
terraform apply   # Deploy
```

### For Workers
```bash
cd ~/hookwing/workers/hookwing-api
npm run dev     # Local dev
npm run deploy  # Production
wrangler tail  # View logs
```

### Git Workflow
1. Create branch: `git checkout -b feature/xxx`
2. Make changes
3. Test locally
4. Commit with clear message
5. Push: `git push origin feature/xxx`
6. Create PR (or ask for review)

---

## Rules

1. **Never commit secrets** — Use `.gitignore`, env vars
2. **Always review** — Don't trust AI code blindly
3. **Test locally first** — Before deploy
4. **Small commits** — Atomic, readable changes
5. **Ask for big decisions** — Escalate to Fabien

---

## Environments

| Env | Purpose | Branch |
|-----|---------|--------|
| dev | Development | develop |
| staging | Pre-production | main |
| prod | Production | main (tagged) |

---

## CI/CD

GitHub Actions runs on push to:
- `develop` → Deploys to staging
- `main` → Deploys to production (with approval)

---

## Common Tasks

### Deploy Worker
```bash
cd ~/hookwing/workers/hookwing-api
wrangler deploy --env production
```

### Add Terraform Resource
1. Edit `terraform/main.tf`
2. `terraform plan`
3. `terraform apply`

### Run Tests
```bash
cd ~/hookwing/workers/hookwing-api
npm test
```

---

## What's NOT Here

- Detailed code style → Use inline comments
- Specific commands → Use scripts/
- Project history → Use git log

---

## References

- Karpathy's CLAUDE.md: minimal, focused
- Araine's best practices: repo-specific optimization
- HumanLayer: < 60 lines, progressive disclosure
