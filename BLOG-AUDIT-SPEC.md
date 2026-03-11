# Blog Brand Audit
**Author:** Brenda  
**Date:** March 10, 2026  
**Posts audited:** 7  
**Status:** Issues found — fix list for Cody at bottom

---

## Summary

The blog template is structurally consistent. Voice and tone are solid across all posts — practical, direct, no fluff. Three hard issues need immediate fixes (missing OG image, wrong OG image, empty meta description). One systemic issue affects the whole blog: the CTA block and agent framing are not calibrated per post.

---

## Issues by Category

---

### 1. OG / Meta — Three Posts Have Problems

**Critical: `webhooks-for-ai-agents` — missing OG image AND empty description**

This is the blog's highest-value agent-first post and it has the worst social sharing setup:
- `og:description` is empty string
- `og:image` is missing entirely (empty array in JSON-LD)
- `meta name="description"` is also empty

When shared on Twitter, LinkedIn, or Slack, this post renders with no preview image and no description. For the most strategically important post on the blog, that's a significant gap.

**Fix:** Add description + OG image. Suggested description:
> "AI agents can't poll the world. Webhooks give them real-time awareness. How agents use webhooks and what to look for in a platform."

---

**High: `webhook-idempotency-checklist` — wrong OG image**

The idempotency post is using the retry post's hero image:
```
og:image: webhook-retry-best-practices-visual-01-retry-timeline.webp
```
This is a copy-paste error. The retry timeline has nothing to do with idempotency.

**Fix:** Replace with the correct idempotency-specific image, or generate a new one.

---

**Low: `webhook-retry-best-practices` — weak OG description**

```
og:description: "Retries help, but they are only one part of webhook reliability."
```
One sentence with no specifics. Doesn't sell the content or communicate what the reader will get.

**Fix:** Expand. Suggested:
> "How to build webhook retry logic that doesn't hammer failing endpoints, cause duplicate events, or leave you blind to what's failing. With exact backoff intervals and DLQ patterns."

---

### 2. CTA Block — Generic Across All 7 Posts

Every post ends with the same CTA:

> **"Ready to ship event delivery with confidence?"**  
> Start free and use retries, replay, and observability with clear operational controls.

This is a generic fallback. Two problems:

**a) Doesn't match post content.** A post about signature verification shouldn't CTA with "retries, replay, and observability." A post about agent endpoints shouldn't use the same CTA as a post about dead letter queues.

**b) No agent-first framing on the agent posts.** `webhook-endpoint-for-ai-agents` and `webhooks-for-ai-agents` are talking directly to agent builders — but they end with a CTA written for generic developers.

**Recommended CTAs per post:**

| Post | Suggested CTA headline | Suggested sub |
|------|----------------------|---------------|
| `webhooks-for-ai-agents` | Give your agent a webhook endpoint. | No 2FA. No browser. One API call. |
| `webhook-endpoint-for-ai-agents` | Your agent is ready for real-time events. | Create an endpoint in one POST. No dashboard needed. |
| `webhook-signature-verification` | Hookwing verifies signatures automatically. | Every delivery is signed. You just check it. |
| `webhook-idempotency-checklist` | Replay safely. No duplicate side effects. | Full event history, replayable via API. |
| `webhook-retry-best-practices` | Retries, DLQ, replay — built in. | Stop writing retry logic. Start shipping. |
| `webhook-monitoring-observability` | Real-time delivery visibility. Out of the box. | Payload inspector, event history, and status at /api/status. |
| `webhook-dead-letter-queues` | Failed events don't disappear. They wait in your DLQ. | Inspect, fix the root cause, replay. |

---

### 3. Agent-First Framing — Uneven Across Posts

Agent mentions by post:

