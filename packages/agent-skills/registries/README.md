# Hookwing Agent Skill Registries

This directory contains agent skill manifests for various AI agent frameworks and registries.

## Overview

Hookwing provides webhook infrastructure for AI agents. These manifests enable AI agents to manage webhooks through their preferred framework or registry.

## Supported Registries

| Registry | Directory | Description |
|----------|-----------|-------------|
| **ClawHub (OpenClaw)** | `clawhub/` | OpenClaw-compatible skill manifest for ClawHub agents |
| **MCP** | `mcp/` | Model Context Protocol manifest for MCP-compatible agents |
| **LangChain** | `langchain/` | Python LangChain tool wrappers |
| **CrewAI** | `crewai/` | CrewAI toolkit for multi-agent systems |
| **Composio** | `composio/` | Composio integration manifest |

## Quick Start

### ClawHub (OpenClaw)

```bash
npm install @hookwing/mcp
```

Configure your agent to use the Hookwing MCP server. See `clawhub/SKILL.md` for full details.

### MCP

```bash
npm install @hookwing/mcp
export HOOKWING_API_KEY="your-api-key"
hookwing-mcp
```

### LangChain

```python
pip install httpx langchain-core
```

```python
from hookwing_tool import get_hooks_tools

tools = get_hooks_tools(api_key="your-key")
```

See `langchain/README.md` for full usage.

### CrewAI

```bash
pip install httpx crewai-tools
```

```python
from hookwing_toolkit import get_crewai_tools

tools = get_crewai_tools(api_key="your-key")
```

### Composio

Import the manifest at `composio/composio-manifest.json` into your Composio workspace.

## API Reference

All registries use the Hookwing API:

- **Base URL:** `https://api.hookwing.com`
- **Authentication:** Bearer token (`Authorization: Bearer <api_key>`)
- **Environment:** Set `HOOKWING_API_KEY`

### Core Features

1. **Endpoint Management** — Create, update, list, delete webhook endpoints
2. **Event Ingestion** — Receive and process webhook events
3. **Signature Verification** — Verify webhook payload authenticity
4. **Delivery Monitoring** — Track delivery status and troubleshoot
5. **Event Replay** — Re-deliver failed events

### Supported Integrations

- GitHub (push, PR, releases)
- Stripe (payments, subscriptions)
- Shopify (orders, products)
- Slack (messages, events)
- SendGrid (email events)
- Twilio (SMS, voice)
- Custom webhooks

## Files

```
registries/
├── README.md              # This file
├── clawhub/
│   ├── SKILL.md          # OpenClaw skill manifest
│   └── README.md         # ClawHub usage guide
├── mcp/
│   └── mcp-manifest.json # MCP server manifest
├── langchain/
│   ├── hookwing_tool.py  # LangChain tools
│   └── README.md         # LangChain usage guide
├── crewai/
│   └── hookwing_toolkit.py # CrewAI toolkit
└── composio/
    └── composio-manifest.json # Composio manifest
```

## Documentation

- [Hookwing Documentation](https://hookwing.com/docs)
- [API Reference](https://api.hookwing.com/docs)
- [MCP Server](https://github.com/hookwing/mcp)

## Support

- GitHub Issues: https://github.com/hookwing/hookwing/issues
- Discord: https://hookwing.com/discord
- Email: support@hookwing.com