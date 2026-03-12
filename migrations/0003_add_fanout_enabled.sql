-- Migration: Add fanout_enabled to endpoints
-- For PROD-65: Fan-out delivery

ALTER TABLE endpoints ADD COLUMN fanout_enabled INTEGER NOT NULL DEFAULT(1);
