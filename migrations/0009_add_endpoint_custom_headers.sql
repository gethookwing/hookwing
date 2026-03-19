-- Migration: Add custom_headers column to endpoints table
-- For PROD-156: Custom headers on endpoint delivery

ALTER TABLE endpoints ADD COLUMN custom_headers TEXT;
