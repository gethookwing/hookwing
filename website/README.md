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
./website/deploy-design-lab.sh hookwing-design-lab design-lab
```

This first builds blog/docs routes from Tina-managed markdown under `website/content/`, then publishes a branch preview URL you can share for feedback.

## Feedback loop
1. I ship 3–4 variants
2. You review URLs
3. You pick one + request changes
4. I iterate and redeploy
