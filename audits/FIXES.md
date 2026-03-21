# Hookwing Website — Top 20 Fixes

Ordered by impact (severity + frequency). Fix in this order for maximum ROI.

---

## 🔴 Fix immediately — Critical

---

### FIX-01 · Add skip-to-content link · ALL pages
**Impact:** Accessibility — WCAG 2.4.1 (Level A)  
**Effort:** 15 min

Add after `<body>` on every page:
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```
Add CSS:
```css
.skip-link {
  position: absolute; top: -100%; left: var(--space-4);
  background: var(--color-brand-primary); color: var(--color-ink-inverse);
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; z-index: 9999;
  text-decoration: none; transition: top var(--dur-fast) var(--ease);
}
.skip-link:focus { top: var(--space-2); }
```
**Files:** index.html, pricing/index.html, why-hookwing/index.html, getting-started/index.html

---

### FIX-02 · Add favicon · ALL pages
**Impact:** Brand identity / professionalism  
**Effort:** 30 min (create SVG + add HTML)

Add to `<head>` on every page:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
```
**Files:** All pages + create `/favicon.svg` asset

---

### FIX-03 · Add og:image + twitter:card · ALL pages
**Impact:** Social sharing click-through rate (critical for marketing)  
**Effort:** 1 hour (design OG image + add tags)

Add to `<head>` on every page:
```html
<meta property="og:image" content="https://hookwing.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@hookwing" />
<meta name="twitter:image" content="https://hookwing.com/og-image.png" />
```
**Files:** All pages + create `/og-image.png` asset (1200×630)

---

### FIX-04 · Fix incorrect `role="dialog"` on mobile nav · ALL pages
**Impact:** Accessibility — incorrect ARIA role breaks screen reader UX  
**Effort:** 10 min

Change on all 4 pages:
```html
<!-- BEFORE -->
<div id="nav-mobile" class="nav-mobile" role="dialog" aria-label="Mobile navigation">

<!-- AFTER -->
<div id="nav-mobile" class="nav-mobile" aria-hidden="true">
```
Update JS toggle to also set `aria-hidden`:
```js
mobileNav.classList.toggle('is-open', !expanded);
mobileNav.setAttribute('aria-hidden', String(expanded));
```
**Files:** All pages

---

## 🟡 Fix next sprint — Medium impact

---

### FIX-05 · Fix nav logo inconsistency on Getting Started · getting-started/index.html
**Impact:** Visual consistency — logo changes between pages  
**Effort:** 5 min

Replace SVG in nav logo (line ~1273) and footer logo (~line 2032) with emoji:
```html
<a href="/" class="nav-logo" aria-label="Hookwing — home">
  <span aria-hidden="true">✈️</span> Hookwing
</a>
```
**File:** getting-started/index.html

---

### FIX-06 · Standardize active nav link CSS across all pages
**Impact:** Visual consistency — active state looks different on each page  
**Effort:** 10 min

**index.html** — Add after `.nav-link:hover`:
```css
.nav-link.active { color: var(--color-brand-action); background: var(--color-success-bg); }
```

**why-hookwing/index.html** — Update line ~328:
```css
/* BEFORE */
.nav-link.active { color: var(--color-brand-action); }
/* AFTER */
.nav-link.active { color: var(--color-brand-action); background: var(--color-success-bg); }
```
**Files:** index.html, why-hookwing/index.html

---

### FIX-07 · Add aria-current="page" to mobile nav active links
**Impact:** Accessibility — screen reader users can't identify current page on mobile  
**Effort:** 10 min

**pricing/index.html** mobile nav:
```html
<li><a href="/pricing" class="nav-mobile-link active" aria-current="page">Pricing</a></li>
```

**why-hookwing/index.html** mobile nav:
```html
<li><a href="/why" class="nav-mobile-link active" aria-current="page">Why Hookwing</a></li>
```

Add CSS to both files:
```css
.nav-mobile-link.active { color: var(--color-brand-action); font-weight: 600; }
```
**Files:** pricing/index.html, why-hookwing/index.html

---

### FIX-08 · Normalize Why Hookwing hero h1 font size
**Impact:** Typography consistency — Why Hookwing hero is visibly larger than other pages  
**Effort:** 2 min

