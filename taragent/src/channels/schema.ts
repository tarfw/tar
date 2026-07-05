/**
 * D1 schema for channel routing and workspace subdomains.
 */

export const CHANNEL_SCHEMA = `
CREATE TABLE IF NOT EXISTS channels (
  chat_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  name TEXT,
  platform TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_channel_scope ON channels(scope);
CREATE INDEX IF NOT EXISTS idx_channel_platform ON channels(platform);

CREATE TABLE IF NOT EXISTS workspaces (
  subdomain TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  name TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_scope ON workspaces(scope);
`;
