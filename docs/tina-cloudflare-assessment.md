# TinaCMS + Cloudflare Assessment (Hookwing)

## Recommendation

Adopt a Git-backed TinaCMS workflow and host the Tina admin route as static assets on Cloudflare Pages.

This is the lowest-risk option for Hookwing's current static `website/` structure because it keeps publishing in the existing Git + deploy flow and does not require a framework migration.

## Proposed architecture

- Content source: Markdown in-repo under `website/content/blog` and `website/content/docs`.
- Tina schema: `website/tina/config.js` with `blog` + `docs` collections.
- Editor route: `website/admin/index.html` (placeholder shell for Tina admin output).
- Delivery: existing Cloudflare Pages deploy (`website/deploy-design-lab.sh`).

## Tradeoffs

## Benefits

- Minimal/non-breaking introduction to CMS patterns.
- Full auditability and rollback via Git history.
- Works with current branch preview process on Cloudflare (`design-lab`).

## Costs

- Rich visual inline editing is limited vs framework-native Tina integrations.
- Editorial auth/media setup still requires Tina Cloud or custom auth/media services.
- Non-technical editors still depend on PR review discipline unless more automation is added.

## Cloudflare compatibility notes

- Static assets and Markdown content are fully Cloudflare Pages compatible.
- Keep `TINA_TOKEN`, OAuth secrets, and API credentials out of repo and only in local/CI environment variables.
- Build output path should remain inside `website/` so deploy scripts stay unchanged.

## Decision

Proceed with minimal scaffolding now, validate team workflow, then decide whether to deepen Tina integration (auth/media/live editing) in a second phase.
