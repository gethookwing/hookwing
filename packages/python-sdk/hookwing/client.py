"""
Hookwing API client.

Async HTTP client for managing endpoints, events, and deliveries.
"""

from typing import Any, Optional

import httpx

from hookwing.types import Delivery, Endpoint, Event


class HookwingClient:
    """
    Async API client for Hookwing.

    Example:
        import asyncio
        from hookwing import HookwingClient

        async def main():
            client = HookwingClient("your-api-key")

            # List endpoints
            endpoints = await client.list_endpoints()
            print(endpoints)

            # Create endpoint
            endpoint = await client.create_endpoint(
                name="My Endpoint",
                url="https://example.com/webhook",
            )
            print(endpoint)

            await client.close()

        asyncio.run(main())
    """

    DEFAULT_BASE_URL = "https://api.hookwing.com"

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL):
        """
        Initialize the Hookwing API client.

        Args:
            api_key: Your Hookwing API key.
            base_url: Base URL for the API (default: https://api.hookwing.com).
        """
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Make an HTTP request to the API."""
        url = f"{self._base_url}{path}"
        response = await self._client.request(method, url, **kwargs)
        response.raise_for_status()
        # Handle empty responses (e.g., 204 No Content)
        if response.content:
            return response.json()
        return {}

    # === Endpoints ===

    async def list_endpoints(self) -> list[Endpoint]:
        """List all endpoints."""
        data = await self._request("GET", "/v1/endpoints")
        return [Endpoint(**item) for item in data.get("endpoints", [])]

    async def create_endpoint(
        self,
        name: str,
        url: str,
        *,
        description: Optional[str] = None,
        events: Optional[list[str]] = None,
    ) -> Endpoint:
        """
        Create a new endpoint.

        Args:
            name: Name of the endpoint.
            url: Destination URL for webhooks.
            description: Optional description.
            events: List of event types to subscribe to (e.g., ['order.created']).
        """
        payload: dict[str, Any] = {"name": name, "url": url}
        if description is not None:
            payload["description"] = description
        if events is not None:
            payload["events"] = events

        data = await self._request("POST", "/v1/endpoints", json=payload)
        return Endpoint(**data["endpoint"])

    async def get_endpoint(self, id: str) -> Endpoint:
        """Get an endpoint by ID."""
        data = await self._request("GET", f"/v1/endpoints/{id}")
        return Endpoint(**data["endpoint"])

    async def update_endpoint(
        self,
        id: str,
        *,
        name: Optional[str] = None,
        url: Optional[str] = None,
        description: Optional[str] = None,
        events: Optional[list[str]] = None,
        is_enabled: Optional[bool] = None,
    ) -> Endpoint:
        """
        Update an endpoint.

        Args:
            id: Endpoint ID.
            name: New name.
            url: New URL.
            description: New description.
            events: New event list.
            is_enabled: Enable/disable endpoint.
        """
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if url is not None:
            payload["url"] = url
        if description is not None:
            payload["description"] = description
        if events is not None:
            payload["events"] = events
        if is_enabled is not None:
            payload["is_enabled"] = is_enabled

        data = await self._request("PATCH", f"/v1/endpoints/{id}", json=payload)
        return Endpoint(**data["endpoint"])

    async def delete_endpoint(self, id: str) -> None:
        """Delete an endpoint."""
        await self._request("DELETE", f"/v1/endpoints/{id}")

    # === Events ===

    async def list_events(
        self,
        *,
        endpoint_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[Event]:
        """
        List events.

        Args:
            endpoint_id: Filter by endpoint ID.
            event_type: Filter by event type.
            limit: Maximum number of events to return.
        """
        params: dict[str, Any] = {"limit": limit}
        if endpoint_id is not None:
            params["endpoint_id"] = endpoint_id
        if event_type is not None:
            params["event_type"] = event_type

        data = await self._request("GET", "/v1/events", params=params)
        return [Event(**item) for item in data.get("events", [])]

    async def get_event(self, id: str) -> Event:
        """Get an event by ID."""
        data = await self._request("GET", f"/v1/events/{id}")
        return Event(**data["event"])

    async def replay_event(self, id: str) -> None:
        """Replay/retry an event."""
        await self._request("POST", f"/v1/events/{id}/replay")

    # === Deliveries ===

    async def list_deliveries(
        self,
        *,
        event_id: Optional[str] = None,
        endpoint_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[Delivery]:
        """
        List deliveries.

        Args:
            event_id: Filter by event ID.
            endpoint_id: Filter by endpoint ID.
            status: Filter by status (pending, success, failed).
            limit: Maximum number of deliveries to return.
        """
        params: dict[str, Any] = {"limit": limit}
        if event_id is not None:
            params["event_id"] = event_id
        if endpoint_id is not None:
            params["endpoint_id"] = endpoint_id
        if status is not None:
            params["status"] = status

        data = await self._request("GET", "/v1/deliveries", params=params)
        return [Delivery(**item) for item in data.get("deliveries", [])]

    async def get_delivery(self, id: str) -> Delivery:
        """Get a delivery by ID."""
        data = await self._request("GET", f"/v1/deliveries/{id}")
        return Delivery(**data["delivery"])
