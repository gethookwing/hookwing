# Hookwing Website Security Audit

**Date:** 2026-03-03  
**Scope:** Website HTML (4 pages), Cloudflare configuration, Secrets handling, Deployment pipeline, DNS & SSL  
**Auditor:** Dex (sub-agent audit session)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 2 |
| MEDIUM   | 5 |
| LOW      | 4 |
| INFO     | 8 |

---

## Findings

---

### [HIGH-01] .pages.dev URLs Bypass Cloudflare Access Protection

**Severity:** HIGH  
**Status:** OPEN

**Description:**  
Cloudflare Access protects `dev.hookwing.com` and `dev.blog.hookwing.com` — but **all three Pages projects have Access disabled at the Pages level**, meaning the raw `.pages.dev` subdomain URLs are publicly accessible without authentication, completely bypassing the Access app.

**Evidence:**  
```
CF Access Apps:
  - Hookwing Dev Environment → protects dev.hookwing.com
  - Hookwing Blog Dev        → protects dev.blog.hookwing.com

Pages Projects (all have Pages Access = FALSE):
  hookwing-dev         → hookwing-dev.pages.dev        ← PUBLIC (no auth)
  hookwing-blog        → hookwing-blog.pages.dev        ← PUBLIC (no auth)
  hookwing-illustrations → hookwing-illustrations.pages.dev ← PUBLIC (no auth)
```

Anyone who knows the `.pages.dev` URL can access dev/staging content without going through CF Access.

**Recommendation:**  
Enable "Cloudflare Access" on the Pages project level for all non-public projects. In Cloudflare Dashboard → Pages → each project → Settings → Access → Enable Cloudflare Access. This enforces auth even on the `.pages.dev` domain. Alternatively, add the `.pages.dev` subdomain as a hostname in the existing Access apps.

---

### [HIGH-02] Dangling DNS Record — `staging.hookwing.com`

**Severity:** HIGH  
**Status:** OPEN

**Description:**  
`staging.hookwing.com` is a CNAME pointing to `hookwing-api-staging` (DNS-only, not proxied). This hostname does not resolve — it's either a removed Worker or a misconfigured record. A dangling DNS record pointing to an unclaimed name could be taken over (subdomain takeover) if the target (e.g., a Workers or cloud service) becomes reclaimable.

**Evidence:**  
```
CNAME  staging.hookwing.com  ->  hookwing-api-staging  (DNS-only)
nslookup hookwing-api-staging.workers.dev → NXDOMAIN
```

**Recommendation:**  
1. Verify whether `staging.hookwing.com` is still needed.
2. If not: delete the DNS record immediately.
3. If yes: fix the CNAME target to the correct workers.dev URL and proxy through Cloudflare.
4. Critical: the record is DNS-only — once fixed, consider proxying it through CF to avoid origin IP exposure.

---

### [MEDIUM-01] No Content Security Policy (CSP) Headers

**Severity:** MEDIUM  
**Status:** OPEN

**Description:**  
None of the 4 HTML pages include a `Content-Security-Policy` meta tag. No CF Transform Rules are configured to inject CSP headers at the edge. Without CSP, the site is more vulnerable to XSS injection if any future dynamic content is added, and third-party script injection is uncontrolled.

**Evidence:**  
- Grep for `Content-Security-Policy` in all 4 HTML files: no results.
- Cloudflare Transform Rulesets: empty (0 rulesets configured).
- Live headers from `dev.hookwing.com`: no CSP header in response.

**Recommendation:**  
Add a CSP header via Cloudflare Transform Rules (Response Header Modification). Suggested starter policy for this static site:

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://hookwing.com;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

Note: `'unsafe-inline'` is required for the inline `<style>` and `<script>` blocks currently in the HTML. Long-term, extract JS/CSS into external files to enable `nonce`-based CSP.

---

### [MEDIUM-02] Always HTTPS Disabled + HSTS Not Configured

**Severity:** MEDIUM  
**Status:** OPEN

**Description:**  
Cloudflare's "Always Use HTTPS" is **off** and HSTS is **disabled**. This means users accessing `http://hookwing.com` will not be automatically redirected to HTTPS at the CF edge, and browsers won't preload HTTPS-only behavior.

**Evidence:**  
```
CF Setting: always_use_https = off
CF Setting: strict_transport_security.enabled = false
CF Setting: strict_transport_security.max_age = 0
```

**Recommendation:**  
1. Enable "Always Use HTTPS" in Cloudflare: Zone → SSL/TLS → Edge Certificates → Always Use HTTPS → ON.
2. Enable HSTS with at minimum: `max_age=31536000` (1 year), `includeSubDomains=true`.
3. After running stable for 1+ year, consider adding to HSTS preload list.

