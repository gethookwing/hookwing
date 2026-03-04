# Hookwing Website — Full Link Audit

> Generated: 2026-03-04  
> Auditor: Dex (subagent)  
> Scope: All `href` attributes (`<a>`, `<link>`) and `src` attributes (`<img>`, `<script>`) across all 4 website pages.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ VALID INTERNAL | Points to an existing internal page |
| ✅ VALID EXTERNAL | Points to a real external URL |
| ⚠️ PLACEHOLDER | Points to `#` — needs a real destination |
| ❌ BROKEN | Points to a path that doesn't exist |
| 🔗 MAILTO | Email link |
| 📦 ASSET | Static asset file (favicon, icon, stylesheet) |

---

## Page 1 — Home — `/`

**File:** `index.html`

---

### Asset Links (`<link>` tags)

| Asset | href | Status | Notes |
|---|---|---|---|
| Favicon SVG | `/favicon.svg` | 📦 ⚠️ NOT FOUND | File absent from website directory; check build output |
| Favicon PNG 32px | `/favicon-32.png` | 📦 ⚠️ NOT FOUND | File absent from website directory; check build output |
| Apple Touch Icon | `/apple-touch-icon.png` | 📦 ⚠️ NOT FOUND | File absent from website directory; check build output |
| Google Fonts preconnect | `https://fonts.googleapis.com` | ✅ VALID EXTERNAL | Preconnect hint |
| Google Fonts preconnect | `https://fonts.gstatic.com` | ✅ VALID EXTERNAL | Preconnect hint |
| Google Fonts stylesheet | `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap` | ✅ VALID EXTERNAL | Space Grotesk + Inter + JetBrains Mono |

---

### Navigation & Internal Links

