# Hookwing Website — Deep Design Audit Report

**Date:** 2026-03-03  
**Auditor:** Dex (Design Subagent)  
**Pages audited:**
- `/` → `website/index.html`
- `/pricing` → `website/pricing/index.html`
- `/why` → `website/why-hookwing/index.html`
- `/start` → `website/getting-started/index.html`

**Reference:** `hookwing/brand/DESIGN-SYSTEM.md`

---

## Executive Summary

The Hookwing site is in excellent overall shape — consistent design tokens, good semantic structure, and thorough ARIA labeling on most elements. **Four critical issues** need immediate attention: missing skip-to-content links, no favicon, no og:image, and an incorrect ARIA role on the mobile nav. **Eight medium issues** affect consistency and professional polish. **Eight low-priority issues** are cleanup-level refinements.

---

## Issues by Category

---

### 🔴 CRITICAL

---

#### ISSUE-001
- **Category:** Accessibility
- **Severity:** Critical
- **Files:** ALL pages (index.html, pricing/index.html, why-hookwing/index.html, getting-started/index.html)
- **What's wrong:** No skip-to-content link on any page. All pages have `<main id="main-content">` already, so the anchor target exists — but the skip link itself is missing. Screen reader / keyboard users must tab through the entire nav before reaching content.
- **Exact fix:** Add immediately after `<body>`, before the `<header>`, on every page:
  ```html
  <a href="#main-content" class="skip-link">Skip to main content</a>
  ```
  Add this CSS once in each page's `<style>` block (or shared stylesheet):
  ```css
  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-4);
    background: var(--color-brand-primary);
    color: var(--color-ink-inverse);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
    text-decoration: none;
    transition: top var(--dur-fast) var(--ease);
  }
  .skip-link:focus {
    top: var(--space-2);
  }
  ```

---

#### ISSUE-002
- **Category:** Code Quality
- **Severity:** Critical
- **Files:** ALL pages
- **What's wrong:** No favicon defined on any page. No `<link rel="icon">` tag in any `<head>`. The browser tab shows a blank/generic icon, which hurts brand recognition and looks unprofessional.
- **Exact fix:** Add to `<head>` on every page (after the viewport meta):
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  ```
  Create a minimal `favicon.svg` using the Hookwing ✈️ / paper plane motif in brand navy (`#002A3A`) on transparent background.

---

#### ISSUE-003
- **Category:** Code Quality / SEO
- **Severity:** Critical
- **Files:** ALL pages
- **What's wrong:** `og:image` meta property is missing from all four pages. When shared on Twitter/X, LinkedIn, Slack, iMessage, or any link-preview renderer, the link card appears with no image. This dramatically reduces click-through rate.
- **Exact fix:** Add to `<head>` on every page (after existing OG tags):
  ```html
  <meta property="og:image" content="https://hookwing.com/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://hookwing.com/og-image.png" />
  ```
  Create a 1200×630 OG image with brand navy background, white Hookwing wordmark, and green accent. Create page-specific variants for pricing/why/start as secondary priority.

---

#### ISSUE-004
- **Category:** Accessibility
- **Severity:** Critical
- **Files:** ALL pages
- **What's wrong:** The mobile navigation overlay `<div id="nav-mobile">` uses `role="dialog"` on all four pages. This is semantically incorrect — a collapsible navigation menu is not a dialog. Applying `role="dialog"` causes screen readers to announce it as a modal dialog, trapping focus and confusing users. It also requires `aria-modal="true"` and focus management that is not implemented.
- **Exact fix:** On all 4 pages, change:
  ```html
  <!-- BEFORE -->
  <div id="nav-mobile" class="nav-mobile" role="dialog" aria-label="Mobile navigation">
  
  <!-- AFTER -->
  <div id="nav-mobile" class="nav-mobile" aria-hidden="true">
  ```
  The outer `<header>` already wraps a `<nav>` element; the mobile dropdown should simply be `aria-hidden="true"` when closed and `aria-hidden="false"` when open (toggle this in JS alongside `is-open` class). The `aria-controls` + `aria-expanded` on the hamburger button is already correct and sufficient.

  Update the JS toggle on all pages to also manage `aria-hidden`:
  ```js
  toggle.addEventListener('click', function () {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    mobileNav.classList.toggle('is-open', !expanded);
    mobileNav.setAttribute('aria-hidden', String(expanded)); // toggle
  });
  ```

---

### 🟡 MEDIUM

---

