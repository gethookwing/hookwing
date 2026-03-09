# CLAUDE.md — Instructions for AI coding agents

> **For detailed engineering standards, see [ENGINEERING.md](./ENGINEERING.md).**

## Repository Structure

```
hookwing/
├── .github/workflows/   # CI/CD pipelines (GitHub Actions)
│   ├── ci.yml           # Lint → Typecheck → Test → Build (runs on all pushes + PRs)
│   ├── deploy-dev.yml   # Deploy to dev.hookwing.com (feature branches)
│   └── deploy-prod.yml  # Deploy to hookwing.com (main branch, requires CI)
├── packages/            # Monorepo packages
│   ├── api/             # Cloudflare Workers API
│   ├── shared/          # Shared types, schemas, utilities
│   └── config/          # Runtime configuration schemas
├── website/             # Marketing site + blog
│   ├── index.html       # Homepage
│   ├── pricing/         # Pricing page
│   ├── why-hookwing/    # Why Hookwing page
│   ├── getting-started/ # Getting Started page
│   ├── playground/      # WIP placeholder
│   ├── status/          # WIP placeholder
│   ├── signin/          # WIP placeholder
│   ├── privacy/         # Privacy policy
│   ├── terms/           # Terms of service
│   ├── changelog/       # Changelog
│   ├── docs/            # Documentation
│   ├── blog/            # Built blog output (generated, do not edit)
│   ├── content/         # Markdown sources
│   │   ├── blog/        # Blog article markdown
│   │   └── authors/     # Author profiles
│   ├── assets/          # Images, illustrations, avatars
│   ├── scripts/         # Build tooling
│   │   ├── build-content.mjs     # Main build script
│   │   ├── optimize-images.mjs   # Image compression (WebP)
│   │   ├── validate-content.mjs  # Content validation
│   │   └── prepare-preview-dist.mjs
│   ├── tina/            # TinaCMS config
│   ├── package.json     # Dependencies + npm scripts
│   └── favicon.svg
├── app/                 # Customer dashboard (future)
├── docs/                # Public developer docs (future)
├── turbo.json           # Turborepo config
├── pnpm-workspace.yaml  # PNPM workspace config
└── package.json         # Root workspace package.json
```

## Monorepo (packages/)

Cross-package imports use the `@hookwing/*` scope:

```json
{
  "dependencies": {
    "@hookwing/shared": "workspace:*",
    "@hookwing/config": "workspace:*"
  }
}
```

### NPM Scripts (Root)

```bash
pnpm install           # Install all dependencies
pnpm build            # Build all packages
pnpm build --filter=api    # Build specific package
pnpm test             # Test all packages
pnpm test --filter=api    # Test specific package
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm dev              # Dev all packages
pnpm dev --filter=api # Dev specific package
```

### Package Structure

```
packages/
├── api/
│   ├── src/
│   │   ├── routes/       # Hono route handlers
│   │   ├── services/     # Business logic
│   │   ├── middleware/  # Custom middleware
│   │   ├── db/           # Drizzle schema + migrations
│   │   └── index.ts      # Entry point
│   ├── wrangler.toml
│   └── package.json
├── shared/
│   ├── src/
│   │   ├── types/        # Shared TypeScript types
│   │   ├── schemas/     # Zod schemas
│   │   └── utils/       # Utility functions
│   └── package.json
└── config/
    ├── src/
    │   ├── tiers.ts     # Tier/feature configuration
    │   └── features.ts  # Feature flags
    └── package.json
```

## CI/CD Pipeline

**All deploys go through GitHub Actions. No manual deploys.**

### Workflow

1. **Push to feature branch** → CI runs (lint + typecheck + test + build)
2. **Push to feature branch with packages/ changes** → CI + deploy to dev.hookwing.com
3. **Merge PR to main with packages/ changes** → CI + deploy to hookwing.com (production)
4. **Manual dispatch** → Either workflow can be triggered manually

### NPM Scripts (run from `website/`)

```bash
npm run lint       # Syntax check all scripts
npm run validate   # Validate content frontmatter and structure
npm test           # lint + validate
npm run build      # optimize images + build blog HTML
```

### Local Development

```bash
# For website/
cd website
npm install
npm test           # Always run before committing
npm run build      # Build blog to website/blog/

# For monorepo packages/
pnpm install
pnpm build         # Build all packages
pnpm test          # Test all packages
```

## Rules

### Code Quality
- All changes must pass CI (lint + typecheck + test + build) before merge
- PR required for all changes to main
- No direct pushes to main
- See [ENGINEERING.md](./ENGINEERING.md) for TypeScript, testing, and API standards

### Security
- **NEVER commit secrets, API keys, or tokens**
- Secrets are GitHub Actions secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
- No hardcoded credentials anywhere
- See [ENGINEERING.md](./ENGINEERING.md) for security patterns

### Blog Content
- Blog articles are **markdown** in `website/content/blog/`
- Build script generates HTML to `website/blog/` — **never edit blog/ directly**
- Blog lives at `/blog/` path (not a subdomain)
- Images go in `website/assets/blog/` — optimizer creates WebP versions

### Content Conventions
- Summary section: always titled "In short" (not TL;DR, Summary, etc.)
- Section numbering: CSS counters handle it. Don't hardcode numbers in headings.
- Headings like "In short", "Conclusion", "Ready to..." are auto-detected as unnumbered
- Target article length: ~1,000 words
- Author must be specified in frontmatter

### Design
- Paper plane logo (SVG) — consistent across all pages
- Nav and footer must match across all pages
- Brand colors: #002A3A (Ink), #009D64 (Runway Green), #FFC107 (Signal Amber)
- Aviation theme throughout (Paper Plane → Biplane → Warbird → Jet tiers)
- Positioning: "Built for developers and AI agents"

### Deployment
- Dev: `hookwing-dev` Cloudflare Pages project → dev.hookwing.com
- Prod: `hookwing-prod` Cloudflare Pages project → hookwing.com
- Cache busting: version meta tag injected at deploy time
- Blog + website deploy as a single unit
