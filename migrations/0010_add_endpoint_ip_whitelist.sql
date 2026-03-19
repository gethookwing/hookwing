-- Migration: Add ip_whitelist column to endpoints table
-- For PROD-157: IP whitelist middleware for endpoint delivery

ALTER TABLE endpoints ADD COLUMN ip_whitelist TEXT;
