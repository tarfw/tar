-- Rename tables to minimal single-word names
ALTER TABLE channel_groups RENAME TO channels;
ALTER TABLE user_databases RENAME TO users;

-- Create workspaces table (subdomain -> scope mapping for site routing)
CREATE TABLE IF NOT EXISTS workspaces (
  subdomain TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_scope ON workspaces(scope);
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
