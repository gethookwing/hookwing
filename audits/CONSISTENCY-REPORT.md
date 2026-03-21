# Hookwing Website Consistency Report

**Generated:** 2026-03-04  
**Scope:** index.html, pricing/index.html, why-hookwing/index.html, getting-started/index.html, api/pricing/index.json  
**Checks:** Internal consistency + competitor fact-check + aspirational vs factual claims

---

## SUMMARY

| Category | Count | Severity |
|----------|-------|----------|
| CONTRADICTION | 3 | HIGH × 3 |
| INACCURACY (competitor) | 2 | HIGH × 1, MEDIUM × 1 |
| ASPIRATIONAL | 4 | HIGH × 1, MEDIUM × 2, LOW × 1 |
| VERIFIED (competitor) | 5 | — |

---

## CHECK 1: Internal Consistency

---

### FINDING 1.1

- **Issue type:** CONTRADICTION  
- **Severity:** HIGH  
- **Pages affected:** `getting-started/index.html`, `why-hookwing/index.html` ← conflict with → `pricing/index.html`, `api/pricing/index.json`

**What it says:**
- `getting-started/index.html` (Free Tier path card): *"Persistent endpoints · **30-day history**"*
- `why-hookwing/index.html` (comparison table, row "Free tier event history"): Hookwing column shows *"**30 days**"*

**What it should say:**
- The canonical source (`pricing/index.html` line 1941) states: *"7-day event retention"* for Paper Plane
- `pricing/index.html` FAQ (line 2572) confirms: *"7-day event history"*
- `api/pricing/index.json`: `"retention_days": 7` for Paper Plane tier
- **Correct value: 7 days**

**Impact:** Users consulting the getting-started page or why-hookwing comparison will expect 30 days of history on the free plan — four times more than what is actually delivered. Major trust issue on first discovery. The comparison table also uses this inflated figure to position Hookwing as equivalent to Svix Free (which genuinely has 30-day retention), when Hookwing's free tier actually offers less.

---

### FINDING 1.2

- **Issue type:** CONTRADICTION  
- **Severity:** HIGH  
- **Pages affected:** `why-hookwing/index.html` ← conflict with → `pricing/index.html`, `api/pricing/index.json`

**What it says:**
- `why-hookwing/index.html` (pricing comparison card for Hookwing Warbird): *"2M events/mo · **365-day retention** · Agent-ready"* (line 2811)

**What it should say:**
- `pricing/index.html` (Warbird tier, line 2064): *"90-day event retention"*
- `api/pricing/index.json`: `"retention_days": 90` for the `warbird` tier
- 365-day retention belongs to the **Jet** (enterprise/custom) tier
- **Correct value for Warbird: 90 days**

**Impact:** The why-hookwing comparison inflates Warbird's retention by 4× (365 vs 90 days). This misrepresentation is at the core of the pricing comparison against Svix Pro ($490/mo) — where Hookwing claims superior retention at lower cost. The actual claim would be 90 days vs Svix Pro's 90 days (identical), not 365 vs 90.

---

### FINDING 1.3

- **Issue type:** CONTRADICTION  
- **Severity:** HIGH  
- **Pages affected:** `why-hookwing/index.html` ← conflict with → `pricing/index.html`, `api/pricing/index.json`

**What it says:**
- `why-hookwing/index.html` (trust stats section, line 1892): *"99.99% — Uptime SLA"*
- `why-hookwing/index.html` (Transparent section, line 2123): *"99.99% uptime SLA **on paid plans**, with clear remediation if we miss it."*
- `why-hookwing/index.html` (comparison table, row "Uptime SLA (paid)", line 2758): Hookwing column = *"99.99%"*

**What it should say:**
- `pricing/index.html` (Warbird, line 2080): *"99.9% uptime SLA"*
- `api/pricing/index.json`: `"sla_uptime": "99.9%"` for Warbird; `"sla_uptime": "99.99%"` only for Jet
- 99.99% SLA is **Jet-tier only** (enterprise, custom pricing)
- **Correct statement: 99.9% SLA on Warbird ($99/mo), 99.99% SLA on Jet (custom)**

**Impact:** The phrase "99.99% uptime SLA on paid plans" is misleading — Warbird is a paid plan with only 99.9% SLA. The comparison table presents a single "99.99%" figure for Hookwing without noting that this only applies to the enterprise tier. The difference between 99.9% and 99.99% is ~9× the allowed downtime (52 min/year vs 8.7 hours/year) — material for production users.

---

## CHECK 2: Competitor Comparison Fact-Check

