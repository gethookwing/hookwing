"""Tests for webhook verification."""

import hashlib
import hmac
import json
import time

import pytest

from hookwing import (
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    EVENT_TYPE_HEADER,
    Webhook,
    WebhookVerificationError,
)


SECRET = "whsec_testSecretForUnitTests1234567890"
PAYLOAD = json.dumps({
    "id": "evt_01",
    "type": "order.created",
    "data": {"orderId": "ord_123"},
})


def sign_payload(payload: str, secret: str) -> str:
    """Sign a payload with HMAC-SHA256."""
    raw = secret[6:] if secret.startswith("whsec_") else secret
    signature = hmac.new(
        raw.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={signature}"


class TestWebhookConstructor:
    """Tests for Webhook constructor."""

    def test_should_throw_if_secret_is_empty(self):
        with pytest.raises(ValueError, match="secret is required"):
            Webhook("")

    def test_should_accept_secret_with_whsec_prefix(self):
        # Should not raise
        wh = Webhook("whsec_abc123")
        assert wh._secret == "abc123"

    def test_should_accept_secret_without_prefix(self):
        wh = Webhook("rawsecret123")
        assert wh._secret == "rawsecret123"

    def test_should_accept_custom_tolerance(self):
        wh = Webhook(SECRET, tolerance_ms=60000)
        assert wh._tolerance_ms == 60000


class TestWebhookVerifySignature:
    """Tests for verify_signature method."""

    @pytest.mark.asyncio
    async def test_should_return_true_for_valid_signature(self):
        wh = Webhook(SECRET)
        sig = sign_payload(PAYLOAD, SECRET)
        result = await wh.verify_signature(PAYLOAD, sig)
        assert result is True

    @pytest.mark.asyncio
    async def test_should_return_false_for_invalid_signature(self):
        wh = Webhook(SECRET)
        result = await wh.verify_signature(PAYLOAD, "sha256=deadbeef")
        assert result is False

    @pytest.mark.asyncio
    async def test_should_return_false_for_missing_sha256_prefix(self):
        wh = Webhook(SECRET)
        sig = sign_payload(PAYLOAD, SECRET)
        # Remove 'sha256=' prefix
        result = await wh.verify_signature(PAYLOAD, sig[7:])
        assert result is False

    @pytest.mark.asyncio
    async def test_should_return_false_if_payload_modified(self):
        wh = Webhook(SECRET)
        sig = sign_payload(PAYLOAD, SECRET)
        result = await wh.verify_signature(f"{PAYLOAD} ", sig)
        assert result is False

    @pytest.mark.asyncio
    async def test_should_return_false_for_wrong_secret(self):
        wh = Webhook("whsec_wrongSecret12345678901234567890")
        sig = sign_payload(PAYLOAD, SECRET)
        result = await wh.verify_signature(PAYLOAD, sig)
        assert result is False


class TestWebhookVerify:
    """Tests for verify method."""

    @pytest.mark.asyncio
    async def test_should_throw_on_missing_signature_header(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        with pytest.raises(WebhookVerificationError, match="Missing X-Hookwing-Signature"):
            await wh.verify(PAYLOAD, {"signature": None, "timestamp": str(int(time.time() * 1000))})

    @pytest.mark.asyncio
    async def test_should_throw_on_missing_timestamp_header(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        sig = sign_payload(PAYLOAD, SECRET)
        with pytest.raises(WebhookVerificationError, match="Missing X-Hookwing-Timestamp"):
            await wh.verify(PAYLOAD, {"signature": sig, "timestamp": None})

    @pytest.mark.asyncio
    async def test_should_throw_on_invalid_timestamp(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        sig = sign_payload(PAYLOAD, SECRET)
        with pytest.raises(WebhookVerificationError, match="Invalid X-Hookwing-Timestamp"):
            await wh.verify(PAYLOAD, {"signature": sig, "timestamp": "not-a-number"})

    @pytest.mark.asyncio
    async def test_should_throw_on_stale_timestamp(self):
        wh = Webhook(SECRET, tolerance_ms=1000)  # 1 second tolerance
        sig = sign_payload(PAYLOAD, SECRET)
        old_ts = str(int(time.time() * 1000) - 10000)  # 10 seconds ago
        with pytest.raises(WebhookVerificationError, match="timestamp too old"):
            await wh.verify(PAYLOAD, {"signature": sig, "timestamp": old_ts})

    @pytest.mark.asyncio
    async def test_should_succeed_with_valid_signature_and_fresh_timestamp(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        sig = sign_payload(PAYLOAD, SECRET)
        ts = str(int(time.time() * 1000))
        event = await wh.verify(PAYLOAD, {"signature": sig, "timestamp": ts})
        assert event.type == "order.created"
        assert event.id == "evt_01"

    @pytest.mark.asyncio
    async def test_should_throw_on_bad_signature(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        with pytest.raises(WebhookVerificationError, match="signature verification failed"):
            await wh.verify(PAYLOAD, {"signature": "sha256=badbad", "timestamp": str(int(time.time() * 1000))})

    @pytest.mark.asyncio
    async def test_should_throw_on_invalid_json_payload(self):
        wh = Webhook(SECRET, tolerance_ms=999999999)
        bad_payload = "not json"
        sig = sign_payload(bad_payload, SECRET)
        with pytest.raises(WebhookVerificationError, match="not valid JSON"):
            await wh.verify(bad_payload, {"signature": sig, "timestamp": str(int(time.time() * 1000))})


class TestHeaderConstants:
    """Tests for header constants."""

    def test_should_export_correct_header_names(self):
        assert SIGNATURE_HEADER == "x-hookwing-signature"
        assert TIMESTAMP_HEADER == "x-hookwing-timestamp"
        assert EVENT_TYPE_HEADER == "x-event-type"
