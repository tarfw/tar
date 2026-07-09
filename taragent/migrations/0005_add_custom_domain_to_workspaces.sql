-- Add custom_domain column to workspaces for SaaS custom domains
ALTER TABLE workspaces ADD COLUMN custom_domain TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_custom_domain ON workspaces(custom_domain);
