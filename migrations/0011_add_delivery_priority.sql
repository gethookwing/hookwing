-- Migration: 0011_add_delivery_priority.sql
-- Description: Add priority column to deliveries table for tier-based priority processing
-- Date: 2026-03-19

ALTER TABLE deliveries ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
