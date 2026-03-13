# Website Blog Changelog

## 2026-03-01

- Added Tina author model with dedicated `authors` collection and blog author references.
- Upgraded renderer to include:
  - table of contents from heading structure
  - metadata row with author/published/updated/reading time/category/tags
  - standardized author block and CTA block
  - taxonomy pages for tags/categories plus list indexes
  - client-side search over title/summary/body/tags
- Added SEO and distribution artifacts:
  - canonical URLs, Open Graph, Twitter metadata
  - Article JSON-LD for post pages
  - `sitemap.xml` generation for blog/docs routes
  - `blog/rss.xml` feed generation
- Added media optimization step with WebP output under `assets/blog/optimized`.
- Kept deploy workflow non-destructive while preserving Cloudflare Pages preview flow.

## 2026-03-02

- Blog post design polish sprint:
  - Before: dense post header/meta with limited hierarchy.
  - After: structured post header (`category eyebrow`, refined metadata chips, stronger hero framing).
- Improved typography and spacing rhythm for long-form readability:
  - tighter heading spacing logic
  - wider body line-height rhythm and constrained content measure
  - clearer TOC sidebar hierarchy and sticky behavior.
- Standardized media treatment:
  - hero ratio and max height constraints
  - consistent inline figure framing/caption style
  - markdown image paths under `/assets/blog/` now auto-map to optimized WebP in render.
