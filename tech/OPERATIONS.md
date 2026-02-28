# Tech Operations

## TinaCMS workflow

## Purpose

Maintain Tina schema, guardrails, and Cloudflare preview reliability for content publishing.

## Responsibilities

- Maintain `website/tina/config.js` collections and field schema.
- Keep `website/admin/` route deployable as static assets.
- Ensure `website/content/blog` and `website/content/docs` stay lintable and reviewable.
- Keep secrets (`TINA_*`, OAuth credentials) out of Git.

## Technical release flow

1. Create/update schema or content in a branch.
2. Run available checks (`api` tests + any site checks).
3. Deploy branch preview (`design-lab`) and validate rendering.
4. Merge after approvals.

## Incident response

- If admin route fails, keep content publishing through direct markdown PRs.
- If schema regression occurs, revert schema commit and redeploy preview.
