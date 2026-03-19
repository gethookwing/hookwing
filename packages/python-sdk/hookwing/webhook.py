"""
Hookwing Webhook verifier

Verifies HMAC-SHA256 signatures on incoming Hookwing webhook deliveries.

Example:
    from hookwing import Webhook

    wh = Webhook('whsec_your_signing_secret')

    # In your webhook handler:
    payload = await request.text()
    signature = request.headers.get('X-Hookwing-Signature')
    timestamp = request.headers.get('X-Hookwing-Timestamp')

    event = await wh.verify(payload, {'signature': signature, 'timestamp': timestamp})
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Optional

SIGNATURE_HEADER = "x-hookwing-signature"
TIMESTAMP_HEADER = "x-hookwing-timestamp"
EVENT_TYPE_HEADER = "x-event-type"

# Default tolerance window for timestamp verification (5 minutes)
DEFAULT_TOLERANCE_MS = 5 * 60 * 1000


@dataclass
class WebhookEvent:
    """Parsed webhook event."""

    id: str
    type: str
    timestamp: int
    payload: dict[str, Any]


class WebhookVerificationError(Exception):
    """Raised when webhook signature verification fails."""

    pass


class Webhook:
    """Verifies Hookwing webhook signatures."""

    def __init__(self, secret: str, *, tolerance_ms: int = DEFAULT_TOLERANCE_MS):
        """
        Initialize the webhook verifier.

        Args:
            secret: The webhook signing secret (with or without 'whsec_' prefix).
            tolerance_ms: Maximum age in milliseconds for timestamp validation (default: 5 minutes).
        """
        if not secret:
            raise ValueError("Webhook secret is required")
        # Strip 'whsec_' prefix if present
        self._secret = secret[6:] if secret.startswith("whsec_") else secret
        self._tolerance_ms = tolerance_ms

    async def verify(
        self,
        payload: str,
        headers: dict[str, Optional[str]],
    ) -> WebhookEvent:
        """
        Verify a webhook payload and return the parsed event.

        Args:
            payload: The raw request body.
            headers: Dictionary with 'signature' and 'timestamp' keys.

        Returns:
            WebhookEvent: The parsed and verified event.

        Raises:
            WebhookVerificationError: If signature is invalid, timestamp is missing/stale,
                                       or payload is not valid JSON.
        """
        signature = headers.get("signature")
        timestamp = headers.get("timestamp")

        if not signature:
            raise WebhookVerificationError("Missing X-Hookwing-Signature header")
        if not timestamp:
            raise WebhookVerificationError("Missing X-Hookwing-Timestamp header")

        # Validate timestamp format
        try:
            ts = int(timestamp)
        except ValueError:
            raise WebhookVerificationError("Invalid X-Hookwing-Timestamp header")

        # Check timestamp staleness
        now = int(time.time() * 1000)  # milliseconds
        age = abs(now - ts)
        if age > self._tolerance_ms:
            raise WebhookVerificationError(
                f"Webhook timestamp too old ({round(age / 1000)}s ago, "
                f"tolerance: {round(self._tolerance_ms / 1000)}s)"
            )

        # Verify HMAC signature
        is_valid = await self.verify_signature(payload, signature)
        if not is_valid:
            raise WebhookVerificationError("Webhook signature verification failed")

        # Parse payload
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            raise WebhookVerificationError("Webhook payload is not valid JSON")

        event = parsed if isinstance(parsed, dict) else {}

        return WebhookEvent(
            id=event.get("id", ""),
            type=event.get("type", "unknown"),
            timestamp=ts,
            payload=event,
        )

    async def verify_signature(self, payload: str, signature_header: str) -> bool:
        """
        Verify signature only (without timestamp check).

        Args:
            payload: The raw payload string.
            signature_header: The signature header value (e.g., 'sha256=abc123...').

        Returns:
            bool: True if signature is valid, False otherwise.
        """
        if not signature_header.startswith("sha256="):
            return False

        expected_sig = signature_header[7:]  # Strip 'sha256='
        actual_sig = self._compute_hmac(payload)

        # Constant-time comparison
        return hmac.compare_digest(expected_sig, actual_sig)

    def _compute_hmac(self, payload: str) -> str:
        """
        Compute HMAC-SHA256 of the payload.

        Args:
            payload: The payload string to sign.

        Returns:
            str: Hex-encoded signature.
        """
        signature = hmac.new(
            self._secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return signature
