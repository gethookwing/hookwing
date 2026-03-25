# Hookwing LangChain Tools

This directory contains LangChain tool wrappers for the Hookwing webhook API.

## Installation

```bash
pip install httpx langchain-core
```

## Quick Start

```python
from hookwing_tool import get_hooks_tools

# Create tools with your API key
tools = get_hooks_tools(api_key="your-hookwing-api-key")

# Use with LangChain agents
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")
agent = create_openai_functions_agent(llm, tools)
executor = AgentExecutor(agent=agent, tools=tools)

# Use the agent
result = executor.invoke({
    "input": "List all webhook endpoints in my workspace"
})
```

## Available Tools

| Tool | Description |
|------|-------------|
| `hookwing_list_endpoints` | List all webhook endpoints |
| `hookwing_create_endpoint` | Create a new webhook endpoint |
| `hookwing_get_endpoint` | Get endpoint details by ID |
| `hookwing_update_endpoint` | Update an existing endpoint |
| `hookwing_delete_endpoint` | Delete an endpoint |
| `hookwing_list_events` | List received events with filters |
| `hookwing_get_event` | Get event details including payload |
| `hookwing_replay_event` | Re-deliver a failed event |
| `hookwing_get_deliveries` | List delivery attempts |
| `hookwing_verify_signature` | Verify webhook payload signature |

## Environment Variables

Set your API key:

```python
import os
os.environ["HOOKWING_API_KEY"] = "your-api-key"
```

Or pass directly:

```python
tools = get_hooks_tools(api_key=os.environ["HOOKWING_API_KEY"])
```

## Example Usage

### Create an endpoint

```python
from hookwing_tool import HookwingCreateEndpointTool

tool = HookwingCreateEndpointTool(api_key="your-key")
result = tool.run({
    "url": "https://your-server.com/webhooks",
    "events": ["push", "pull_request"],
    "name": "GitHub Webhooks"
})
```

### List events

```python
from hookwing_tool import HookwingListEventsTool

tool = HookwingListEventsTool(api_key="your-key")
result = tool.run({
    "source": "github",
    "status": "failed",
    "limit": 10
})
```

### Replay a failed event

```python
from hookwing_tool import HookwingReplayEventTool

tool = HookwingReplayEventTool(api_key="your-key")
result = tool.run({"event_id": "evt_abc123"})
```