# Tina Editorial Workflow

## Scope

This workflow covers writing and publishing website blog/docs content from Tina-managed markdown under `website/content/`.

## Authoring flow

1. Create a branch from `feature/tina-cms-cloudflare` (or latest integration branch).
2. Edit content in Tina admin (`/admin`) or directly in markdown.
3. Validate metadata completeness for blog posts:
   - `title`, `slug`, `description`
   - `author.name`, `author.role`, `author.avatar`
   - `publishDate`, `updatedDate`
   - `tags`, `category`, `readingTime`
   - `heroImage`, `heroImageAlt`
   - `draft`
4. Run:
   - `npm --prefix website run build:content`
   - `npm --prefix website run check:content`
5. Open PR and request review with preview URL.

## Publishing rules

- Keep `draft: true` for unreleased posts.
- Only merge after content + technical review.
- Never commit secrets; Tina and Cloudflare tokens must remain environment variables.

## Template coverage

Generated routes include:

- `/blog/` index
- `/blog/{slug}/` post detail
- `/blog/tags/{tag}/`
- `/blog/categories/{category}/`
- `/blog/authors/{author}/`
- `/docs/` index
- `/docs/{slug}/` article
