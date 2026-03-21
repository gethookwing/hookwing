# Use Cases Page — Website Copy (v2)
**Author:** Brenda  
**Date:** March 8, 2026  
**Status:** Revised per Fabien feedback — awaiting Cody availability  
**Changes from v1:** Less wordy, more genuine, removed dramatized scenarios, honest DIY comparison, OpenClaw example added

---

## Page: `/use-cases`

---

### HERO

**Eyebrow:** Use cases

**Headline:**  
What people actually build with Hookwing

**Sub:**  
Two integration patterns. Whether your agent pulls events or receives them in real time, the infrastructure is the same.

---

### SECTION 1 — THE TWO MODELS

**Eyebrow:** How it works

**Section headline:**  
Pull or push — both work.

---

#### Card A — Pull Model

**Badge:** Agent inbox

**Headline:**  
No public endpoint required.

**Body:**  
Services send webhooks to Hookwing. Your agent polls when it's ready — even if it was offline when the event fired. Hookwing holds the events.

**Workflow:**  
`Stripe / GitHub / Slack` → `Hookwing verifies + stores` → `Agent polls GET /events?since=<timestamp>`

**Bullets:**
- No public URL needed — Hookwing is the inbox
- Events persist through agent downtime or restarts
- Full event history, replayable any time

---

#### Card B — Push Model

**Badge:** Reliable delivery

**Headline:**  
Hookwing delivers. Retries if needed.

**Body:**  
Hookwing receives the webhook, verifies the signature, and forwards it to your endpoint. If your agent is temporarily down, it buffers and retries with exponential backoff.

**Workflow:**  
`Source service` → `Hookwing verifies + buffers` → `Your endpoint` → `Retry if needed`

**Bullets:**
- Automatic retry with exponential backoff
- Signature verification per provider
- No custom retry logic to write

---

### SECTION 2 — REAL WORKFLOWS

**Eyebrow:** Examples

**Section headline:**  
Common patterns

---

#### Workflow 1 — GitHub → Code Review Agent

**Headline:**  
PR opened → agent reviews it.

**Body:**  
A PR opens, GitHub fires a webhook to Hookwing, your coding agent gets it and posts a review. No polling loop. No delayed response.

**Workflow:**  
`PR opened` → `GitHub → Hookwing` → `Agent reviews + comments`

---

#### Workflow 2 — Stripe → Account Provisioning

**Headline:**  
Payment confirmed → account provisioned.

**Body:**  
Stripe fires `payment_intent.succeeded` to Hookwing. Your agent provisions the account, sends the welcome email, updates the CRM. If the agent is mid-restart when the payment lands, Hookwing holds the event until it's back.

**Workflow:**  
`Payment succeeds` → `Stripe → Hookwing` → `Agent provisions account + sends email`

---

#### Workflow 3 — Multi-Service Fanout

**Headline:**  
One event, multiple destinations.

**Body:**  
One incoming event routes to your CRM agent, email agent, and analytics pipeline. Each destination retries independently. You see delivery status per leg.

**Workflow:**  
`Event → Hookwing` → `CRM agent` + `Email agent` + `Analytics`

---

#### Workflow 4 — Agent-to-Agent Handoff

**Headline:**  
Agent A posts a result. Agent B picks it up.

**Body:**  
Agent A finishes a task and POSTs the result to a Hookwing endpoint. Agent B polls for it when ready. No direct networking between agents, no shared message queue to manage. OpenClaw uses this pattern internally to pass work between specialized agents.

**Workflow:**  
`Agent A → POST result to Hookwing` → `Agent B polls GET /events`

---

#### Workflow 5 — Alert → Agent Response

**Headline:**  
Uptime alert fires → agent investigates.

**Body:**  
Your monitoring tool sends a webhook to Hookwing. Your agent receives it and runs a diagnostic — no polling delay, no manual triage. Standard pattern for teams running unattended agent pipelines.

**Workflow:**  
`Alert (Datadog / Cloudflare / uptime monitor)` → `Hookwing` → `Agent investigates`

---

### SECTION 3 — DIY COMPARISON

**Eyebrow:** Alternatives

**Section headline:**  
What building it yourself involves

**Intro:**  
If you're evaluating whether to use Hookwing or roll your own, here's an honest breakdown of what each actually requires.

**Comparison table:**

| | DIY / AWS | Hookwing |
|---|---|---|
| **Setup** | IAM roles, Lambda config, SQS queues, retry logic | One POST to create an endpoint |
| **Signature verification** | Write per-provider (Stripe, GitHub, etc.) | Built in |
| **Retry logic** | Write, test, maintain | Automatic. Configurable. |
| **Event history + replay** | Build a log store or go without | Full history, queryable, replayable |
| **Debugging** | CloudWatch logs at best | Payload inspector in dashboard |
| **Free tier** | Nothing meaningful | 10,000 events/month, no credit card |
| **Agent access** | Varies — no standard | REST API, no 2FA, pull or push |
| **Cloud account required** | Yes | No |

**Callout below table:**  
The tradeoff is setup time and maintenance overhead, not capability. If you already have the infrastructure, you may not need us. If you're starting from scratch, we're faster.

---

### SECTION 4 — CTA

**Headline:**  
Start with the playground. No signup needed.

**Sub:**  
Or create a free account — 10,000 events/month, no credit card.  
Agents can provision programmatically via `/v1/auth/signup`.

**Buttons:**
- Primary: `Try the playground`
- Secondary: `Read API docs`

---

## Layout Notes for Cody (unchanged from v1)

- **Page structure:** Hero → Two-model cards (side by side, desktop) → 5 workflow cards → DIY comparison table → CTA
- **Workflow cards:** eyebrow badge, headline, short body, arrow-flow line, bullet list (where present)
- **DIY table:** Hookwing column with Emerald checkmarks
- **Nav:** Add `Use cases` between `Why Hookwing` and `Playground`
- **URL:** `/use-cases`