---

### [MEDIUM-03] Minimum TLS Version Set to 1.0

**Severity:** MEDIUM  
**Status:** OPEN

**Description:**  
The Cloudflare zone allows TLS 1.0 connections. TLS 1.0 and 1.1 are deprecated (RFC 8996, 2021). Any client connecting over TLS 1.0/1.1 has significantly weaker cipher suite choices and known vulnerabilities (POODLE, BEAST).

**Evidence:**  
```
CF Setting: min_tls_version = 1.0
```

**Recommendation:**  
Set minimum TLS version to 1.2 in Cloudflare: Zone → SSL/TLS → Edge Certificates → Minimum TLS Version → TLS 1.2. TLS 1.3 is already supported and preferred. Only ~0.1% of global traffic is TLS 1.0/1.1 today.

---

### [MEDIUM-04] SSL Mode Set to "Full" (Not "Full Strict")

**Severity:** MEDIUM  
**Status:** OPEN

**Description:**  
SSL mode is `full` rather than `full (strict)`. In `full` mode, Cloudflare will connect to the origin even if the origin certificate is self-signed or expired — it validates the hostname but not the certificate chain. This creates a potential for MITM between Cloudflare edge and origin if origin certificates are compromised.

**Evidence:**  
```
CF Setting: ssl = full
```

**Recommendation:**  
Switch to **Full (strict)** mode in Cloudflare: Zone → SSL/TLS → Overview → SSL/TLS Encryption Mode → Full (strict). Ensure the origin (Cloudflare Pages in this case) has a valid certificate — Pages automatically provides one, so this change should be safe.

---

### [MEDIUM-05] DNSSEC Not Enabled

**Severity:** MEDIUM  
**Status:** OPEN

**Description:**  
DNSSEC is disabled for `hookwing.com`. Without DNSSEC, DNS responses can be spoofed (DNS cache poisoning), potentially redirecting users to malicious servers even over HTTPS.

**Evidence:**  
```
CF Setting: DNSSEC status = disabled
```

**Recommendation:**  
Enable DNSSEC in Cloudflare: Zone → DNS → Settings → DNSSEC → Enable. Then add the DS record to your domain registrar. Cloudflare manages key rotation automatically.

---

### [LOW-01] Missing Security Response Headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

**Severity:** LOW  
**Status:** OPEN

**Description:**  
No security response headers are configured at the Cloudflare edge. While the site is static and low-risk currently, hardening headers are a defense-in-depth best practice and can prevent clickjacking and content-type sniffing.

**Evidence:**  
- Cloudflare Transform Rulesets: empty (0 configured).
- Live headers from site: no `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` present.

**Recommendation:**  
Add via Cloudflare Transform Rules → Response Header Modification:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

### [LOW-02] Cloudflare Access Session Duration is 30 Days (720h)

**Severity:** LOW  
**Status:** OPEN

**Description:**  
Both Access apps (dev.hookwing.com and dev.blog.hookwing.com) are configured with a 720-hour (30 day) session duration. If a session token is stolen or a machine is compromised, the attacker has a 30-day window without needing to re-authenticate.

**Evidence:**  
```
App: Hookwing Dev Environment | Session: 720h
App: Hookwing Blog Dev        | Session: 720h
```

**Recommendation:**  
Reduce to 24h or at most 168h (7 days). For a dev environment accessed infrequently, 24h is appropriate and forces regular re-authentication. Low friction as it's email-based.

---

### [LOW-03] `illustrations.hookwing.com` Has No Access Protection

**Severity:** LOW  
**Status:** ACCEPTED RISK (if content is non-sensitive)

**Description:**  
`illustrations.hookwing.com` → `hookwing-illustrations.pages.dev` with no CF Access protection and no Pages-level auth. The content appears to be illustration assets for design use.

**Evidence:**  
```
CNAME  illustrations.hookwing.com  ->  hookwing-illustrations.pages.dev (proxied)
CF Access apps: NOT listed
Pages Project access enabled: False
```

**Recommendation:**  
If these are internal design assets not meant for public consumption, add CF Access protection. If they're intentionally public (e.g., a CDN for images), document this explicitly as ACCEPTED RISK.

---

### [LOW-04] `innerHTML` Usage in Pricing Page JavaScript

**Severity:** LOW  
**Status:** INFO / ACCEPTED RISK

