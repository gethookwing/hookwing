# Hookwing Design Lab (Cloudflare Pages)

## What this is
A lightweight preview hub for design concepts:
- `/` design chooser
- `/v1-a` Sky Ops
- `/v1-b` Sunset Route
- `/v1-c` Radar Dark
- `/v1-d` Paper Flight

## Deploy
From `tech/hookwing`:

```bash
export CLOUDFLARE_API_TOKEN=...
./website/deploy-design-lab.sh hookwing-design-lab tina-cms-preview-dev
```

This first builds blog/docs routes from Tina-managed markdown under `website/content/`, prepares a preview-only artifact, and publishes a dev preview URL.
The deploy script refuses production branch aliases (`main`, `master`, `production`).

## Content pipeline checks

```bash
npm --prefix website run build:content
npm --prefix website run check:content
```

`check:content` verifies deterministic HTML generation for blog/docs pages.

## Preview surface scope

Preview deploys include only:

- `/blog`
- `/docs`
- `/admin`
- `/assets`
- `/` (preview landing with links above)

Legacy design iteration routes (`/v1-*` through `/v11-*`) are excluded from preview deploy artifacts.

## Blog media strategy

- Source images live in `website/assets/blog/`.
- Build pipeline generates optimized WebP assets in `website/assets/blog/optimized/`.
- Blog metadata references production-safe absolute paths under `/assets/blog/optimized/...`.
- Markdown image syntax supports alt text and optional captions.

## Feedback loop
1. I ship 3–4 variants
2. You review URLs
3. You pick one + request changes
4. I iterate and redeploy
