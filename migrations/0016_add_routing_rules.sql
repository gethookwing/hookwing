-- Migration: 0016_add_routing_rules.sql
-- Event Routing & Filtering Layer
-- Created: 2026-03-25

CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'deliver',
  action_endpoint_id TEXT,
  action_transform TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_rr_workspace ON routing_rules(workspace_id);
CREATE INDEX idx_rr_priority ON routing_rules(priority);
