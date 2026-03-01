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
