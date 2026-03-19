-- Migration: Add Dead Letter Queue table
-- For PROD-154: Dead Letter Queue feature

CREATE TABLE IF NOT EXISTS dead_letter_items (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  replayed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS dlq_workspace_idx
  ON dead_letter_items(workspace_id);

CREATE INDEX IF NOT EXISTS dlq_status_idx
  ON dead_letter_items(status);
