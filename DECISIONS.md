# DECISIONS.md — Product Decision Log

> Canonical record of product decisions. Agents MUST check this file before implementing new features or making significant changes. Only Fabien can override entries.

| Date | Decision | Decided By | Rationale |
|------|----------|------------|-----------|
| 2026-03-13 | No dark mode toggle — site is dark-themed by default, no light/dark switch | Fabien | Site already uses dark color palette; toggle adds complexity for no value |
| 2026-03-13 | Remove Fazier badge from footer | Fabien | Will add badges later when we have enough traction on a platform |
| 2026-03-13 | Free tier event retention = 7 days | Fabien | Consistent across pricing page and homepage |
| 2026-03-13 | No `pnpm` — use `npm` throughout monorepo | Fabien | Simpler tooling, avoid workspace:* protocol issues |
| 2026-03-13 | All deploys through CI — no manual deploys | Fabien | SOC 2 principle: audit trail for all changes |
| 2026-03-13 | Dev domain only (dev.hookwing.com) — never share .pages.dev URLs | Fabien | Cloudflare Access protects dev domains; .pages.dev is unprotected |
| 2026-03-13 | Infrastructure separation: product infra ≠ operational tooling | Fabien | SOC 2 Type 2 compliance principle |
| 2026-03-15 | 3-tier pricing: Paper Plane ($0, 25K), Warbird ($19, 100K), Fighter Jet ($89, 10M) — all fixed prices, no "contact us" | Fabien/Remi | Research-backed, generous free tier, overage on Warbird |
