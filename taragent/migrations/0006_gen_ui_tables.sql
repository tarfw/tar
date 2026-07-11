-- Gen UI: UI revisions storage
CREATE TABLE IF NOT EXISTS ui_revisions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'native',
  revision_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ui_revisions_workspace ON ui_revisions(workspace_id, target, status);

-- Gen UI: User preferences memory
CREATE TABLE IF NOT EXISTS ui_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_ui_memory_lookup ON ui_memory(user_id, workspace_id);
