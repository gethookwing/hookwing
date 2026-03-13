-- Migration 0005: Add isPlayground flag to workspaces
-- This flag identifies temporary playground sessions for anonymous webhook testing

ALTER TABLE workspaces ADD COLUMN is_playground INTEGER NOT NULL DEFAULT 0;
