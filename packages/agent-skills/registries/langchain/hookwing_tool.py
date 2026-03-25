"""LangChain tool wrappers for Hookwing webhook API."""
import json
from typing import Optional, Type
from langchain_core.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun
import httpx


class HookwingListEndpointsTool(BaseTool):
    """List all webhook endpoints in your Hookwing workspace."""

    name: str = "hookwing_list_endpoints"
    description: str = """List all webhook endpoints in your Hookwing workspace.
    Returns up to 50 endpoints by default. Use limit and offset for pagination."""

    api_key: str

    def _run(
        self,
        limit: int = 50,
        offset: int = 0,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.get(
            "https://api.hookwing.com/v1/endpoints",
            headers={"Authorization": f"Bearer {self.api_key}"},
            params={"limit": limit, "offset": offset},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingCreateEndpointTool(BaseTool):
    """Create a new webhook endpoint."""

    name: str = "hookwing_create_endpoint"
    description: str = """Create a new webhook endpoint.
    Required: url - The destination URL for webhook events.
    Optional: events - List of event types, secret for signing, name for identification."""

    api_key: str

    def _run(
        self,
        url: str,
        events: Optional[list[str]] = None,
        secret: Optional[str] = None,
        name: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        payload = {"url": url}
        if events:
            payload["events"] = events
        if secret:
            payload["secret"] = secret
        if name:
            payload["name"] = name

        response = httpx.post(
            "https://api.hookwing.com/v1/endpoints",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingGetEndpointTool(BaseTool):
    """Get details of a specific webhook endpoint."""

    name: str = "hookwing_get_endpoint"
    description: str = """Get details of a specific webhook endpoint by ID."""

    api_key: str

    def _run(
        self,
        endpoint_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.get(
            f"https://api.hookwing.com/v1/endpoints/{endpoint_id}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingUpdateEndpointTool(BaseTool):
    """Update an existing webhook endpoint."""

    name: str = "hookwing_update_endpoint"
    description: str = """Update an existing webhook endpoint.
    Required: endpoint_id.
    Optional: url, events, secret, name."""

    api_key: str

    def _run(
        self,
        endpoint_id: str,
        url: Optional[str] = None,
        events: Optional[list[str]] = None,
        secret: Optional[str] = None,
        name: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
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
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingDeleteEndpointTool(BaseTool):
    """Delete a webhook endpoint."""

    name: str = "hookwing_delete_endpoint"
    description: str = """Delete a webhook endpoint by ID."""

    api_key: str

    def _run(
        self,
        endpoint_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.delete(
            f"https://api.hookwing.com/v1/endpoints/{endpoint_id}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        return json.dumps({"success": True, "deleted": endpoint_id})


class HookwingListEventsTool(BaseTool):
    """List received webhook events with filtering."""

    name: str = "hookwing_list_events"
    description: str = """List received webhook events.
    Optional filters: endpoint_id, source, type, status.
    Use limit and offset for pagination."""

    api_key: str

    def _run(
        self,
        endpoint_id: Optional[str] = None,
        source: Optional[str] = None,
        event_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
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
            headers={"Authorization": f"Bearer {self.api_key}"},
            params=params,
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingGetEventTool(BaseTool):
    """Get full details of a webhook event."""

    name: str = "hookwing_get_event"
    description: str = """Get full details of a webhook event by ID, including the full payload."""

    api_key: str

    def _run(
        self,
        event_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.get(
            f"https://api.hookwing.com/v1/events/{event_id}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingReplayEventTool(BaseTool):
    """Re-deliver a failed webhook event."""

    name: str = "hookwing_replay_event"
    description: str = """Re-deliver a failed webhook event to its endpoint.
    Use this to retry delivery of events that previously failed."""

    api_key: str

    def _run(
        self,
        event_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.post(
            f"https://api.hookwing.com/v1/events/{event_id}/replay",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingGetDeliveriesTool(BaseTool):
    """List delivery attempts for an endpoint or event."""

    name: str = "hookwing_get_deliveries"
    description: str = """List delivery attempts.
    Filter by endpoint_id, event_id, or status (success/failed)."""

    api_key: str

    def _run(
        self,
        endpoint_id: Optional[str] = None,
        event_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        params = {"limit": limit}
        if endpoint_id:
            params["endpoint_id"] = endpoint_id
        if event_id:
            params["event_id"] = event_id
        if status:
            params["status"] = status

        response = httpx.get(
            "https://api.hookwing.com/v1/deliveries",
            headers={"Authorization": f"Bearer {self.api_key}"},
            params=params,
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


class HookwingVerifySignatureTool(BaseTool):
    """Verify webhook payload signature."""

    name: str = "hookwing_verify_signature"
    description: str = """Verify the signature of a webhook payload.
    Required: payload (raw body), signature (from header), secret (endpoint secret)."""

    api_key: str

    def _run(
        self,
        payload: str,
        signature: str,
        secret: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool."""
        response = httpx.post(
            "https://api.hookwing.com/v1/verify",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"payload": payload, "signature": signature, "secret": secret},
        )
        response.raise_for_status()
        return json.dumps(response.json(), indent=2)


def get_hooks_tools(api_key: str) -> list[BaseTool]:
    """Create all Hookwing tools for use with LangChain.

    Args:
        api_key: Your Hookwing API key

    Returns:
        List of LangChain BaseTool instances
    """
    return [
        HookwingListEndpointsTool(api_key=api_key),
        HookwingCreateEndpointTool(api_key=api_key),
        HookwingGetEndpointTool(api_key=api_key),
        HookwingUpdateEndpointTool(api_key=api_key),
        HookwingDeleteEndpointTool(api_key=api_key),
        HookwingListEventsTool(api_key=api_key),
        HookwingGetEventTool(api_key=api_key),
        HookwingReplayEventTool(api_key=api_key),
        HookwingGetDeliveriesTool(api_key=api_key),
        HookwingVerifySignatureTool(api_key=api_key),
    ]