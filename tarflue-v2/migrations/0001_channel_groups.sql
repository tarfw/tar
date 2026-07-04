-- D1 migration: channel_groups table for channel routing
-- Each Telegram/Slack/Discord group maps to a workspace scope

CREATE TABLE IF NOT EXISTS channel_groups (
  chat_id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,
  name TEXT,
  platform TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_channel_groups_scope ON channel_groups(scope);
