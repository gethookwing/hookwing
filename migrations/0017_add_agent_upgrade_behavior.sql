-- Migration: Add agentUpgradeBehavior column to workspaces
-- For #120: Billing system

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS agent_upgrade_behavior TEXT NOT NULL DEFAULT 'disabled';