| Line | Link Text | href | Status | Notes |
|---|---|---|---|---|
| 1711 | Skip to main content | `#main-content` | ✅ Page anchor | Accessibility skip link |
| 1722 | Hookwing — home | `/` | ✅ VALID INTERNAL | Logo link |
| 1732 | Playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch: says "Playground" but links to /getting-started/ |
| 1733 | Pricing | `/pricing/` | ✅ VALID INTERNAL | Correct |
| 1734 | Docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch: says "Docs" — /docs/ actually exists; should link there |
| 1735 | Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL | Correct |
| 1736 | Get started | `/getting-started/` | ✅ VALID INTERNAL | Correct |
| 1753 | Sign in | `#` | ⚠️ PLACEHOLDER | Needs sign-in URL (app subdomain or auth page) |
| 1754 | Start free | `/getting-started/` | ✅ VALID INTERNAL | Correct |
| 1778 | Playground (mobile) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Same label mismatch as desktop nav |
| 1779 | Pricing (mobile) | `/pricing/` | ✅ VALID INTERNAL | Correct |
| 1780 | Docs (mobile) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Same label mismatch as desktop nav |
| 1781 | Why Hookwing (mobile) | `/why-hookwing/` | ✅ VALID INTERNAL | Correct |
| 1782 | Get started (mobile) | `/getting-started/` | ✅ VALID INTERNAL | Correct |
| 1783 | Sign in (mobile) | `#` | ⚠️ PLACEHOLDER | Needs sign-in URL |
| 1787 | Start free (mobile CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 1788 | Try the playground (mobile CTA) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch: says "playground" |
| 1837 | Try the playground (hero) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |
| 1845 | Get your API key (hero) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2282 | Start for free (pricing) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2326 | Get started (pricing) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2367 | Get started (pricing) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2415 | See full pricing details → | `/pricing/` | ✅ VALID INTERNAL | |
| 2448 | Try the playground (CTA) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |
| 2451 | Get your API key (CTA) | `/getting-started/` | ✅ VALID INTERNAL | |

### Mailto Links

| Line | Link Text | href | Status |
|---|---|---|---|
| 2408 | Talk to us | `mailto:hello@hookwing.com` | 🔗 MAILTO |
| 2519 | Contact | `mailto:hello@hookwing.com` | 🔗 MAILTO |

### Footer Links

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 2472 | Hookwing home | `/` | ✅ VALID INTERNAL | |
| 2485 | System status: all systems operational | `#` | ⚠️ PLACEHOLDER | Create `/status` page or link to external status (e.g. statuspage.io) |
| 2495 | Playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch — playground doesn't exist yet |
| 2496 | Pricing | `/pricing/` | ✅ VALID INTERNAL | |
| 2497 | Docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ /docs/ exists — update href to `/docs/` |
| 2498 | Agent integrations | `/agents` | ❌ BROKEN | `/agents` page doesn't exist; redirect to `/getting-started/` or build `/agents/` |
| 2506 | API reference | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should link to /docs/ or dedicated API ref |
| 2507 | Getting started | `/getting-started/` | ✅ VALID INTERNAL | |
| 2508 | OpenAPI spec | `/openapi.json` | ❌ BROKEN | No openapi.json file exists; generate spec or remove link |
| 2509 | Status page | `#` | ⚠️ PLACEHOLDER | Needs `/status` or external status URL |
| 2517 | Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL | |
| 2518 | Blog | `https://blog.hookwing.com` | ✅ VALID EXTERNAL | |
| 2524 | Privacy policy | `#` | ⚠️ PLACEHOLDER | Create `/privacy/` page |
| 2525 | Terms of service | `#` | ⚠️ PLACEHOLDER | Create `/terms/` page |

---

## Page 2 — Pricing — `/pricing/`

**File:** `pricing/index.html`

> **Note:** Head assets (lines 19–26) and navigation (lines 1723–1800) are identical to the home page. Only unique/content-specific links are listed below; footer links are also repeated and listed.

---

### Navigation Links (same as home page)

| Link Text | href | Status |
|---|---|---|
| Skip to main content | `#main-content` | ✅ Page anchor |
| Hookwing — home | `/` | ✅ VALID INTERNAL |
| Playground | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch) |
| Pricing | `/pricing/` | ✅ VALID INTERNAL (active) |
| Docs | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch) |
| Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL |
| Get started | `/getting-started/` | ✅ VALID INTERNAL |
| Sign in | `#` | ⚠️ PLACEHOLDER |
| Start free (all CTAs) | `/getting-started/` | ✅ VALID INTERNAL |

---

### Content Links (pricing-page specific)

