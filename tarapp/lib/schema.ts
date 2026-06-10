export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    owner TEXT,
    title TEXT,
    public INTEGER DEFAULT 0,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS memory (
    matter TEXT PRIMARY KEY,
    vector BLOB
  )`,
  `CREATE TABLE IF NOT EXISTS relation (
    src TEXT NOT NULL,
    tgt TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, tgt, type)
  )`,
  `CREATE TABLE IF NOT EXISTS mass (
    id TEXT PRIMARY KEY,
    matter TEXT NOT NULL,
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
  )`,
  `CREATE TABLE IF NOT EXISTS motion (
    stream TEXT NOT NULL,
    seq INTEGER NOT NULL,
    action INTEGER NOT NULL,
    phase INTEGER,
    delta REAL,
    data TEXT,
    PRIMARY KEY (stream, seq)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matter_code ON matter(code)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_public ON matter(public, type)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_scope_type ON matter(scope, type)`,
  `CREATE INDEX IF NOT EXISTS idx_relation_tgt ON relation(tgt, type)`,
  `CREATE INDEX IF NOT EXISTS idx_relation_type ON relation(type)`,
  `CREATE INDEX IF NOT EXISTS idx_mass_matter ON mass(matter)`,
  `CREATE INDEX IF NOT EXISTS idx_mass_geo ON mass(geo)`,
  `CREATE INDEX IF NOT EXISTS idx_mass_scope_type ON mass(scope, type)`
];