In `why-hookwing/index.html`, around line 473:
```css
.why-hero-title {
  font-size: clamp(36px, 5.5vw, 64px); /* was clamp(40px, 5.5vw, 68px) */
}
```
**File:** why-hookwing/index.html

---

### FIX-09 · Move pricing card grid breakpoint from 1200px → 1023px
**Impact:** Responsive — pricing cards cramped at 1024–1200px viewport  
**Effort:** 2 min

In `pricing/index.html`, around line 1041:
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
**File:** pricing/index.html

---

### FIX-10 · Add dark mode toggle button to nav
**Impact:** UX — dark mode works but users can't manually toggle it  
**Effort:** 45 min

Add to `.nav-actions` before "Sign in" on all pages:
```html
<button class="btn btn-ghost btn-md" id="theme-toggle" aria-label="Toggle dark mode">
  <svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6.5 6.5 0 1 0 7 7z" stroke="currentColor" stroke-width="1.5"/>
  </svg>
</button>
```
Update JS to handle toggle (store `localStorage.setItem('theme', theme)` and flip button icon).  
**Files:** All pages

---

### FIX-11 · Add Getting Started to primary nav OR add active indicator
**Impact:** Navigation polish — users on /start have no visual location in nav  
**Effort:** 15 min (add to nav on all pages)

Add to nav `<ul class="nav-links">` on all pages:
```html
<li><a href="/start" class="nav-link">Get started</a></li>
```
Then in `getting-started/index.html`, add active class:
```html
<li><a href="/start" class="nav-link active" aria-current="page">Get started</a></li>
```
**Files:** All pages

---

### FIX-12 · Add emoji aria-hidden to nav/footer logos
**Impact:** Accessibility — emoji can be double-announced by some screen readers  
**Effort:** 5 min

On all pages where ✈️ appears in nav/footer:
```html
<a href="/" class="nav-logo" aria-label="Hookwing — home">
  <span aria-hidden="true">✈️</span> Hookwing
</a>
```
**Files:** index.html, pricing/index.html, why-hookwing/index.html (getting-started already uses SVG)

---

## 🟢 Polish pass — Low priority

---

### FIX-13 · Fix hero eyebrow font-size on Getting Started (12px → 13px)
**Impact:** Typography micro-inconsistency  
**Effort:** 1 min

In `getting-started/index.html` around line 460:
```css
.page-hero-eyebrow { font-size: 13px; /* was 12px */ }
```
**File:** getting-started/index.html

---

### FIX-14 · Remove redundant `role="navigation"` from `<nav>` · ALL pages
**Impact:** Code cleanliness  
**Effort:** 5 min

On all 4 pages:
```html
<!-- BEFORE -->
<nav class="nav" role="navigation" aria-label="Main navigation">
<!-- AFTER -->
<nav class="nav" aria-label="Main navigation">
```
**Files:** All pages

---

### FIX-15 · Fix 767px breakpoint → 768px in why-hookwing
**Impact:** Responsive — 1px gap in breakpoint coverage  
**Effort:** 1 min

In `why-hookwing/index.html`, find `@media (max-width: 767px)` and change to `768px`.  
**File:** why-hookwing/index.html

---

### FIX-16 · Standardize FAQ grid breakpoint from 900px → 1023px in pricing
**Impact:** Responsive consistency  
**Effort:** 1 min

In `pricing/index.html`, around line 1253:
```css
@media (max-width: 1023px) { /* was 900px */
  .faq-grid { grid-template-columns: 1fr; }
}
```
**File:** pricing/index.html

---

### FIX-17 · Standardize SDK grid breakpoint from 420px → 479px in getting-started
**Impact:** Responsive consistency  
**Effort:** 1 min

In `getting-started/index.html`:
```css
@media (max-width: 479px) { /* was 420px */
  .sdk-grid { grid-template-columns: 1fr; }
}
```
**File:** getting-started/index.html

---

### FIX-18 · Convert footer `<h3>` headings to `<p>` elements
**Impact:** Semantic HTML cleanup  
**Effort:** 15 min

On all pages, replace:
```html
<!-- BEFORE -->
<h3 class="footer-col-heading">Product</h3>

<!-- AFTER -->
<p class="footer-col-heading">Product</p>
```
Repeat for all 4 footer column headings + the second Legal heading on each page.  
**Files:** All pages

---