#### ISSUE-005
- **Category:** Consistency
- **Severity:** Medium
- **Files:** `getting-started/index.html`
- **What's wrong:** The nav logo on the Getting Started page uses an inline SVG paper plane icon, while **all other three pages** use the ✈️ emoji. This creates a jarring inconsistency when navigating between pages — the logo visually changes.
  
  **Homepage/Pricing/Why nav logo:**
  ```html
  <a href="/" class="nav-logo" aria-label="Hookwing — home">
    ✈️ Hookwing
  ```
  
  **Getting-started nav logo:**
  ```html
  <a href="/" class="nav-logo" aria-label="Hookwing — home">
    <svg width="20" height="20" ...>...</svg>
    Hookwing
  ```
- **Exact fix:** Replace the SVG block in `getting-started/index.html`'s nav logo (and its footer logo) with the ✈️ emoji to match all other pages:
  ```html
  <!-- Nav logo - line 1273 -->
  <a href="/" class="nav-logo" aria-label="Hookwing — home">
    ✈️ Hookwing
  </a>
  
  <!-- Footer logo - line 2032 -->
  <a href="/" class="footer-brand-name" aria-label="Hookwing home">
    ✈️ Hookwing
  </a>
  ```
  *(Note: long-term, ALL pages should migrate to a proper SVG icon for better rendering at all sizes. But consistency is the immediate fix.)*

---

