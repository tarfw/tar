export const DO_SCHEMA = `
  CREATE TABLE IF NOT EXISTS form (
    id TEXT PRIMARY KEY,
    code TEXT,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    owner TEXT,
    title TEXT,
    public INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    form TEXT,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    qty REAL,
    value REAL,
    active INTEGER DEFAULT 1,
    variant INTEGER,
    mark INTEGER DEFAULT 0,
    geo TEXT,
    start TEXT,
    end TEXT,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS motion (
    stream TEXT NOT NULL,
    seq INTEGER NOT NULL,
    action INTEGER NOT NULL,
    phase INTEGER,
    delta REAL,
    client_ref TEXT,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stream, seq)
  );

  CREATE TABLE IF NOT EXISTS bond (
    src TEXT NOT NULL,
    tgt TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    active INTEGER DEFAULT 1,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, tgt, type)
  );

  CREATE INDEX IF NOT EXISTS idx_form_code ON form(code);
  CREATE INDEX IF NOT EXISTS idx_form_scope_type ON form(scope, type);
  CREATE INDEX IF NOT EXISTS idx_matter_form ON matter(form);
  CREATE INDEX IF NOT EXISTS idx_matter_scope_type ON matter(scope, type);
  CREATE INDEX IF NOT EXISTS idx_motion_stream ON motion(stream);
  CREATE INDEX IF NOT EXISTS idx_bond_tgt ON bond(tgt, type);
`;
