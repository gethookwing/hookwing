-- Migration 0004: Rate limits table for sliding window rate limiting
-- This table stores rate limit counters per workspace per time window

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