| Line | Link Text | href | Status | Notes |
|---|---|---|---|---|
| 1975 | Start free (Starter card) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2037 | Start free (Pro card) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2098 | Get started (Scale card) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2165 | /api/pricing | `/api/pricing` | ✅ VALID INTERNAL | `api/pricing/` directory exists |
| 2601 | /api/pricing (inline) | `/api/pricing` | ✅ VALID INTERNAL | FAQ reference, same endpoint |
| 2667 | Start for free (final CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2670 | Try the playground (final CTA) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |

### Mailto Links

| Line | Link Text | href | Status |
|---|---|---|---|
| 2156 | Talk to us (Enterprise) | `mailto:hello@hookwing.com` | 🔗 MAILTO |
| 2510 | Send us a message. | `mailto:hello@hookwing.com` | 🔗 MAILTO |
| 2616 | hello@hookwing.com (FAQ inline) | `mailto:hello@hookwing.com` | 🔗 MAILTO |

### Footer Links (same as home page)

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 2691 | Hookwing home | `/` | ✅ VALID INTERNAL | |
| 2704 | System status badge | `#` | ⚠️ PLACEHOLDER | Needs status URL |
| 2714 | Playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |
| 2715 | Pricing | `/pricing/` | ✅ VALID INTERNAL | |
| 2716 | Docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should be `/docs/` |
| 2717 | Agent integrations | `/agents` | ❌ BROKEN | Create `/agents/` page |
| 2725 | API reference | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should be `/docs/` or `/api/` |
| 2726 | Getting started | `/getting-started/` | ✅ VALID INTERNAL | |
| 2727 | OpenAPI spec | `/openapi.json` | ❌ BROKEN | Generate spec or remove |
| 2728 | Status page | `#` | ⚠️ PLACEHOLDER | Needs `/status` or external |
| 2736 | Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL | |
| 2737 | Blog | `https://blog.hookwing.com` | ✅ VALID EXTERNAL | |
| 2738 | Contact | `mailto:hello@hookwing.com` | 🔗 MAILTO | |
| 2743 | Privacy policy | `#` | ⚠️ PLACEHOLDER | Create `/privacy/` |
| 2744 | Terms of service | `#` | ⚠️ PLACEHOLDER | Create `/terms/` |

---

## Page 3 — Why Hookwing — `/why-hookwing/`

**File:** `why-hookwing/index.html`

> Navigation and footer are identical to previous pages (with active state on "Why Hookwing").

---

### Navigation Links

| Link Text | href | Status |
|---|---|---|
| Skip to main content | `#main-content` | ✅ Page anchor |
| Hookwing — home | `/` | ✅ VALID INTERNAL |
| Playground | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch) |
| Pricing | `/pricing/` | ✅ VALID INTERNAL |
| Docs | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch) |
| Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL (active) |
| Sign in | `#` | ⚠️ PLACEHOLDER |
| Start free | `/getting-started/` | ✅ VALID INTERNAL |

---

### Content Links (why-hookwing specific)

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 2091 | Try the playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch — no distinct playground page yet |
| 2095 | Read the docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should link to `/docs/` (which exists!) |
| 2170 | View status page | `#` | ⚠️ PLACEHOLDER | Create `/status` page or link to external status service |
| 2174 | See pricing | `/pricing/` | ✅ VALID INTERNAL | |
| 2515 | Agent integrations | `/agents` | ❌ BROKEN | Create `/agents/` or link to `/getting-started/` |
| 2519 | OpenAPI spec | `/openapi.json` | ❌ BROKEN | Generate `openapi.json` or remove link |
| 2910 | Start for free (CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2917 | Get your API key (CTA) | `/getting-started/` | ✅ VALID INTERNAL | |

### Footer Links (same as previous pages)

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 2937 | Hookwing home | `/` | ✅ VALID INTERNAL | |
| 2948 | System status badge | `#` | ⚠️ PLACEHOLDER | Needs status URL |
| 2957 | Playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |
| 2958 | Pricing | `/pricing/` | ✅ VALID INTERNAL | |
| 2959 | Docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should be `/docs/` |
| 2960 | Agent integrations | `/agents` | ❌ BROKEN | Create `/agents/` page |
| 2967 | API reference | `/getting-started/` | ✅ VALID INTERNAL | |
| 2968 | Getting started | `/getting-started/` | ✅ VALID INTERNAL | |
| 2969 | OpenAPI spec | `/openapi.json` | ❌ BROKEN | Generate spec file |
| 2970 | Status page | `#` | ⚠️ PLACEHOLDER | Needs status URL |
| 2977 | Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL | |
| 2978 | Blog | `https://blog.hookwing.com` | ✅ VALID EXTERNAL | |
| 2979 | Contact | `mailto:hello@hookwing.com` | 🔗 MAILTO | |
| 2983 | Privacy policy | `#` | ⚠️ PLACEHOLDER | Create `/privacy/` |
| 2984 | Terms of service | `#` | ⚠️ PLACEHOLDER | Create `/terms/` |

---

## Page 4 — Getting Started — `/getting-started/`

**File:** `getting-started/index.html`

> Navigation and footer are identical to previous pages (with active state on "Get started").

---

### Navigation Links

| Link Text | href | Status |
|---|---|---|
| Skip to main content | `#main-content` | ✅ Page anchor |
| Hookwing — home | `/` | ✅ VALID INTERNAL |
| Playground | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch — self-referential) |
| Pricing | `/pricing/` | ✅ VALID INTERNAL |
| Docs | `/getting-started/` | ✅ VALID INTERNAL (⚠️ label mismatch) |
| Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL |
| Get started | `/getting-started/` | ✅ VALID INTERNAL (active) |
| Sign in | `#` | ⚠️ PLACEHOLDER |
| Start free | `/getting-started/` | ✅ VALID INTERNAL |

