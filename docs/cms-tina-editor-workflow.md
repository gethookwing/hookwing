# Tina Editor Workflow (Hookwing)

## Goal

Publish blog/docs content with reviewable, Cloudflare-previewed Git changes.

## Day-to-day flow

1. Start a branch (`feature/content-...`).
2. Edit content in Tina (`/admin`) or directly in Markdown files under `website/content/`.
3. Commit content changes.
4. Open a PR.
5. Review content on Cloudflare branch preview URL (`design-lab`).
6. Merge after approvals.

## Review checklist

- Content renders correctly (headings, lists, links, images).
- Slug is stable and URL-safe.
- Summary is concise and accurate.
- Draft flag is correct.
- No secrets or internal-only data.

## Rollback

If content is incorrect after merge:

1. Revert the commit in Git.
2. Redeploy `design-lab` preview.
3. Promote corrected commit after validation.

## Ownership

- Marketing owns tone/message and publication readiness.
- Tech owns schema, deploy reliability, and preview pipeline.
