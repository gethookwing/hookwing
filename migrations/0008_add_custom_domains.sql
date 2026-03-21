-- Migration: Add custom_domains table
-- For PROD-155: Custom domains feature

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS custom_domains_workspace_idx
  ON custom_domains(workspace_id);

CREATE INDEX IF NOT EXISTS custom_domains_domain_idx
  ON custom_domains(domain);
