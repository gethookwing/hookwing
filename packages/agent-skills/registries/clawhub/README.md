# Hookwing Skill for ClawHub

This directory contains the OpenClaw-compatible skill manifest for Hookwing webhook management.

## Overview

The Hookwing skill enables AI coding agents to manage webhook infrastructure via the Hookwing API. Agents can create endpoints, receive events, verify signatures, monitor deliveries, and replay failed events.

## Files

- **SKILL.md** — OpenClaw skill manifest with metadata, tools, and API reference
- **README.md** — This file

## Quick Start

### Installation

```bash
npm install @hookwing/mcp
```

### Configuration

Set the `HOOKWING_API_KEY` environment variable:

```bash
export HOOKWING_API_KEY="your-api-key"
```

### Usage with ClawHub

The skill is automatically discovered by ClawHub when the MCP server is installed. Configure your agent to use the Hookwing MCP server.

## Features

- **Endpoint Management** — Create, update, list, and delete webhook endpoints
- **Event Ingestion** — Receive and process webhook events from any source
- **Signature Verification** — Verify webhook payload authenticity
- **Delivery Monitoring** — Track delivery status and troubleshoot issues
- **Event Replay** — Re-deliver failed events without external service involvement

## Supported Integrations

- GitHub (push, pull requests, releases)
- Stripe (payments, subscriptions, webhooks)
- Shopify (orders, products, customers)
- Slack (messages, events)
- SendGrid (email events)
- Twilio (SMS, voice events)
- Custom webhooks (any HTTP POST)

## Documentation

- [Hookwing Documentation](https://hookwing.com/docs)
- [API Reference](https://api.hookwing.com/docs)
- [MCP Server](https://github.com/hookwing/mcp)