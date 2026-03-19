"""Tests for API client."""

import httpx
import respx
import pytest

from hookwing import HookwingClient


class TestHookwingClient:
    """Tests for HookwingClient."""

    @pytest.fixture
    def client(self):
        return HookwingClient("test-api-key", base_url="https://api.test.hookwing.com")

    @pytest.mark.asyncio
    async def test_list_endpoints(self, client):
        """Test listing endpoints."""
        mock_response = {
            "endpoints": [
                {
                    "id": "ep_123",
                    "name": "Test Endpoint",
                    "url": "https://example.com/webhook",
                    "description": "Test description",
                    "events": ["order.created"],
                    "secret": "whsec_abc",
                    "is_enabled": True,
                }
            ]
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/endpoints").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            endpoints = await client.list_endpoints()

            assert len(endpoints) == 1
            assert endpoints[0].id == "ep_123"
            assert endpoints[0].name == "Test Endpoint"
            assert route.called

    @pytest.mark.asyncio
    async def test_create_endpoint(self, client):
        """Test creating an endpoint."""
        mock_response = {
            "endpoint": {
                "id": "ep_new",
                "name": "New Endpoint",
                "url": "https://example.com/hook",
                "description": None,
                "events": ["order.created"],
                "is_enabled": True,
            }
        }
        with respx.mock:
            route = respx.post("https://api.test.hookwing.com/v1/endpoints").mock(
                return_value=httpx.Response(201, json=mock_response)
            )

            endpoint = await client.create_endpoint(
                name="New Endpoint",
                url="https://example.com/hook",
                events=["order.created"],
            )

            assert endpoint.id == "ep_new"
            assert endpoint.name == "New Endpoint"
            assert route.called

    @pytest.mark.asyncio
    async def test_get_endpoint(self, client):
        """Test getting a single endpoint."""
        mock_response = {
            "endpoint": {
                "id": "ep_123",
                "name": "Test",
                "url": "https://example.com/hook",
                "is_enabled": True,
            }
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/endpoints/ep_123").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            endpoint = await client.get_endpoint("ep_123")

            assert endpoint.id == "ep_123"
            assert route.called

    @pytest.mark.asyncio
    async def test_update_endpoint(self, client):
        """Test updating an endpoint."""
        mock_response = {
            "endpoint": {
                "id": "ep_123",
                "name": "Updated Name",
                "url": "https://example.com/hook",
                "is_enabled": False,
            }
        }
        with respx.mock:
            route = respx.patch("https://api.test.hookwing.com/v1/endpoints/ep_123").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            endpoint = await client.update_endpoint("ep_123", name="Updated Name", is_enabled=False)

            assert endpoint.name == "Updated Name"
            assert endpoint.is_enabled is False
            assert route.called

    @pytest.mark.asyncio
    async def test_delete_endpoint(self, client):
        """Test deleting an endpoint."""
        with respx.mock:
            route = respx.delete("https://api.test.hookwing.com/v1/endpoints/ep_123").mock(
                return_value=httpx.Response(204)
            )

            await client.delete_endpoint("ep_123")

            assert route.called

    @pytest.mark.asyncio
    async def test_list_events(self, client):
        """Test listing events."""
        mock_response = {
            "events": [
                {
                    "id": "evt_123",
                    "event_type": "order.created",
                    "payload": {"orderId": "ord_1"},
                }
            ]
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/events").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            events = await client.list_events()

            assert len(events) == 1
            assert events[0].id == "evt_123"
            assert events[0].event_type == "order.created"

    @pytest.mark.asyncio
    async def test_get_event(self, client):
        """Test getting an event."""
        mock_response = {
            "event": {
                "id": "evt_123",
                "event_type": "order.created",
                "payload": {"orderId": "ord_1"},
            }
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/events/evt_123").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            event = await client.get_event("evt_123")

            assert event.id == "evt_123"
            assert event.event_type == "order.created"

    @pytest.mark.asyncio
    async def test_replay_event(self, client):
        """Test replaying an event."""
        with respx.mock:
            route = respx.post("https://api.test.hookwing.com/v1/events/evt_123/replay").mock(
                return_value=httpx.Response(200)
            )

            await client.replay_event("evt_123")

            assert route.called

    @pytest.mark.asyncio
    async def test_list_deliveries(self, client):
        """Test listing deliveries."""
        mock_response = {
            "deliveries": [
                {
                    "id": "del_123",
                    "event_id": "evt_123",
                    "endpoint_id": "ep_123",
                    "url": "https://example.com/hook",
                    "status_code": 200,
                    "status": "success",
                    "attempt": 1,
                }
            ]
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/deliveries").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            deliveries = await client.list_deliveries(status="success")

            assert len(deliveries) == 1
            assert deliveries[0].id == "del_123"
            assert deliveries[0].status == "success"

    @pytest.mark.asyncio
    async def test_get_delivery(self, client):
        """Test getting a delivery."""
        mock_response = {
            "delivery": {
                "id": "del_123",
                "event_id": "evt_123",
                "endpoint_id": "ep_123",
                "url": "https://example.com/hook",
                "status_code": 200,
                "status": "success",
                "attempt": 1,
            }
        }
        with respx.mock:
            route = respx.get("https://api.test.hookwing.com/v1/deliveries/del_123").mock(
                return_value=httpx.Response(200, json=mock_response)
            )

            delivery = await client.get_delivery("del_123")

            assert delivery.id == "del_123"
            assert delivery.status == "success"

    @pytest.mark.asyncio
    async def test_close(self, client):
        """Test closing the client."""
        await client.close()
        # Should not raise