#### ISSUE-006
- **Category:** Consistency / Polish
- **Severity:** Medium
- **Files:** `index.html`, `why-hookwing/index.html`
- **What's wrong:** The `.nav-link.active` CSS style is inconsistently defined across pages:
  - **Pricing:** `.nav-link.active { color: var(--color-brand-action); background: var(--color-success-bg); }` ✓ (correct — full highlight)
  - **Getting-started:** Same as pricing ✓ (but no active class applied since `/start` isn't in the nav)
  - **Why Hookwing:** `.nav-link.active { color: var(--color-brand-action); }` ❌ (color-only — **missing background**)
  - **Homepage:** **No `.nav-link.active` definition at all** ❌

  The active nav indicator on the Why Hookwing page is a subtle color change only, while Pricing gets a green-tinted pill background — visually inconsistent to users navigating across pages.
- **Exact fix:**
  1. In `why-hookwing/index.html`, update the active nav CSS (around line 328):
     ```css
     .nav-link.active { color: var(--color-brand-action); background: var(--color-success-bg); }
     ```
  2. In `index.html`, add `.nav-link.active` definition after `.nav-link:hover` (around line 428):
     ```css
     .nav-link.active { color: var(--color-brand-action); background: var(--color-success-bg); }
     ```
     *(The homepage doesn't currently need it since there's no `/` nav link, but it should be defined for future-proofing.)*

---

#### ISSUE-007
- **Category:** Accessibility / Consistency
- **Severity:** Medium
- **Files:** `pricing/index.html`, `why-hookwing/index.html`
- **What's wrong:** The `aria-current="page"` attribute is correctly applied to the **desktop** active nav link on pricing and why-hookwing pages. However, the corresponding **mobile nav** (`<ul class="nav-mobile-links">`) does NOT include `aria-current="page"` on the active item on either page. Screen reader users on mobile who use the hamburger nav get no indication of the current page.
- **Exact fix:**
  
  In `pricing/index.html`, mobile nav (around line 1488):
  ```html
  <!-- BEFORE -->
  <li><a href="/pricing" class="nav-mobile-link">Pricing</a></li>
  
  <!-- AFTER -->
  <li><a href="/pricing" class="nav-mobile-link active" aria-current="page">Pricing</a></li>
  ```
  
  In `why-hookwing/index.html`, mobile nav:
  ```html
  <!-- BEFORE -->
  <li><a href="/why" class="nav-mobile-link">Why Hookwing</a></li>
  
  <!-- AFTER -->
  <li><a href="/why" class="nav-mobile-link active" aria-current="page">Why Hookwing</a></li>
  ```
  Add `.nav-mobile-link.active { color: var(--color-brand-action); }` to CSS on both pages.

---

#### ISSUE-008
- **Category:** Typography / Consistency
- **Severity:** Medium
- **Files:** `why-hookwing/index.html`
- **What's wrong:** The Why Hookwing hero title uses `clamp(40px, 5.5vw, 68px)` which produces a **68px** maximum — noticeably larger than:
  - Homepage: `clamp(36px, 5.5vw, 64px)` → 64px max
  - Pricing: `clamp(36px, 5vw, 60px)` → 60px max
  - Getting-started: `clamp(36px, 5vw, 60px)` → 60px max

  A visitor flipping between homepage and why-hookwing notices the headline jumps in size. The vw multiplier also differs (5.5 vs 5.0), so it scales differently at medium widths.
- **Exact fix:** In `why-hookwing/index.html`, update `.why-hero-title` font-size (around line 473):
  ```css
  .why-hero-title {
    font-size: clamp(36px, 5.5vw, 64px); /* was clamp(40px, 5.5vw, 68px) */
    ...
  }
  ```
  This brings it in line with the homepage (same vw factor, same 64px cap).

---

#### ISSUE-009
- **Category:** Responsive
- **Severity:** Medium
- **Files:** `pricing/index.html`
- **What's wrong:** The pricing plan card grid (`.pricing-grid`) collapses from 4-columns to 2-columns at `1200px` — a non-standard breakpoint used **only on this page**. All other grids across all pages use `1024px` as the standard collapse threshold. At viewport widths between 1024px and 1200px, the pricing cards are unusually cramped with text overflow and tight padding.
- **Exact fix:** In `pricing/index.html`, update the pricing grid media query (around line 1041):
  ```css
  /* BEFORE */
  @media (max-width: 1200px) {
    .pricing-grid { grid-template-columns: repeat(2, 1fr); }
  }
  
  /* AFTER */
  @media (max-width: 1023px) {
    .pricing-grid { grid-template-columns: repeat(2, 1fr); }
  }
  ```
  Also audit whether the comparison table at `900px` (line 1253) should also be moved to `1023px` for consistency.

---

#### ISSUE-010
- **Category:** Polish / Navigation
- **Severity:** Medium
- **Files:** `getting-started/index.html`
- **What's wrong:** The Getting Started page (`/start`) is **not listed in the primary desktop navigation** (nav only contains: Playground, Pricing, Docs, Why Hookwing). It is only accessible via the footer "Developers → Getting started" link. This means:
  1. There is no active nav state when a user is on this page — no visual indication of location.
  2. Users who land on this page cannot easily discover other sections via the nav context.
  
  The page is linked from every CTA ("Start free" → `/signup`, but Docs links to getting-started). Given the page is a key conversion path, it deserves nav presence.
- **Exact fix (Option A — add to nav):** Add "Get started" to all 4 pages' nav lists:
  ```html
  <li><a href="/start" class="nav-link">Get started</a></li>
  ```
  Then add `active` + `aria-current="page"` on the getting-started page.
  
  **Option B (minimal):** Keep the page out of nav but add a breadcrumb or page-level indicator. At minimum, add `aria-label="You are here: Getting Started"` to the page hero.

---

#### ISSUE-011
- **Category:** Accessibility / Polish
- **Severity:** Medium
- **Files:** ALL pages
- **What's wrong:** Dark mode is fully implemented in the CSS (via `[data-theme="dark"]` token overrides) and in JavaScript (reads `localStorage` + `prefers-color-scheme`). However, **there is no UI toggle button** in the nav for users to manually switch themes. The system-preference detection is a good baseline, but users who want to override it (e.g., use dark mode on a light-system device) have no affordance.
- **Exact fix:** Add a theme toggle button to `.nav-actions` on all pages, before the "Sign in" link:
  ```html
  <button class="theme-toggle btn-ghost btn-md" id="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">
    <!-- Sun icon (show when dark mode active) -->
    <svg class="icon-sun" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <!-- Moon icon (show when light mode active) -->
    <svg class="icon-moon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M15 10.5A7 7 0 0 1 7.5 3a7.5 7.5 0 1 0 7.5 7.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  </button>
  ```
  Update the JS dark-mode section to toggle the button state and use `localStorage.setItem('theme', newTheme)`.

---

#### ISSUE-012
- **Category:** Code Quality / SEO
- **Severity:** Medium
- **Files:** ALL pages
- **What's wrong:** No `twitter:card` meta tag on any page. Without it, Twitter/X uses the default "summary" card format which shows a tiny thumbnail. Adding `twitter:card: summary_large_image` enables the full-width image card format — essential for developer content marketing.
- **Exact fix:** Add to `<head>` on every page (part of the same fix as ISSUE-003):
  ```html
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@hookwing" />
  <meta name="twitter:title" content="[Page-specific title]" />
  <meta name="twitter:description" content="[Page-specific description]" />
  <meta name="twitter:image" content="https://hookwing.com/og-image.png" />
  ```

---

### 🟢 LOW

---

#### ISSUE-013
- **Category:** Typography / Consistency
- **Severity:** Low
- **Files:** `getting-started/index.html`
- **What's wrong:** The `.page-hero-eyebrow` badge on the Getting Started page uses `font-size: 12px`, while the equivalent eyebrow component on the homepage (`.hero-eyebrow`), pricing (`.pricing-hero-eyebrow`), and why-hookwing (`.why-hero-eyebrow`) all use `font-size: 13px`.
- **Exact fix:** In `getting-started/index.html`, update around line ~460:
  ```css
  .page-hero-eyebrow {
    ...
    font-size: 13px; /* was 12px */
    ...
  }
  ```

---

#### ISSUE-014
- **Category:** Code Quality
- **Severity:** Low
- **Files:** ALL pages
- **What's wrong:** All pages use `<nav class="nav" role="navigation" aria-label="Main navigation">`. The `role="navigation"` is **redundant** on a `<nav>` element — the `<nav>` landmark already implies this role implicitly. It's not harmful but adds unnecessary noise to the markup.
- **Exact fix:** On all 4 pages, remove `role="navigation"` from the `<nav>` tag:
  ```html
  <!-- BEFORE -->
  <nav class="nav" role="navigation" aria-label="Main navigation">
  
  <!-- AFTER -->
  <nav class="nav" aria-label="Main navigation">
  ```

---

#### ISSUE-015
- **Category:** Code Quality / Semantic HTML
- **Severity:** Low
- **Files:** ALL pages
- **What's wrong:** Footer column headings use `<h3 class="footer-col-heading">` styled as 12px uppercase labels. While not technically invalid HTML, using heading elements for purely decorative/organizational labels in the footer creates a confusing heading outline (h1 → h2 → h3 → suddenly footer h3s for "Product", "Developers", "Company", "Legal"). A screen reader's heading navigation would list these as landmarks on the same level as page section headings.
- **Exact fix:** Replace `<h3>` with `<p>` using `role="heading"` only if semantically needed, or simply use `<p>`:
  ```html
  <!-- BEFORE -->
  <h3 class="footer-col-heading">Product</h3>
  
  <!-- AFTER (preferred) -->
  <p class="footer-col-heading" role="heading" aria-level="3">Product</p>
  ```
  Or if heading semantics are desired, keep `<h3>` but add `aria-level="2"` since they are top-level footer section labels, not sub-section headings.

---

#### ISSUE-016
- **Category:** Responsive / Consistency
- **Severity:** Low
- **Files:** `why-hookwing/index.html`
- **What's wrong:** One media query on the Why Hookwing page uses `max-width: 767px` instead of the standard `768px` used everywhere else. This creates a 1px gap where neither the desktop nor mobile layout applies (at exactly 768px).
- **Exact fix:** In `why-hookwing/index.html`, search for `@media (max-width: 767px)` and change to `@media (max-width: 768px)`.

---

#### ISSUE-017
- **Category:** Responsive / Consistency
- **Severity:** Low
- **Files:** `pricing/index.html`
- **What's wrong:** The FAQ grid on the pricing page collapses at `900px` — a non-standard breakpoint not used anywhere else (standard pattern is 640/768/1024). While not visible to most users, it breaks the internal consistency of the breakpoint system.
- **Exact fix:** In `pricing/index.html`, update around line 1253:
  ```css
  /* BEFORE */
  @media (max-width: 900px) { .faq-grid { ... } }
  
  /* AFTER */
  @media (max-width: 1023px) { .faq-grid { ... } }
  ```

---

#### ISSUE-018
- **Category:** Responsive / Consistency
- **Severity:** Low
- **Files:** `getting-started/index.html`
- **What's wrong:** The SDK card grid on the Getting Started page has a breakpoint at `420px` — a non-standard value. Other pages use `479px` (homepage trust bar) or simply `639px/768px`.
- **Exact fix:** In `getting-started/index.html`, evaluate whether the `420px` SDK grid single-column rule is even needed (at 420px, the `639px` 2-column rule already handles this). If the 1-column layout is needed that early, change to `479px` to align with the homepage:
  ```css
  @media (max-width: 479px) {
    .sdk-grid { grid-template-columns: 1fr; }
  }
  ```

---

#### ISSUE-019
- **Category:** Accessibility / Typography
- **Severity:** Low
- **Files:** ALL pages
- **What's wrong:** The ✈️ emoji used in the nav logo and footer logo is rendered as an emoji character without `aria-hidden`. While the parent `<a>` has `aria-label="Hookwing — home"` (which takes precedence for screen readers), the emoji is also read by some screen readers in some contexts as "airplane emoji" separately from the label. The emoji should be explicitly silenced.
- **Exact fix:** Wrap the emoji with `aria-hidden="true"`:
  ```html
  <a href="/" class="nav-logo" aria-label="Hookwing — home">
    <span aria-hidden="true">✈️</span> Hookwing
  </a>
  ```

---

#### ISSUE-020
- **Category:** Accessibility
- **Severity:** Low
- **Files:** ALL pages
- **What's wrong:** The `<header>` element wraps both the sticky nav `<nav>` and the mobile dropdown `<div id="nav-mobile">`. When the mobile nav `is-open`, the mobile nav content is visible but `aria-hidden` is never toggled (it's always absent/false). This means screen readers can access the mobile nav links even when they're visually hidden (CSS `display: none`). While `display:none` hides from AT by default, adding explicit `aria-hidden` management is best practice for dynamic show/hide patterns.
- **Exact fix:** Initialize `aria-hidden="true"` on `#nav-mobile` on all pages:
  ```html
  <div id="nav-mobile" class="nav-mobile" aria-hidden="true">
  ```
  Then in JS, toggle it alongside `is-open`:
  ```js
  mobileNav.classList.toggle('is-open', !expanded);
  mobileNav.setAttribute('aria-hidden', String(expanded));
  ```
  *(This is part of the ISSUE-004 fix but merits explicit mention.)*

