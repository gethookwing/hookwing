-- Migration: Add email and password_hash to workspaces
-- For PROD-59: Auth system
-- Note: DEFAULT '' needed for D1 ALTER TABLE with NOT NULL on existing tables

ALTER TABLE workspaces ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE workspaces ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_email ON workspaces(email);