**Sources verified:** svix.com/pricing (fetched 2026-03-04), hookdeck.com/pricing (fetched 2026-03-04)

---

### FINDING 2.1

- **Issue type:** INACCURACY  
- **Severity:** HIGH  
- **Pages affected:** `why-hookwing/index.html` (comparison table, row "Uptime SLA (paid)")

**What it says:**
- Comparison table lists Hookdeck's uptime SLA as: *"99.9% (Growth+)"*

**What it should say:**
- Hookdeck's pricing page explicitly states for the Growth plan: **"Uptime SLA 99.999%"** and **"Latency SLA 99.99%"**
- **Correct value: 99.999% uptime SLA (Growth+)**
- Source: hookdeck.com/pricing — Growth tier features table

**Impact:** The comparison table shows Hookwing at 99.99% vs Hookdeck at "99.9% Growth+", creating the impression that Hookwing has a superior SLA. In reality, Hookdeck Growth's SLA (99.999%) *exceeds* even Hookwing's claimed top-tier SLA (99.99% on Jet). This is a factually incorrect competitor comparison that disadvantages Hookdeck unfairly.

---

### FINDING 2.2

- **Issue type:** INACCURACY  
- **Severity:** MEDIUM  
- **Pages affected:** `why-hookwing/index.html` (comparison table, row "Free tier event history")

**What it says:**
- Hookwing free tier history = *"30 days"* (see FINDING 1.1 — this figure is already wrong)
- Svix free tier history = *"30 days"* (listed as equivalent)

**What it should say:**
- Svix free tier: 30-day payload retention — **VERIFIED CORRECT** (svix.com/pricing)
- Hookwing free (Paper Plane): **7 days** actual (see Finding 1.1)
- The comparison makes Hookwing free tier look equivalent to Svix free when it actually offers less retention

**Impact:** Because Finding 1.1 inflated Hookwing's free retention to 30 days, the comparison vs Svix appears favorable. The corrected comparison would show Hookwing free = 7 days vs Svix free = 30 days — a disadvantage, not parity.

---

### VERIFIED COMPETITOR CLAIMS

The following comparison claims are **accurate** as of 2026-03-04:

| Claim | Source | Status |
|-------|--------|--------|
| Svix Professional entry price: $490/mo | svix.com/pricing ("from $490/month") | ✅ VERIFIED |
| Svix Professional SLA: 99.99% | svix.com/pricing | ✅ VERIFIED |
| Svix free tier retention: 30 days | svix.com/pricing | ✅ VERIFIED |
| Hookdeck Team entry price: $39/mo | hookdeck.com/pricing ("Starts at $39/month") | ✅ VERIFIED |
| Hookdeck Growth price: $499/mo | hookdeck.com/pricing ("Starts at $499/month") | ✅ VERIFIED |
| Hookdeck free tier: 3-day retention | hookdeck.com/pricing ("3-day retention") | ✅ VERIFIED |
| Both competitors free tier: 10,000 events | hookdeck.com + svix.com pricing pages | ✅ VERIFIED |

---

## CHECK 3: Aspirational vs Factual Claims

---

### FINDING 3.1

- **Issue type:** ASPIRATIONAL  
- **Severity:** HIGH  
- **Pages affected:** `why-hookwing/index.html` (metrics section, line 2842)

**What it says:**
- *"1B+ Events processed — and counting"*

**Assessment:**
- Hookwing is a newly launched SaaS product (website dated 2026-03-03)
- No public evidence, press releases, or third-party verification supports 1 billion+ events processed
- This metric is almost certainly a target/goal, not an operational fact
- For comparison, established platforms (Svix, Hookdeck) with years of operation and major enterprise customers have publicly claimed billions of events processed

**What it should say (options):**
- Remove until verifiable, OR
- Replace with an honest metric (e.g., events the system *can* handle, or actual beta numbers), OR
- Mark as a capacity/design target: *"Designed for 1B+ events"*

---

### FINDING 3.2

- **Issue type:** ASPIRATIONAL  
- **Severity:** MEDIUM  
- **Pages affected:** `why-hookwing/index.html` (metrics section, line 2848)

**What it says:**
- *"99.99% Uptime — 30-day rolling average"*

**Assessment:**
- This implies a measured, tracked uptime metric with 30 days of operational data
- For a newly launched product, no 30-day rolling average exists yet
- Additionally, this conflicts with the product's own pricing tiers: only Jet guarantees 99.99% SLA; the claim here is presented as a current measured fact, not a tier-specific commitment
- This is aspirational / a design target being presented as measured operational data

