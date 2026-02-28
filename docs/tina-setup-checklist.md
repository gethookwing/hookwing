# TinaCMS Setup Checklist (Hookwing)

## Repository setup

- [ ] Confirm content folders exist:
  - `website/content/blog`
  - `website/content/docs`
- [ ] Add Tina config at `website/tina/config.js`.
- [ ] Add admin route shell at `website/admin/index.html`.
- [ ] Keep existing website routes unchanged.

## Local editor setup

- [ ] Install Tina tooling (`tinacms`, `@tinacms/cli`) in local workflow if needed.
- [ ] Set local env vars (do not commit):
  - `TINA_CLIENT_ID`
  - `TINA_TOKEN`
  - `TINA_BRANCH` (optional, defaults to current branch)
- [ ] Validate collection schema loads for `blog` and `docs`.

## CI/CD + Cloudflare

- [ ] Keep deploy target as static `website/`.
- [ ] Ensure `admin/` is included in deploy artifact.
- [ ] Verify branch previews continue to work on `design-lab`.
- [ ] Store Tina secrets in CI secret store only.

## Editorial workflow

- [ ] Create/edit markdown content in Tina or directly in Git.
- [ ] Open PR for review.
- [ ] Validate content preview on Cloudflare Pages branch URL.
- [ ] Merge only after tech + marketing review signoff.

## Safety checks

- [ ] No secrets in committed files.
- [ ] No changes to API runtime or production auth paths.
- [ ] No regressions in existing static pages.
