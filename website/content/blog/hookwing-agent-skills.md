---
title: "Your AI agent already knows how to set up webhooks"
slug: "hookwing-agent-skills"
description: "The @hookwing/agent-skills package gives any LLM agent the ability to create endpoints, send events, and inspect deliveries without writing API code."
author: "alex-morgan"
publishDate: "2026-03-30T00:00:00.000Z"
updatedDate: "2026-03-30T00:00:00.000Z"
tags: ["ai-agents", "webhooks", "agent-skills", "mcp", "getting-started"]
category: "Tutorials"
readingTime: "5 min read"
heroImage: "/assets/blog/generated/hookwing-agent-skills-hero.jpg"
heroImageAlt: "Dark technical illustration showing an AI agent node connecting to webhook infrastructure through a skill plugin, aviation-themed"
draft: false
---

## In short

- `@hookwing/agent-skills` is a ready-made skill package for LLM agents.
- Import it once and your agent can create endpoints, ingest events, and inspect deliveries without writing API code.
- Works with any agent framework that supports tool use: LangChain, LlamaIndex, custom LLM loops.
- No 2FA, no CAPTCHA, no dashboard. The agent provisions its own webhook infrastructure.

---

Most webhook integrations require a developer to set things up: create an account, configure an endpoint, copy a signing secret, wire up a handler. That is fine when a human is doing the setup. It is a blocker when an agent needs to do it autonomously.

`@hookwing/agent-skills` removes that blocker. It is a prebuilt skill package that gives any LLM agent a complete webhook toolkit as callable tools: no API knowledge required, no manual configuration, no human in the loop.

---

## What the skill provides

The package exposes a set of tools the agent can call directly:

| Tool | What it does |
|------|-------------|
| `create_endpoint` | Provisions a new webhook endpoint, returns URL and signing secret |
| `list_endpoints` | Lists all active endpoints for the current account |
| `delete_endpoint` | Decommissions an endpoint by ID |
| `send_event` | Ingests a test event to a specific endpoint |
| `list_events` | Retrieves recent events for an endpoint |
| `get_delivery_status` | Returns delivery status, retry count, and response for a specific event |
| `replay_event` | Replays a failed event from the dead-letter queue |

The agent calls these the same way it calls any other tool: by name, with parameters, in natural language or structured JSON depending on the framework.

---

## Installation

```bash
npm install @hookwing/agent-skills
```

Set your API key:

```bash
export HOOKWING_API_KEY=hk_live_your_key
```

---

## Usage with LangChain

```typescript
import { HookwingSkills } from '@hookwing/agent-skills';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const tools = HookwingSkills.asLangChainTools();

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are an agent that manages webhook infrastructure.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: 'Create a webhook endpoint for payment events and show me the URL.',
});
```

The agent handles the rest. It calls `create_endpoint` with the right parameters, receives the URL and signing secret, and returns them in whatever format you asked for.

---

## Usage with a custom tool loop

If you are not using a framework, the skills can be registered as tools in any system that accepts a tool schema:

```typescript
import { HookwingSkills } from '@hookwing/agent-skills';

const tools = HookwingSkills.asTools();
// Returns an array of { name, description, parameters, execute } objects
// Register them with your tool dispatcher as-is
```

Each tool follows the same interface: a name, a JSON Schema for parameters, and an async `execute` function. Drop them into any tool registry.

---

## What an agent can do with these tools

Once the skills are loaded, the agent can manage its own [webhook infrastructure](/blog/webhook-endpoint-for-ai-agents/) end-to-end:

**Autonomous setup:**
> "Create a webhook endpoint for `payment.completed` and `payment.failed` events. Store the signing secret in the session context."

**Self-monitoring:**
> "Check the delivery status of the last 10 events on endpoint `ep_01HX`. Are there any failed deliveries?"

**Incident response:**
> "Find any events in the dead-letter queue for endpoint `ep_01HX` from the last hour and replay them."

**Cleanup:**
> "Delete all endpoints tagged `test` that were created before today."

None of these require a developer to log into a dashboard. The agent does the work, returns structured results, and moves on.

---

## How it compares to the MCP server

Hookwing also publishes an [MCP server](/blog/mcp-server-webhook-tool/) for IDE-integrated agents (Claude in Cursor, Cline, Windsurf). The difference is the context:

- **MCP server:** best for coding agents operating inside an IDE, where natural language tool use is driven by a developer conversation
- **`@hookwing/agent-skills`:** best for autonomous agents running in production, where the agent is making decisions programmatically without a human in the loop

Both expose the same underlying capabilities. The packaging differs by context.

---

## No human required

The design constraint behind `@hookwing/agent-skills` is the same as everything else Hookwing ships: no 2FA, no CAPTCHA, no browser flows. The agent authenticates with a long-lived API key. It can create accounts, provision endpoints, and manage its own infrastructure entirely over HTTP.

For agents that need to operate unattended (scheduled workflows, autonomous pipelines, multi-agent systems), this is the difference between a tool that works and one that needs a babysitter.

---

**Build reliable webhooks with Hookwing**

Hookwing handles delivery, retries, dead-letter queues, and observability. `@hookwing/agent-skills` gives your agents the tools to manage it all.

[Start free](https://hookwing.com). No 2FA, no CAPTCHA. Or go straight to the [API docs](https://hookwing.com/docs).