**What it should say:**
- Until operational: *"99.9% SLA guaranteed (Warbird), 99.99% SLA (Jet)"* referencing the actual contractual commitments, OR
- After launch with real data: link to a public status page with actual uptime history

---

### FINDING 3.3

- **Issue type:** ASPIRATIONAL  
- **Severity:** MEDIUM  
- **Pages affected:** `why-hookwing/index.html` (metrics section, line 2854), `index.html` (trust stats, line 1909)

**What it says:**
- `why-hookwing/index.html`: *"<150ms — Average delivery latency, p50 across all regions"*
- `index.html`: *"<150ms — Average latency"*

**Assessment:**
- This implies a measured p50 latency statistic aggregated across all regions
- For a newly launched product without meaningful production traffic, no such measurement exists
- The sample JSON in getting-started uses `"latency_ms": 142` (within the claim), but that's example code, not measured data
- "p50 across all regions" language implies rigorous performance benchmarking against production traffic

**What it should say:**
- Until verified with real traffic data: *"<150ms target latency"* or *"<150ms in benchmarks"*
- Alternatively: link to a public benchmark methodology

---

### FINDING 3.4

- **Issue type:** ASPIRATIONAL  
- **Severity:** LOW  
- **Pages affected:** `why-hookwing/index.html` (metrics section, line 2860)

**What it says:**
- *"40+ Countries served — via Cloudflare edge network"*

**Assessment:**
- Cloudflare's edge network operates in 100+ countries, so if Hookwing is built on Cloudflare Workers (as indicated by the tech stack), requests are technically handled across Cloudflare's global network
- "Countries served" is defensible in terms of infrastructure coverage
- However, it implies actual customer presence in 40+ countries, which is likely aspirational for a new product
- The qualifier "via Cloudflare edge network" partially mitigates this — it signals infrastructure reach rather than customer count

**What it should say:**
- Add clarity: *"Infrastructure available in 40+ countries via Cloudflare"* (if this is what's meant) OR
- Remove if referring to actual customer countries

---

## RECOMMENDED FIXES (Priority Order)

### P0 — Fix immediately (factual errors visible to prospects)

1. **Paper Plane retention** (7 days, not 30 days):
   - Fix `getting-started/index.html`: change "30-day history" → "7-day event history"
   - Fix `why-hookwing/index.html` comparison table: change Hookwing free row "30 days" → "7 days"

2. **Warbird retention** (90 days, not 365 days):
   - Fix `why-hookwing/index.html` Warbird pricing card: change "365-day retention" → "90-day retention"

3. **Hookdeck SLA** (99.999%, not 99.9%):
   - Fix `why-hookwing/index.html` comparison table Hookdeck SLA row: change "99.9% (Growth+)" → "99.999% (Growth+)"

4. **"99.99% SLA on paid plans" (only true for Jet)**:
   - Fix `why-hookwing/index.html` line 2123: qualify as "99.99% uptime SLA on Jet plan"
   - Fix `why-hookwing/index.html` comparison table: clarify "99.99% (Jet) / 99.9% (Warbird)"
   - Fix trust stats (line 1892): change "99.99% Uptime SLA" → "Up to 99.99% Uptime SLA"

### P1 — Address before launch (credibility issues)

5. **"1B+ Events processed"**: Remove or replace with a verifiable capacity claim
6. **"99.99% Uptime, 30-day rolling average"**: Remove until real data exists; use SLA commitment language instead
7. **"<150ms, p50 across all regions"**: Change to benchmark/target framing until measured in production

### P2 — Nice to fix (minor precision issues)

8. **"40+ Countries served"**: Add qualifier "via Cloudflare infrastructure" and verify whether this is customer count or infrastructure reach

---

## FILE REFERENCE

| File | Key claims | Issues found |
|------|-----------|--------------|
| `index.html` | `<150ms latency`, `99.99%` trust stat, pricing tier names/prices | Aspirational latency claim |
| `pricing/index.html` | Paper Plane 7-day, Warbird 90-day, Warbird 99.9% SLA | **Canonical** — these are correct |
| `why-hookwing/index.html` | Competitor comparison, "1B+", "99.99% SLA", Warbird "365-day" | Most issues concentrated here |
| `getting-started/index.html` | Free tier "30-day history" | 1 contradiction vs pricing page |
| `api/pricing/index.json` | Paper Plane 7-day, Warbird 90-day, Warbird 99.9% SLA | **Canonical** — these are correct |

The **pricing page** and **api/pricing/index.json** are internally consistent and should be treated as the source of truth. Discrepancies exist on the **why-hookwing** and **getting-started** pages.
