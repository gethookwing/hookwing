# Hookwing Blog Objective — Full Modern Production Setup

## Mission
Build a fully modern, production-grade blog system for Hookwing with Tina-managed content, polished design system, robust metadata, and scalable authoring workflow.

## Deadline posture
- Priority: **P0**
- Effort posture: **Work continuously until complete**
- Stop condition: **Only when all acceptance criteria below are met and validated**

## Quantifiable Objectives (must all be true)

### 1) Content model completeness (100%)
Each post must support and render:
- title
- slug
- description
- author (name + role + avatar)
- publish date + updated date
- tags (multi)
- category
- reading time
- hero image + alt text
- draft/published state

**Target:** 10/10 fields implemented in schema + rendered on pages.

### 2) Page templates (modern + consistent)
Implement and style:
- blog home/index page
- blog post detail page
- tag page(s)
- category page(s)
- author page(s)
- docs index + docs article page (consistent system)

**Target:** 6/6 templates implemented and linked.

### 3) Design quality
- Responsive design for mobile/tablet/desktop
- Clean typography scale + spacing system
- Metadata chips (tags/date/author/reading time)
- CTA block template at end of each post
- Accessible color contrast and semantic structure

**Target:**
- Responsive pass on 3 breakpoints
- Lighthouse Accessibility >= 90 on blog post page

### 4) Rendering fidelity
Markdown renderer must support:
- headings, paragraphs
- unordered + ordered lists
- blockquotes
- fenced code blocks
- inline code
- links
- images + captions
- emphasis (bold/italic)

**Target:** 100% of above elements render correctly in a demo article.

### 5) Tina workflow quality
- Tina config for blog + docs collections
- editor route available in preview
- content changes regenerate pages deterministically
- clear editorial docs for writing/publishing

**Target:** end-to-end edit -> build -> deploy verified for 2 sample changes.

### 6) Deployment + preview reliability
- Deploy script runs content build automatically before Pages deploy
- preview URL stable for review cycle
- no secrets in repo

**Target:** 3 consecutive successful preview deploys.

### 7) Security & quality gates
- no secret leaks
- repo scope compliance (public docs + product code only)
- lint/build checks pass for website pipeline

**Target:** zero security findings in changed files, zero blocked pushes.

## Execution rule
Work relentlessly with Codex in monitored mode (`acpx --approve-all codex`) until all targets are complete.

## Reporting format
For each progress update:
1. Completed criteria IDs
2. Current blocker (if any)
3. Preview URL
4. Next 3 actions
