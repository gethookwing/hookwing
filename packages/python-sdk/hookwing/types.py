"""
Type definitions for Hookwing API entities.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class Endpoint:
    """A webhook endpoint."""

    id: str
    name: str
    url: str
    description: Optional[str] = None
    events: Optional[list[str]] = None
    secret: Optional[str] = None
    is_enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Event:
    """A webhook event."""

    id: str
    event_type: str
    payload: dict[str, Any]
    created_at: Optional[datetime] = None


@dataclass
class Delivery:
    """A webhook delivery attempt."""

    id: str
    event_id: str
    endpoint_id: str
    url: str
    status_code: Optional[int] = None
    status: str = "pending"
    response_body: Optional[str] = None
    error_message: Optional[str] = None
    attempt: int = 1
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
