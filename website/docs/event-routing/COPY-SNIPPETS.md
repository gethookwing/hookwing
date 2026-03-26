# Event routing — copy snippets for Cody (PROD-238)

These are the exact strings to drop into the homepage and Why Hookwing page.
Do not rewrite. Match whitespace/indentation of surrounding elements.

---

## 1. Homepage — Agent-Ready card bullet

**Location:** `index.html` — inside the Agent-Ready feature card, as a new `<li>` in the bullets list.
**Where exactly:** After the existing MCP bullet, before the closing `</ul>`.

```html
<li>Event routing — filter, transform, and fan-out by condition</li>
```

---

## 2. Why Hookwing — new sub-section inside Agent-Ready

**Location:** `why-hookwing/index.html` — inside the Agent-Ready / Agent-Native section.
**Where exactly:** As a new sub-block after the existing agent-native feature bullets, before the section closes.

```html
<div class="trust-feature" id="why-event-routing">
  <h4>Event routing</h4>
  <ul>
    <li>Send the right event to the right endpoint, automatically — by event type, payload field, or header value.</li>
    <li>Drop test events, fan-out high-value transactions, or extract payload fields before delivery — no code changes on your receiver.</li>
    <li>Available on Warbird and above. Up to 10 rules; unlimited on Stealth Jet.</li>
  </ul>
</div>
```

---

## 3. Docs sidebar/index — add Event Routing nav entry

**Location A:** `docs/index.html` — in the left sidebar `<nav>`, after the Deliveries entry.
```html
<a href="/docs/event-routing/" class="toc-h2">Event Routing</a>
```

**Location B:** All other docs pages that have the sidebar (`docs/authentication/`, `docs/endpoints/`, etc.) — same insertion point.
```html
<a href="/docs/event-routing/" class="toc-h2">Event Routing</a>
```

---

## 4. Footer — no change needed

The footer Product column already lists "Agent integrations". No new entry needed for Event Routing.

---

## Notes for Cody

- The docs page is fully written at `docs/event-routing/index.html` — no content changes needed there.
- Do not add Event Routing to the main nav bar (not a top-level page).
- Tier framing: always "Available on Warbird and above" (positive). Never "not available on free".
- Do not use the phrase "rules engine" anywhere.
