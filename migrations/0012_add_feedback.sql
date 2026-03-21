-- Migration: 0012_add_feedback.sql
-- Description: Add feedback table for user feedback collection
-- Date: 2026-03-21

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  source TEXT NOT NULL DEFAULT 'api',
  category TEXT NOT NULL DEFAULT 'general',
  rating INTEGER,
  message TEXT,
  metadata TEXT,
  context TEXT,
  page_url TEXT,
  user_agent TEXT,
  account_tier TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX idx_feedback_workspace ON feedback(workspace_id);
CREATE INDEX idx_feedback_category ON feedback(category);
CREATE INDEX idx_feedback_created ON feedback(created_at);
