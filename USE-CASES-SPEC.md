# Use Cases Page — Website Copy
**Author:** Brenda  
**Date:** March 7, 2026  
**Destination:** New page `/use-cases` — pass to Cody for implementation  

---

## Page: `/use-cases`

---

### HERO

**Eyebrow:** Use cases

**Headline:**  
What Hookwing actually does for you

**Sub:**  
Two integration patterns. Seven real workflows. One platform.  
Whether your agent polls for events or receives them in real time — Hookwing handles the infrastructure so you don't have to.

---

### SECTION 1 — THE TWO MODELS

**Eyebrow:** How it works

**Section headline:**  
Pull or push. Your choice.

**Intro:**  
Hookwing sits between the services sending events and the agents or systems consuming them. There are two ways to integrate — pick the one that fits your architecture.

---

#### Card A — Pull Model

**Badge:** Agent inbox

**Headline:**  
Your agent polls. Hookwing holds the events.

**Body:**  
Services like Stripe, GitHub, and Slack send webhooks to Hookwing. Hookwing verifies the signatures, stores the events, and waits. Your agent polls when it's ready — even if it was offline when the event fired.

**Workflow (arrow flow):**  
`Stripe / GitHub / Slack` → `Hookwing verifies + stores` → `Agent polls GET /events?since=<timestamp>`

**Key value:**  
No public endpoint needed. No missed events during restarts. Your agent is the consumer on its own schedule.

**Bullet list:**
- No public URL required — Hookwing is the inbox
- Events persist through agent downtime or restarts
- Poll on your own schedule — no event stream to maintain
- Full event history, replayable at any time

---

#### Card B — Push Model

**Badge:** Reliable delivery

**Headline:**  
Hookwing receives it. Hookwing delivers it.

**Body:**  
Hookwing receives the webhook, verifies the signature, and forwards it to your endpoint. If your agent is temporarily down, Hookwing buffers the event and retries with exponential backoff. No events lost. No custom retry logic to write.

**Workflow (arrow flow):**  
`Source service` → `Hookwing verifies + buffers` → `Your endpoint` → `Retry if needed`

**Key value:**  
You get a reliable delivery guarantee without building retry infrastructure yourself.

**Bullet list:**
- Automatic retry with exponential backoff
- Buffering during planned or unplanned downtime
- Signature verification handled per provider (Stripe, GitHub, etc.)
- Payload normalization across sources

---

### SECTION 2 — REAL WORKFLOWS

**Eyebrow:** Real workflows

**Section headline:**  
What this looks like in practice

**Intro:**  
These aren't hypotheticals. They're the patterns teams and agents are running today.

---

#### Workflow 1 — GitHub PR Reviews

**Headline:**  
Code review in seconds, not polling cycles

**Body:**  
A developer opens a pull request. GitHub fires a webhook to Hookwing. Hookwing verifies the signature, stores the event, and routes it to your coding agent. The agent reads the diff and posts a review — within seconds of the PR opening.

The alternative: poll the GitHub API every 30 minutes and hope you didn't miss anything.

**Workflow:**  
`PR opened` → `GitHub webhook → Hookwing` → `Signature verified, event stored` → `Coding agent reviews + comments`

**No Hookwing version:**  
Polling every 30 min → delayed reviews → stale comments → frustrated developers

---

#### Workflow 2 — Stripe Payments → Account Provisioning

**Headline:**  
Payment lands. Account is ready before the customer finishes their coffee.

**Body:**  
Customer checks out. Stripe fires a `payment_intent.succeeded` webhook to Hookwing. Your agent provisions the account, sends the welcome email, and updates the CRM — all before the confirmation page finishes loading.

If your agent happens to be restarting during the payment, Hookwing buffers the event. Nothing falls through the cracks.

**Workflow:**  
`Customer pays` → `Stripe webhook → Hookwing` → `Agent provisions account + sends email + updates CRM`

**Bullet list:**
- No webhook infrastructure to build
- Events buffered if agent is mid-restart
- Full delivery audit trail per payment event

---

#### Workflow 3 — Multi-Service Fanout

**Headline:**  
One event. Every system that needs to know, knows.

**Body:**  
A single incoming event — a new user signup, a completed order, a status change — needs to reach your CRM agent, your email agent, and your analytics pipeline. Hookwing fans it out to all three. Each destination retries independently. Full delivery visibility across every leg.

