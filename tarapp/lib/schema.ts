export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS form (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    owner TEXT,
    title TEXT,
    public INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS memory (
    form TEXT PRIMARY KEY,
    vector BLOB
  )`,
  `CREATE TABLE IF NOT EXISTS bond (
    src TEXT NOT NULL,
    tgt TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    active INTEGER DEFAULT 1,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, tgt, type)
  )`,
  `CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    form TEXT NOT NULL,
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
    client_ref TEXT,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stream, seq)
  )`,
];
