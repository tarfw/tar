/**
 * Workspace DB Schema — 4 tables per workspace.
 *
 * matter   — current state (stock, orders, staff, customers, settings)
 * motion   — selective user-visible event log
 * graph    — relationships (links between items)
 * inbox    — actionable tasks/notifications requiring human attention
 */

export const SCHEMA_STATEMENTS = [
  // matter: current state — what EXISTS right now (stock, orders, staff, customers, settings)
  `CREATE TABLE IF NOT EXISTS matter (
    id      TEXT PRIMARY KEY,
    type    TEXT NOT NULL,
    title   TEXT NOT NULL,
    value   REAL,
    status  TEXT DEFAULT 'active',
    data    TEXT,
    file    TEXT,
    role    TEXT,
    scope   TEXT NOT NULL,
    at      INTEGER DEFAULT (unixepoch()),
    updated INTEGER DEFAULT (unixepoch())
  )`,

  // motion: selective user-visible event log — what HAPPENED
  `CREATE TABLE IF NOT EXISTS motion (
    id    TEXT PRIMARY KEY,
    type  TEXT NOT NULL,
    ref   TEXT,
    data  TEXT,
    by    TEXT,
    at    INTEGER DEFAULT (unixepoch()),
    scope TEXT NOT NULL
  )`,

  // graph: relationships — how things connect
  `CREATE TABLE IF NOT EXISTS graph (
    src   TEXT NOT NULL,
    rel   TEXT NOT NULL,
    tgt   TEXT NOT NULL,
    scope TEXT NOT NULL,
    time  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (src, rel, tgt)
  )`,

  // inbox: actionable tasks/notifications requiring human attention
  `CREATE TABLE IF NOT EXISTS inbox (
    id     TEXT PRIMARY KEY,
    scope  TEXT NOT NULL,
    type   TEXT NOT NULL,
    title  TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    ref    TEXT,
    data   TEXT,
    due    INTEGER,
    at     INTEGER DEFAULT (unixepoch())
  )`,

  // Indexes for optimal query performance
  `CREATE INDEX IF NOT EXISTS idx_matter_scope_type      ON matter(scope, type)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_scope_type_role ON matter(scope, type, role)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_scope_status  ON matter(scope, status)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_scope_updated ON matter(scope, updated)`,
  `CREATE INDEX IF NOT EXISTS idx_motion_scope_type    ON motion(scope, type)`,
  `CREATE INDEX IF NOT EXISTS idx_motion_ref           ON motion(ref)`,
  `CREATE INDEX IF NOT EXISTS idx_inbox_scope_status   ON inbox(scope, status)`,
  `CREATE INDEX IF NOT EXISTS idx_inbox_due            ON inbox(due)`,
  `CREATE INDEX IF NOT EXISTS idx_graph_src            ON graph(src)`,
  `CREATE INDEX IF NOT EXISTS idx_graph_tgt            ON graph(tgt)`,
];

