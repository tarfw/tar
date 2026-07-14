/**
 * Workspace DB Schema — 6 tables per workspace.
 *
 * form     — workspace-specific overrides (custom prices, settings)
 * matter   — current state (stock, orders, staff, customers)
 * motion   — event log (sales, clock-ins, status changes) — append-only
 * graph    — relationships (links between items)
 * tasks    — user inbox (work assigned to people)
 * memory   — AI memory (customer preferences, patterns)
 *
 * Global DB Schema — 2 tables:
 * catalog    — shared product/service/action templates
 * embeddings — vector embeddings for similarity search
 */

export const SCHEMA_STATEMENTS = [
  // form: workspace-specific overrides (custom prices, settings)
  // Only store differences from g:global.catalog
  `CREATE TABLE IF NOT EXISTS form (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    data TEXT,
    scope TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    owner TEXT,
    time TEXT DEFAULT (datetime('now'))
  )`,
  // matter: current state — what EXISTS right now (stock, orders, staff, customers)
  `CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    form TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    qty REAL DEFAULT 0,
    data TEXT,
    scope TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    owner TEXT,
    time TEXT DEFAULT (datetime('now')),
    updated TEXT
  )`,
  // motion: event log — what HAPPENED (append-only, never update/delete)
  `CREATE TABLE IF NOT EXISTS motion (
    stream TEXT NOT NULL,
    seq INTEGER NOT NULL,
    action INTEGER NOT NULL,
    phase INTEGER,
    delta REAL,
    client_ref TEXT,
    data TEXT,
    time TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (stream, seq)
  )`,
  // graph: relationships — how things connect (belongs_to, created_by, contains, etc.)
  `CREATE TABLE IF NOT EXISTS graph (
    src TEXT NOT NULL,
    rel TEXT NOT NULL,
    tgt TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    data TEXT,
    time TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (src, rel, tgt)
  )`,
  // tasks: user inbox — work assigned to people (pending, in_progress, done)
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  // memory: AI memory — customer preferences, patterns, context
  `CREATE TABLE IF NOT EXISTS memory (
    id TEXT NOT NULL,
    chunk INTEGER NOT NULL DEFAULT 0,
    matter TEXT,
    text TEXT,
    embedding BLOB,
    meta TEXT,
    PRIMARY KEY (id, chunk)
  )`,
  // Indexes for fast queries
  `CREATE INDEX IF NOT EXISTS idx_form_type ON form(type, scope, active)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_type ON matter(type, scope, active, time)`,
  `CREATE INDEX IF NOT EXISTS idx_motion_stream ON motion(stream, seq)`,
  `CREATE INDEX IF NOT EXISTS idx_graph_tgt ON graph(tgt, rel, src)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(assigned_to, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_matter ON memory(matter)`,
];

export const GLOBAL_SCHEMA_STATEMENTS = [
  // catalog: shared product/service/action templates (one row per item)
  `CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT,
    scope TEXT DEFAULT 'global'
  )`,
  // embeddings: vector embeddings for similarity search across catalog
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