**Workflow:**  
`One event → Hookwing` → `CRM agent` + `Email agent` + `Analytics pipeline`  
(each retries independently)

**Bullet list:**
- Single source event, multiple destinations
- Per-destination retry — one slow endpoint doesn't block the others
- Full delivery status for every leg

---

#### Workflow 4 — Agent-to-Agent Communication

**Headline:**  
Agent A finishes. Agent B picks up. No direct networking required.

**Body:**  
Agent A completes a task and POSTs the result to a Hookwing endpoint. Agent B polls for new events when it's ready to proceed. No direct connection between agents, no shared infrastructure to set up, no message queue to manage.

Works across different platforms, different clouds, different runtimes.

**Workflow:**  
`Agent A completes task` → `POST result to Hookwing endpoint` → `Agent B polls GET /events` → `Picks up where A left off`

**Bullet list:**
- No direct networking between agents
- Works across clouds and runtimes
- Hookwing as lightweight, reliable message bus
- Full event history — audit the handoff at any time

---

#### Workflow 5 — Monitoring + Auto-Remediation

**Headline:**  
The 3am incident your agent handles before you wake up.

**Body:**  
Cloudflare, Datadog, or your uptime monitor fires an alert webhook to Hookwing. Your agent gets it immediately — not at the next polling interval. It investigates, runs the remediation playbook, and posts a summary to Slack.

You wake up to a resolved incident, not a pager alert.

**Workflow:**  
`Alert fires (Cloudflare / Datadog / uptime)` → `Hookwing` → `Agent investigates + remediates` → `Posts to Slack`

**Bullet list:**
- Real-time event delivery — no polling delay
- Agent handles remediation without human wake-up
- Full event log of what fired and when

---

### SECTION 3 — HOOKWING VS. DIY

**Eyebrow:** Why not just build it yourself?

**Section headline:**  
30 seconds vs. a few hours. You decide.

**Intro:**  
You can build webhook infrastructure yourself. Here's what that actually involves — and what you get with Hookwing instead.

**Comparison layout (two-column: DIY / Hookwing)**

| | DIY / AWS | Hookwing |
|---|---|---|
| **Setup time** | Hours of IAM roles, Lambda config, SQS queues, retry logic | 30 seconds. One POST to create an endpoint. |
| **Signature verification** | Write per-provider (Stripe, GitHub, etc.) | Built in. Every major provider. |
| **Retry logic** | Write it yourself, test it, maintain it | Automatic. Exponential backoff. Configurable. |
| **Event history + replay** | Build a log store or live without it | Full history, queryable, replayable via API |
| **Debugging** | CloudWatch logs at best | Real-time payload inspector in dashboard |
| **Free tier** | Nothing meaningful until you pay | 10,000 events/month, no credit card |
| **Agent access** | No standard — varies by service | REST API designed for agents. No 2FA. Pull or push. |
| **Cloud account required** | Yes — AWS, GCP, or Azure | No. Just an API key. |

**Callout below table:**  
> If you're prototyping, the DIY approach costs you a day you didn't have.  
> If you're running agents in production, it costs you reliability you can't afford to lose.

---

### SECTION 4 — CTA

**Headline:**  
Pick your pattern. Start in 30 seconds.

**Sub:**  
Free tier. No credit card. No 2FA.  
Agents can provision programmatically — POST to `/v1/auth/signup`.

**Buttons:**
- Primary: `Try the playground`
- Secondary: `Read API docs`

**Beneath buttons:**
`Machine-readable use case index at /api/use-cases` *(if we want to add this — optional)*

---

## Layout Notes for Cody

- **Page structure:** Hero → Two-model cards (side by side, desktop) → 5 workflow cards (grid or stacked) → DIY comparison table → CTA
- **Two-model cards:** Consider a subtle visual diagram for each (arrow flow). Keep it simple — text-based arrows are fine if SVG is too much for now.
- **Workflow cards:** Each gets an eyebrow badge, headline, body, arrow-flow line, and bullet list. Consistent card treatment.
- **DIY comparison:** Table component. Hookwing column gets the brand treatment (Emerald checkmarks, etc.)
- **Tone throughout:** No fluff. Every line earns its place. If a sentence doesn't tell you something useful, cut it.
- **Nav:** Add `Use cases` link to main navigation (between `Why Hookwing` and `Playground`, or as a sub-item under `Why Hookwing`)
- **URL:** `/use-cases`
