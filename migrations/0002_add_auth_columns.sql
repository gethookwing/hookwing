-- Migration: Add email and password_hash to workspaces
-- For PROD-59: Auth system

ALTER TABLE workspaces ADD COLUMN email TEXT NOT NULL UNIQUE;
ALTER TABLE workspaces ADD COLUMN password_hash TEXT NOT NULL;
