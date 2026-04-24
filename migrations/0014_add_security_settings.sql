-- Migration 0014: Add security settings (CAPTCHA, TOTP 2FA)
-- Both features are OFF BY DEFAULT

ALTER TABLE workspaces ADD COLUMN captcha_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN totp_secret TEXT;
ALTER TABLE workspaces ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