---

## Summary Table

| ID | Category | Severity | Page(s) Affected |
|----|----------|----------|-----------------|
| 001 | Accessibility | 🔴 Critical | All |
| 002 | Code Quality | 🔴 Critical | All |
| 003 | Code Quality / SEO | 🔴 Critical | All |
| 004 | Accessibility | 🔴 Critical | All |
| 005 | Consistency | 🟡 Medium | getting-started |
| 006 | Consistency | 🟡 Medium | index, why-hookwing |
| 007 | Accessibility | 🟡 Medium | pricing, why-hookwing |
| 008 | Typography | 🟡 Medium | why-hookwing |
| 009 | Responsive | 🟡 Medium | pricing |
| 010 | Polish / Navigation | 🟡 Medium | getting-started |
| 011 | Accessibility / Polish | 🟡 Medium | All |
| 012 | Code Quality / SEO | 🟡 Medium | All |
| 013 | Typography | 🟢 Low | getting-started |
| 014 | Code Quality | 🟢 Low | All |
| 015 | Semantic HTML | 🟢 Low | All |
| 016 | Responsive | 🟢 Low | why-hookwing |
| 017 | Responsive | 🟢 Low | pricing |
| 018 | Responsive | 🟢 Low | getting-started |
| 019 | Accessibility | 🟢 Low | All |
| 020 | Accessibility | 🟢 Low | All |