---

### Content Links (getting-started specific)

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 1706 | (path CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 1763 | (path CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 1823 | (path CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2177 | View full SDK docs → | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should link to actual SDK docs section |
| 2198 | API Reference (resource card) | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should link to `/docs/` (which exists) |
| 2220 | Agent Integration Guide (resource card) | `/agents` | ❌ BROKEN | `/agents` page doesn't exist; create it or use `/getting-started/` |
| 2244 | Webhook Best Practices (resource card) | `https://blog.hookwing.com/webhook-best-practices` | ✅ VALID EXTERNAL | Blog article link |
| 2268 | Status Page (resource card) | `#` | ⚠️ PLACEHOLDER | Needs real status page URL |
| 2314 | (contact CTA) | `mailto:hello@hookwing.com` | 🔗 MAILTO | |
| 2321 | (secondary CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2346 | (final CTA) | `/getting-started/` | ✅ VALID INTERNAL | |
| 2349 | (final CTA secondary) | `/getting-started/` | ✅ VALID INTERNAL | |

### Footer Links (same as previous pages)

| Line | Link Text | href | Status | Fix |
|---|---|---|---|---|
| 2368 | Hookwing home | `/` | ✅ VALID INTERNAL | |
| 2379 | System status badge | `#` | ⚠️ PLACEHOLDER | Needs status URL |
| 2388 | Playground | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Label mismatch |
| 2389 | Pricing | `/pricing/` | ✅ VALID INTERNAL | |
| 2390 | Docs | `/getting-started/` | ✅ VALID INTERNAL | ⚠️ Should be `/docs/` |
| 2391 | Agent integrations | `/agents` | ❌ BROKEN | Create `/agents/` |
| 2398 | API reference | `/getting-started/` | ✅ VALID INTERNAL | |
| 2399 | Getting started | `/getting-started/` | ✅ VALID INTERNAL | |
| 2400 | OpenAPI spec | `/openapi.json` | ❌ BROKEN | Generate spec file |
| 2401 | Status page | `#` | ⚠️ PLACEHOLDER | Needs status URL |
| 2408 | Why Hookwing | `/why-hookwing/` | ✅ VALID INTERNAL | |
| 2409 | Blog | `https://blog.hookwing.com` | ✅ VALID EXTERNAL | |
| 2410 | Contact | `mailto:hello@hookwing.com` | 🔗 MAILTO | |
| 2414 | Privacy policy | `#` | ⚠️ PLACEHOLDER | Create `/privacy/` |
| 2415 | Terms of service | `#` | ⚠️ PLACEHOLDER | Create `/terms/` |

---

## 🔍 FINDINGS: Issues Appearing on Every Page

These issues are **sitewide** — present on all 4 pages due to shared nav/footer markup:

### Sitewide Broken Links (4× each)

| Link Text | href | Fix |
|---|---|---|
| Agent integrations | `/agents` | Build `/agents/` page or redirect to `/getting-started/` |
| OpenAPI spec | `/openapi.json` | Generate and expose `openapi.json` spec file |

### Sitewide Placeholders (4× each)

| Link Text | href | Recommended Destination |
|---|---|---|
| Sign in | `#` | Sign-in URL (e.g. `https://app.hookwing.com/sign-in`) |
| System status badge (header) | `#` | Status page (e.g. `https://status.hookwing.com` or `/status`) |
| Status page (footer) | `#` | Same as above |
| Privacy policy | `#` | `/privacy/` |
| Terms of service | `#` | `/terms/` |

### Sitewide Label Mismatches (not broken, but misleading)

| Nav label | Current href | Correct href |
|---|---|---|
| "Playground" | `/getting-started/` | `/playground/` (build it) or rename to "Getting started" |
| "Docs" | `/getting-started/` | `/docs/` ← **this page actually exists!** |

---

## SUMMARY

### Totals

| Category | Count |
|---|---|
| **Total unique link targets audited** | ~35 unique hrefs |
| **Total `<a>` link instances across 4 pages** | ~160 (high repetition via shared nav/footer) |
| ✅ Valid internal links | ~100 instances (mostly `/getting-started/`, `/pricing/`, `/why-hookwing/`, `/`) |
| ✅ Valid external links | ~12 instances (Google Fonts ×4, blog.hookwing.com ×5, blog/webhook-best-practices ×1) |
| ⚠️ Placeholders (`#`) | ~36 instances across 4 pages (9 per page: sign-in, status badge, status footer, privacy, terms + page-specific) |
| ❌ Broken links | ~12 instances across 4 pages (3 per page: /agents, /openapi.json + page-specific) |
| 🔗 Mailto links | ~12 instances (hello@hookwing.com) |
| 📦 Asset links missing | 3 files (favicon.svg, favicon-32.png, apple-touch-icon.png) — may be in build output |

---

### Priority Fixes (ranked by severity)

#### 🔴 P1 — Broken Links (fix immediately)

1. **`/agents`** → ❌ 404 on every page. Either:
   - Build a proper `/agents/` page (agent integrations guide, MCP setup, etc.)
   - Or redirect `/agents` → `/getting-started/` as a stopgap

2. **`/openapi.json`** → ❌ 404 on every page. Either:
   - Generate and publish the OpenAPI 3.1 spec (ideally from the Cloudflare Workers API)
   - Or remove the footer link until ready

3. **Missing favicon/icon assets** → `/favicon.svg`, `/favicon-32.png`, `/apple-touch-icon.png` are referenced but not found in the website directory. Verify they are present in the build/deploy output.

#### 🟡 P2 — Placeholder Links (fill in soon)

4. **Sign in (`#`)** → Replace with actual auth URL (`https://app.hookwing.com/sign-in` or similar). Present on all 4 pages × desktop + mobile = 8 occurrences.

5. **Status page (`#`)** → Set up a status page (statuspage.io, Betterstack, or self-hosted) and link it. Two occurrences per page (header badge + footer link) = 8 total.

6. **Privacy policy (`#`)** → Create `/privacy/` page. Required for GDPR compliance and user trust. 4 occurrences.

7. **Terms of service (`#`)** → Create `/terms/` page. Required for any paying users. 4 occurrences.

#### 🟢 P3 — Label Mismatches & Improvements

8. **"Docs" nav link** → Currently points to `/getting-started/` but `/docs/index.html` **already exists** in the website directory. Update all 4 pages' nav to `href="/docs/"` and the footer "Docs" link.

9. **"Playground" nav link** → Either rename to "Get started" (already accurate) or build a distinct `/playground/` interactive page. Currently all "Playground" labels point to `/getting-started/`.

10. **"API Reference" resource card** (getting-started page, line 2198) → Points to `/getting-started/` but should link to `/docs/` or a specific API reference section.

11. **"Read the docs" link** (why-hookwing page, line 2095) → Points to `/getting-started/` — should link to `/docs/` which exists.

---

> **Note on `/docs/`:** The directory `/website/docs/index.html` EXISTS in the repo but is NOT linked from the navigation on any page. The nav "Docs" label points to `/getting-started/` instead. This is a significant oversight — a docs page is built but invisible. Update nav href from `/getting-started/` to `/docs/` immediately.