### FIX-19 · Add explicit `aria-hidden` initialization to mobile nav
**Impact:** Accessibility best practice  
**Effort:** 5 min

On all pages, initialize:
```html
<div id="nav-mobile" class="nav-mobile" aria-hidden="true">
```
JS already handles toggling this per FIX-04.  
**Files:** All pages (covered by FIX-04, listed separately for clarity)

---

### FIX-20 · Add `aria-label` to footer `<nav>` / footer status link
**Impact:** Accessibility — screen readers distinguish multiple nav landmarks  
**Effort:** 5 min

The `<footer>` contains navigation links but they're in plain `<ul>` lists, not wrapped in `<nav>`. Consider adding for screen reader navigation:
```html
<nav aria-label="Footer navigation">
  <ul class="footer-links" role="list">
    ...
  </ul>
</nav>
```
Apply to at least the "Product" column which is the most nav-like.  
**Files:** All pages (footer section)

---

## Effort vs. Impact Matrix

| Fix | Effort | Impact |
|-----|--------|--------|
| FIX-01 skip link | Low | Critical |
| FIX-02 favicon | Low-Med | High |
| FIX-03 og:image | Med | High |
| FIX-04 role=dialog | Low | Critical |
| FIX-05 logo consistency | Trivial | Med |
| FIX-06 active nav CSS | Low | Med |
| FIX-07 aria-current mobile | Low | Med |
| FIX-08 hero size | Trivial | Med |
| FIX-09 breakpoint 1200px | Trivial | Med |
| FIX-10 dark toggle | Med | Med |
| FIX-11 add to nav | Low | Med |
| FIX-12 emoji aria-hidden | Trivial | Low-Med |
| FIX-13–20 | Trivial–Low | Low |

**Recommended sprint order:**  
Sprint 1: FIX-01 → FIX-04 (Critical, ~1h total)  
Sprint 2: FIX-05 → FIX-09, FIX-11 (Consistency pass, ~30min)  
Sprint 3: FIX-10, FIX-12–20 (Polish pass, ~2h)  

---

*Generated from AUDIT-REPORT.md — 2026-03-03*

---

## Live Feedback Fixes (Priority)

### F-21: Wire all links (Critical)
All nav links, footer links, CTAs must point to actual pages:
- Playground → /playground/ (or /getting-started/ for now)
- Pricing → /pricing/
- Docs → /docs/ (or /getting-started/ for now)
- Why Hookwing → /why-hookwing/
- Blog → https://blog.hookwing.com
- Getting Started → /getting-started/
- Sign in → # (placeholder)
- Start free → /getting-started/

### F-22: Animated radar circles (Medium)
Replace static circle decorations with pulsing radar animation:
- Concentric circles that pulse outward
- Fade as they expand
- Non-linear timing (cubic-bezier, not steady)
- Subtle, not distracting
- Use brand green (#009D64) at low opacity

### F-23: Subtle decorative patterns (Medium)
Add researched decorative patterns (NOT basic dots/grids):
- Look at Stripe, Vercel, Linear for pattern inspiration
- Subtle topographic/contour lines
- Or noise/grain texture overlay
- Or geometric mesh pattern
- Keep it subtle — enhance, don't distract
- Must respect prefers-reduced-motion

## Navbar Fixes (Fabien 10:49 PM)

### F-24: Navbar vertical centering (ALL 4 PAGES)
- Nav items not vertically centered properly
- Ensure `align-items: center` on nav container and all child elements
- Logo, links, and CTA buttons should all sit on the same baseline
- Check padding-top/bottom symmetry

### F-25: Dark mode navbar contrast (ALL 4 PAGES)
- Nav text/links lack contrast in dark mode
- Need lighter text colors against dark nav background
- Ensure nav links are clearly readable (WCAG AA minimum: 4.5:1 contrast ratio)
- Check: logo text, nav links, sign-in link, CTA button borders

### F-26: Radar trail direction (ALL 4 PAGES)
- Green phosphor trail is AHEAD of the rotating radius line — wrong
- On real radar, the trail is BEHIND the sweep line (it fades where the sweep already passed)
- Fix: reverse the conic-gradient so the bright edge is at the leading line and the glow fades BEHIND it (in the direction already swept)
- The sweep rotates clockwise; the trail should extend counter-clockwise from the bright edge
