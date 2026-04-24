-- Migration 0014: Add security settings (CAPTCHA, TOTP 2FA)
-- Both features are OFF BY DEFAULT

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS captcha_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS totp_enabled INTEGER NOT NULL DEFAULT 0;