| Post | Agent mentions | Assessment |
|------|---------------|------------|
| `webhooks-for-ai-agents` | 56 | ✅ Strong — built for this |
| `webhook-endpoint-for-ai-agents` | 41 | ✅ Strong — built for this |
| `webhook-dead-letter-queues` | 5 | 🟡 Light agent angle present |
| `webhook-signature-verification` | 4 | 🟡 Brief mention |
| `webhook-monitoring-observability` | 3 | 🟠 Minimal |
| `webhook-retry-best-practices` | 2 | 🟠 Minimal |
| `webhook-idempotency-checklist` | 2 | 🟠 Minimal |

The technical posts (retry, idempotency, monitoring, signature verification) were written for developers with essentially no agent framing. That was fine before the agent-first pivot. Now they're slightly out of step with the brand direction.

**Recommendation: add one "agent angle" paragraph per post — not a rewrite.**

Each technical post just needs a bridge section (1–3 sentences) showing why this topic matters specifically for agents. Examples:

- **Retry post:** *"If your agent is consuming webhooks and temporarily offline, retry logic is what keeps events from being silently dropped. Hookwing handles this automatically — your agent just needs to be reachable when it comes back up."*
- **Idempotency post:** *"Agents are particularly vulnerable to duplicate processing — they often run in environments where retries are aggressive and failures are hard to detect. Idempotency keys are how you make replays safe."*
- **Monitoring post:** *"Agents running unattended have no one watching for failures. The metrics and alert thresholds here apply directly to agent-consumed webhook endpoints."*
- **Signature verification post:** *"Agents verifying signatures programmatically need to handle the raw body before any parsing — a common mistake in agent frameworks that process JSON before reaching the verification step."*

These are small additions, not rewrites. They connect existing technical content to the agent-first audience without breaking the posts for human developers.

---

### 4. Visual Template — Mostly Consistent, One Gap

**Structure across 7 posts:**
- Article header ✅ all posts
- Post eyebrow badge ✅ all posts  
- Reading time ✅ all posts
- "In short" TOC sidebar ✅ all posts
- CTA block ✅ all posts

**Hero image inconsistency:**

| Post | Hero image format |
|------|------------------|
| `webhook-dead-letter-queues` | `.png` (generated) ✅ |
| `webhook-endpoint-for-ai-agents` | `.png` (generated) ✅ |
| `webhook-monitoring-observability` | `.png` (generated) ✅ |
| `webhook-signature-verification` | `.png` (generated) ✅ |
| `webhook-retry-best-practices` | `.webp` (optimized) — different format |
| `webhook-idempotency-checklist` | `.webp` (optimized) + **wrong image** |
| `webhooks-for-ai-agents` | **Missing** — no hero image at all |

Three posts are out of step: two use `.webp` (fine technically, but visually inconsistent if the generated PNGs have a different aesthetic), and one has no image at all.

---

## Fix List for Cody

**Immediate (blockers for social sharing):**

1. `webhooks-for-ai-agents` — add `og:image`, `og:description`, `meta description` (copy above)
2. `webhook-idempotency-checklist` — replace OG image with correct post image
3. `webhook-retry-best-practices` — update `og:description` (copy above)

**Short-term (brand consistency):**

4. All 7 posts — replace generic CTA block with post-specific CTA (copy table above)
5. `webhooks-for-ai-agents` — add hero image (consistent with other generated PNGs)

**Medium-term (agent-first alignment):**

6. `webhook-retry-best-practices` — add agent angle paragraph (copy above)
7. `webhook-idempotency-checklist` — add agent angle paragraph
8. `webhook-monitoring-observability` — add agent angle paragraph
9. `webhook-signature-verification` — add agent angle paragraph

---

## What's Working Well

- **Voice and tone:** Consistent across all 7 posts. Practical, direct, no hype. The "In short" opener is a strong structural pattern that should stay.
- **Technical depth:** Posts are genuinely useful — not thin SEO content. That's a brand asset.
- **Template structure:** article-header, eyebrow, reading time, TOC sidebar, CTA — uniform and clean.
- **The two agent-first posts** are excellent and well-positioned. They just need OG fixes.