**Description:**  
The pricing page uses `innerHTML` to inject content in two places. However, both assignments use **hardcoded string literals only** — no user-controlled data is involved. This is safe in the current implementation but represents a pattern that could become dangerous if user input is later introduced here.

**Evidence:**  
```javascript
// pricing/index.html lines 2619, 2623:
if (ppNote) ppNote.innerHTML = isAnnual ? 'Free forever' : '&nbsp;';
if (jetNote) jetNote.innerHTML = isAnnual ? 'Volume discounts available' : '&nbsp;';
```

**Recommendation:**  
Replace `innerHTML` with `textContent` for plain text content. This is safer by default and eliminates any future risk:
```javascript
if (ppNote) ppNote.textContent = isAnnual ? 'Free forever' : '';
if (jetNote) jetNote.textContent = isAnnual ? 'Volume discounts available' : '';
```
For the `&nbsp;` empty state, use CSS (`min-height`) rather than injecting HTML entities.

---

## Passing Checks (INFO)

### [INFO-01] No Inline Event Handlers in HTML ✅

All 4 pages have no `onclick`, `onload`, `onerror`, or other inline event handlers in HTML attributes. JavaScript events are all registered via `addEventListener` in the deferred script blocks.

---

### [INFO-02] No `eval()` or `document.write` Usage ✅

Searched all 4 HTML files — no `eval()`, no `document.write`. The homepage JavaScript comment even explicitly notes: `JAVASCRIPT — no inline handlers, no eval()`.

---

### [INFO-03] External Scripts Only from Google Fonts ✅

The only external resources loaded are:
- `https://fonts.googleapis.com` (CSS stylesheet)
- `https://fonts.gstatic.com` (font files)

No third-party analytics, tracking pixels, ad scripts, or unknown CDNs. Clean.

---

### [INFO-04] No Hardcoded Secrets in HTML Files ✅

Comprehensive grep for API keys, tokens, secrets, Bearer tokens across all 4 HTML files returned no results. All API key references in code examples use environment variable placeholders (`$HOOKWING_API_KEY`, `$HW_KEY`, `"hwk_live_YOUR_KEY_HERE"`).

---

### [INFO-05] External Links Properly Use `rel="noopener noreferrer"` ✅

All `target="_blank"` links reviewed:
- `https://blog.hookwing.com` → `rel="noopener noreferrer"` ✅
- Footer status page links → `rel="noopener noreferrer"` ✅
- `https://blog.hookwing.com/webhook-best-practices` → `rel="noopener noreferrer"` ✅

---

### [INFO-06] Cloudflare Access Policies Correctly Scoped ✅

Access policies use explicit email allow-list:
```
Include: fabien.punin@gmail.com
Include: dex@hookwing.com
```
No wildcard domains, no group-wide policies. Correctly scoped to known identities.

---

### [INFO-07] Secrets Storage Architecture is Sound ✅

- `secrets.json` stores all provider credentials in a structured format, loaded by OpenClaw at runtime
- `openclaw.json` contains only OpenClaw system config (no Hookwing project secrets)
- No secrets found in website HTML files
- `.gitignore` correctly excludes `.env`, `.env.*`, `*.pem`, `*.key` files

---

### [INFO-08] `dev.hookwing.com` Cloudflare Access Working ✅

Confirmed via live HTTP test: visiting `dev.hookwing.com` without auth returns `HTTP 302 → CF Access login`. The Access app is correctly intercepting unauthenticated requests.

---

## Recommended Action Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 (Immediate) | HIGH-02: Delete/fix dangling `staging.hookwing.com` DNS | 5 min |
| 2 (This week) | HIGH-01: Enable Pages-level Access on `hookwing-dev` and `hookwing-blog` | 15 min |
| 3 (This week) | MEDIUM-02: Enable Always HTTPS + HSTS | 5 min |
| 4 (This week) | MEDIUM-03: Set min TLS to 1.2 | 2 min |
| 5 (This week) | MEDIUM-04: Upgrade SSL to Full (strict) | 2 min |
| 6 (This sprint) | MEDIUM-01: Add CSP headers via CF Transform Rules | 30 min |
| 7 (This sprint) | LOW-01: Add security response headers via CF Transform Rules | 15 min |
| 8 (This sprint) | MEDIUM-05: Enable DNSSEC | 10 min |
| 9 (Backlog) | LOW-02: Reduce CF Access session duration | 2 min |
| 10 (Backlog) | LOW-04: Replace innerHTML with textContent in pricing | 5 min |

---

*Audit completed: 2026-03-03. Next recommended re-audit: after production launch or after significant infrastructure changes.*
