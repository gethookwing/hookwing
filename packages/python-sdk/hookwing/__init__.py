"""
Hookwing Python SDK

Webhook signature verification + typed API client.
"""

from hookwing.types import Delivery, Endpoint, Event
from hookwing.webhook import (
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    EVENT_TYPE_HEADER,
    Webhook,
    WebhookEvent,
    WebhookVerificationError,
)
from hookwing.client import HookwingClient

__all__ = [
    # Types
    "Delivery",
    "Endpoint",
    "Event",
    # Webhook
    "SIGNATURE_HEADER",
    "TIMESTAMP_HEADER",
    "EVENT_TYPE_HEADER",
    "Webhook",
    "WebhookEvent",
    "WebhookVerificationError",
    # Client
    "HookwingClient",
]

__version__ = "0.0.1"
