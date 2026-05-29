```sql
-- UNIVERSAL TAR COMMERCE + AGENT SYSTEM
-- The 5 Tables of Physics

-- ==========================================
-- GLOBAL / HOT DATA DB (Read-heavy / System)
-- ==========================================

-- 1. MATTER
-- The fundamental substance and global catalog.
CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    type TEXT,
    scope TEXT,
    owner TEXT,
    title TEXT,
    public INTEGER DEFAULT 0,
    data TEXT,
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. MEMORY
-- Semantic memory for AI reasoning.
CREATE TABLE IF NOT EXISTS memory (
    matter TEXT PRIMARY KEY,
    vector F32_BLOB(384)
);

-- 4. RELATION
-- The structural network between Matter.
CREATE TABLE IF NOT EXISTS relation (
    src TEXT NOT NULL,
    tgt TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, tgt, type)
);

-- Global Indexes
CREATE INDEX IF NOT EXISTS idx_matter_code ON matter(code);
CREATE INDEX IF NOT EXISTS idx_matter_public ON matter(public, type);
CREATE INDEX IF NOT EXISTS idx_relation_tgt ON relation(tgt, type);
CREATE INDEX IF NOT EXISTS idx_relation_type ON relation(type);


-- ==========================================
-- COLLAB / LOCAL DB (Write-heavy / Edge)
-- ==========================================

-- 2. MASS
-- Physical realization, quantity, price, location.
CREATE TABLE IF NOT EXISTS mass (
    id TEXT PRIMARY KEY,
    matter TEXT NOT NULL,
    type TEXT,
    scope TEXT,
    qty REAL,
    value REAL,
    active INTEGER DEFAULT 1,
    geo TEXT,
    start TIMESTAMPTZ,
    end TIMESTAMPTZ,
    data TEXT,
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. MOTION
-- Kinetic ledger, append-only record of all actions.
CREATE TABLE IF NOT EXISTS motion (
    id TEXT PRIMARY KEY,
    stream TEXT NOT NULL,
    seq INTEGER NOT NULL,
    action INTEGER NOT NULL,
    status TEXT,
    delta REAL,
    scope TEXT,
    data TEXT,
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stream, seq)
);

-- Collab Indexes
CREATE INDEX IF NOT EXISTS idx_mass_matter ON mass(matter);
CREATE INDEX IF NOT EXISTS idx_mass_geo ON mass(geo);
CREATE INDEX IF NOT EXISTS idx_mass_scope_type ON mass(scope, type);
CREATE INDEX IF NOT EXISTS idx_motion_stream ON motion(stream, time);
CREATE INDEX IF NOT EXISTS idx_motion_scope ON motion(scope);
```
