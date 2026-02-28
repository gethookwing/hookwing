-- D1 Migration for Webhook Infrastructure
-- Run with: wrangler d1 execute hookwing-db --local --file=./migrations/0001_webhooks.sql

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER,
    last_error TEXT
);

-- Delivery attempts table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    attempted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
