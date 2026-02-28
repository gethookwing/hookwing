# Tina Workflow Validation

## Objective coverage summary

- End-to-end content pipeline (edit -> build -> generated routes) validated with two sample changes.
- Deterministic generation verified via `website/scripts/validate-content.mjs`.
- Deploy step attempted; blocked without `CLOUDFLARE_API_TOKEN`.

## Sample change A

- Change: Added new post `website/content/blog/cloudflare-preview-ops.md`.
- Result:
  - Generated `/blog/cloudflare-preview-ops/`
  - Generated author page `/blog/authors/maya-chen/`
  - Generated category page `/blog/categories/operations/`
  - Generated tag pages `/blog/tags/cloudflare/`, `/blog/tags/workflow/`, `/blog/tags/preview/`

## Sample change B

- Change: Upgraded metadata and media fields in `website/content/blog/webhook-retry-best-practices.md`.
- Result:
  - Post detail now renders author + category + tags + reading time + hero image + captioned visuals.
  - Index cards and taxonomy pages updated automatically.

## Determinism check

Command:

```bash
npm --prefix website run check:content
```

Expected result:

- Lint/check scripts pass.
- Two consecutive builds generate identical output hash.

## Deploy reliability

Deploy command:

```bash
./website/deploy-design-lab.sh hookwing-design-lab design-lab
```

Current blocker:

- Requires `CLOUDFLARE_API_TOKEN` in environment.
