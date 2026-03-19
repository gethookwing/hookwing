-- Add custom_headers column to endpoints table
-- Tier-gated feature: Warbird+ can set custom headers on their endpoints
-- These headers are injected into every webhook delivery to that endpoint

ALTER TABLE endpoints ADD COLUMN custom_headers TEXT;
