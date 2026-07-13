export const SCHEMA_STATEMENTS = [
  // Workspace tables
  `CREATE TABLE IF NOT EXISTS form (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    data TEXT,
    scope TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    data TEXT,
    scope TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS motion (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    scope TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS graph (
    src TEXT NOT NULL,
    rel TEXT NOT NULL,
    tgt TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    time TEXT,
    PRIMARY KEY (src, rel, tgt)
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY,
    type TEXT,
    data TEXT,
    embedding BLOB,
    scope TEXT NOT NULL
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_form_type ON form(type, scope)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_type ON matter(type, scope)`,
  `CREATE INDEX IF NOT EXISTS idx_motion_type ON motion(type, scope)`,
  `CREATE INDEX IF NOT EXISTS idx_motion_created ON motion(created_at, scope)`,
  `CREATE INDEX IF NOT EXISTS idx_graph_tgt ON graph(tgt, rel, src)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(assigned_to, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id, status)`,
];

export const GLOBAL_SCHEMA_STATEMENTS = [
  // Global catalog tables
  `CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT,
    scope TEXT DEFAULT 'global'
  )`,
  `CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    type TEXT,
    data TEXT,
    embedding BLOB,
    scope TEXT DEFAULT 'global'
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog(type)`,
];
