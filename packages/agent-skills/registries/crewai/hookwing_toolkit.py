"""CrewAI toolkit for Hookwing webhook management."""
import json
from typing import Optional
from crewai_tools import BaseTool
import httpx


class HookwingEndpointsTool(BaseTool):
    """Create and manage webhook endpoints via Hookwing API.

    Use this tool to list, create, update, and delete webhook endpoints.
    """

    name: str = "Hookwing Endpoints"
    description: str = """Manage webhook endpoints in Hookwing.

    Actions:
    - list: List all endpoints (supports limit, offset)
    - create: Create new endpoint (requires url, optional events, secret, name)
    - get: Get endpoint by ID
    - update: Update endpoint (requires endpoint_id, optional url, events, secret, name)
    - delete: Delete endpoint by ID"""

    api_key: str

    def _run(
        self,
        action: str = "list",
        endpoint_id: Optional[str] = None,
        url: Optional[str] = None,
        events: Optional[list[str]] = None,
        secret: Optional[str] = None,
        name: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> str:
        """Execute the tool."""
        headers = {"Authorization": f"Bearer {self.api_key}"}

        if action == "list":
            response = httpx.get(
                "https://api.hookwing.com/v1/endpoints",
                headers=headers,
                params={"limit": limit, "offset": offset},
            )
        elif action == "create":
            payload = {"url": url}
            if events:
                payload["events"] = events
            if secret:
                payload["secret"] = secret
            if name:
                payload["name"] = name
            response = httpx.post(
                "https://api.hookwing.com/v1/endpoints",
                headers=headers,
                json=payload,
            )
        elif action == "get":
            response = httpx.get(
                f"https://api.hookwing.com/v1/endpoints/{endpoint_id}",
                headers=headers,
            )
        elif action == "update":
            payload = {}
            if url:
                payload["url"] = url
            if events:
                payload["events"] = events
            if secret:
                payload["secret"] = secret
            if name:
                payload["name"] = name
            response = httpx.patch(
                f"https://api.hookwing.com/v1/endpoints/{endpoint_id}",
                headers=headers,
                json=payload,
            )
        elif action == "delete":
            response = httpx.delete(
                f"https://api.hookwing.com/v1/endpoints/{endpoint_id}",
                headers=headers,
            )
        else:
            return json.dumps({"error": f"Unknown action: {action}"})

        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingEventsTool(BaseTool):
    """View and manage webhook events via Hookwing API.

    Use this tool to list and view received webhook events, and replay failed events.
    """

    name: str = "Hookwing Events"
    description: str = """Manage webhook events in Hookwing.

    Actions:
    - list: List events (supports filters: endpoint_id, source, type, status, limit, offset)
    - get: Get event by ID (returns full payload)
    - replay: Re-deliver a failed event by ID"""

    api_key: str

    def _run(
        self,
        action: str = "list",
        event_id: Optional[str] = None,
        endpoint_id: Optional[str] = None,
        source: Optional[str] = None,
        event_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> str:
        """Execute the tool."""
        headers = {"Authorization": f"Bearer {self.api_key}"}

        if action == "list":
            params = {"limit": limit, "offset": offset}
            if endpoint_id:
                params["endpoint_id"] = endpoint_id
            if source:
                params["source"] = source
            if event_type:
                params["type"] = event_type
            if status:
                params["status"] = status
            response = httpx.get(
                "https://api.hookwing.com/v1/events",
                headers=headers,
                params=params,
            )
        elif action == "get":
            response = httpx.get(
                f"https://api.hookwing.com/v1/events/{event_id}",
                headers=headers,
            )
        elif action == "replay":
            response = httpx.post(
                f"https://api.hookwing.com/v1/events/{event_id}/replay",
                headers=headers,
            )
        else:
            return json.dumps({"error": f"Unknown action: {action}"})

        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingDeliveriesTool(BaseTool):
    """View webhook delivery status via Hookwing API.

    Use this tool to track delivery attempts and troubleshoot failed webhooks.
    """

    name: str = "Hookwing Deliveries"
    description: str = """View webhook delivery attempts in Hookwing.

    Actions:
    - list: List deliveries (supports filters: endpoint_id, event_id, status, limit)
    - get: Get delivery details by ID"""

    api_key: str

    def _run(
        self,
        action: str = "list",
        delivery_id: Optional[str] = None,
        endpoint_id: Optional[str] = None,
        event_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> str:
        """Execute the tool."""
        headers = {"Authorization": f"Bearer {self.api_key}"}

        if action == "list":
            params = {"limit": limit}
            if endpoint_id:
                params["endpoint_id"] = endpoint_id
            if event_id:
                params["event_id"] = event_id
            if status:
                params["status"] = status
            response = httpx.get(
                "https://api.hookwing.com/v1/deliveries",
                headers=headers,
                params=params,
            )
        elif action == "get":
            response = httpx.get(
                f"https://api.hookwing.com/v1/deliveries/{delivery_id}",
                headers=headers,
            )
        else:
            return json.dumps({"error": f"Unknown action: {action}"})

        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingVerifyTool(BaseTool):
    """Verify webhook payload signatures.

    Use this tool to verify that incoming webhooks are authentic.
    """

    name: str = "Hookwing Verify Signature"
    description: str = """Verify webhook payload signature.

    Required parameters:
    - payload: The raw request body
    - signature: The signature from the webhook header
    - secret: The endpoint secret"""

    api_key: str

    def _run(
        self,
        payload: str,
        signature: str,
        secret: str,
    ) -> str:
        """Execute the tool."""
        response = httpx.post(
            "https://api.hookwing.com/v1/verify",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"payload": payload, "signature": signature, "secret": secret},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


def get_crewai_tools(api_key: str) -> list[BaseTool]:
    """Create all Hookwing tools for use with CrewAI.

    Args:
        api_key: Your Hookwing API key

    Returns:
        List of CrewAI BaseTool instances
    """
    return [
        HookwingEndpointsTool(api_key=api_key),
        HookwingEventsTool(api_key=api_key),
        HookwingDeliveriesTool(api_key=api_key),
        HookwingVerifyTool(api_key=api_key),
    ]