-- OAuth Accounts - social login identities
-- Added to support GitHub/Google OAuth authentication

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_accounts_workspace_id_idx ON oauth_accounts(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_accounts_provider_account_idx ON oauth_accounts(provider, provider_account_id);
