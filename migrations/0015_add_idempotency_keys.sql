-- Migration 0015: Add idempotency keys table for event deduplication
-- 24-hour TTL for idempotency keys

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idem_created ON idempotency_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_idem_endpoint ON idempotency_keys(endpoint_id);