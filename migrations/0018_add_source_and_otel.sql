-- Add source_id to endpoints for third-party webhook source verification
ALTER TABLE endpoints ADD COLUMN source_id TEXT;

-- Workspace OTel settings for customer-managed observability
CREATE TABLE IF NOT EXISTS workspace_otel_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  otlp_endpoint TEXT NOT NULL,
  otlp_headers TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add trace context columns to events
ALTER TABLE events ADD COLUMN trace_id TEXT;
ALTER TABLE events ADD COLUMN span_id TEXT;

-- Add trace context columns to deliveries
ALTER TABLE deliveries ADD COLUMN trace_id TEXT;
ALTER TABLE deliveries ADD COLUMN span_id TEXT;
