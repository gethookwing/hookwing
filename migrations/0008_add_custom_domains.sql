-- Migration: Add Custom Domains table
-- For PROD-155: Custom domains for webhook endpoints

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_workspace
  ON custom_domains(workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_domain
  ON custom_domains(domain);
