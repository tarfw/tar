import { type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

export async function migrateDb(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  // Wipe old tables + data (v1 had seed data we no longer want)
  if (currentVersion === 1) {
    await db.execAsync(`
      DROP TABLE IF EXISTS form;
      DROP TABLE IF EXISTS matter;
      DROP TABLE IF EXISTS motion;
      DROP TABLE IF EXISTS graph;
    `);
    currentVersion = 0;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS form (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'p',
        data TEXT NOT NULL DEFAULT '{}',
        time TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS matter (
        id TEXT PRIMARY KEY NOT NULL,
        form TEXT NOT NULL REFERENCES form(id),
        type TEXT NOT NULL,
        qty REAL DEFAULT 0,
        value REAL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        time TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS motion (
        stream TEXT NOT NULL,
        seq INTEGER NOT NULL,
        action INTEGER NOT NULL,
        phase INTEGER NOT NULL DEFAULT 0,
        delta REAL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        time TEXT NOT NULL,
        PRIMARY KEY (stream, seq)
      );

      CREATE TABLE IF NOT EXISTS graph (
        src TEXT NOT NULL,
        tgt TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (src, tgt, type)
      );

      CREATE INDEX IF NOT EXISTS idx_form_type ON form(type);
      CREATE INDEX IF NOT EXISTS idx_form_scope ON form(scope);
      CREATE INDEX IF NOT EXISTS idx_matter_form ON matter(form);
      CREATE INDEX IF NOT EXISTS idx_matter_type ON matter(type);
      CREATE INDEX IF NOT EXISTS idx_motion_stream ON motion(stream);
      CREATE INDEX IF NOT EXISTS idx_motion_action ON motion(action);
      CREATE INDEX IF NOT EXISTS idx_graph_src ON graph(src);
      CREATE INDEX IF NOT EXISTS idx_graph_tgt ON graph(tgt);
    `);

    currentVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
