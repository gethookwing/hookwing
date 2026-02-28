# CMS Setup: TinaCMS (Hookwing)

## Scope

This setup adds non-breaking Tina scaffolding for two content collections:

- `blog` at `website/content/blog`
- `docs` at `website/content/docs`

## Files added

- `website/tina/config.js`
- `website/admin/index.html`
- `website/content/blog/webhook-retry-best-practices.md`
- `website/content/docs/getting-started.md`

## Local usage

From repo root:

```bash
cd website
npx tina dev
```

If using Tina Cloud, set env vars locally before running:

```bash
export TINA_CLIENT_ID=...
export TINA_TOKEN=...
export TINA_BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

## Collection model

`blog` fields:

- `title` (string)
- `slug` (string)
- `date` (datetime)
- `draft` (boolean)
- `summary` (string)
- `body` (rich-text body)

`docs` fields:

- `title` (string)
- `slug` (string)
- `updatedAt` (datetime)
- `summary` (string)
- `body` (rich-text body)

## Deploy

Deploy remains unchanged and publishes static assets from `website/`:

```bash
./website/deploy-design-lab.sh hookwing-design-lab design-lab
```

## Notes

- This change does not modify existing blog HTML routes.
- This is scaffolding-first; deeper editor auth/media configuration can be added later.