---

## What's Working Well ✅

These areas are consistently implemented and should be preserved:

- **Design tokens:** All 4 pages define identical CSS custom properties — perfect consistency
- **Google Fonts:** Identical import URL across all pages (`Space Grotesk + Inter + JetBrains Mono`)
- **Footer structure:** All 4 pages have identical footer columns (Product, Developers, Company, Legal) with identical links
- **Footer brand description:** Identical copy across all pages ("Webhook infrastructure for developers and agents. Test free. Ship with confidence.")
- **Nav links:** Identical desktop nav items (Playground, Pricing, Docs, Why Hookwing) on all pages
- **Focus rings:** All interactive elements use `box-shadow: var(--shadow-focus)` on `focus-visible` ✓
- **SVG accessibility:** Decorative SVGs marked `aria-hidden="true" focusable="false"` throughout ✓
- **Copy buttons:** All have `aria-label` attributes and JS keyboard support ✓
- **Hamburger button:** Proper `aria-expanded`, `aria-controls`, `aria-label` on all pages ✓
- **No inline event handlers:** Zero `onclick`, `onmouseover`, etc. in HTML ✓
- **No duplicate IDs:** Verified clean on all pages ✓
- **Smooth scroll:** `scroll-behavior: smooth` on `html` across all pages ✓
- **Reduced motion:** `prefers-reduced-motion` media query on all pages ✓
- **Dark mode:** Full token system in place with `localStorage` persistence ✓
- **p max-width:** 70ch applied globally on all pages ✓
- **Mobile nav breakpoint:** Consistent `768px` hamburger trigger on all pages ✓
- **Heading hierarchy:** h1 → h2 → h3 structure maintained correctly on all pages ✓
- **meta charset, viewport, description, og:title/description/type/url:** Present and correct on all pages ✓
- **JSON-LD structured data:** Present and appropriate on all pages ✓
- **Comparison table:** Wrapped in `overflow-x: auto` container for mobile scroll ✓
- **`aria-current="page"`:** Correctly set on desktop active nav link (pricing and why-hookwing) ✓

---

*Report generated by Dex design audit subagent, 2026-03-03*
