-- Migration: 0013_add_password_reset_tokens.sql
-- Description: Add password_reset_tokens table for password reset flow
-- Date: 2026-03-24

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_prt_workspace ON password_reset_tokens(workspace_id);
CREATE INDEX idx_prt_token ON password_reset_tokens(token_hash);