CREATE TABLE IF NOT EXISTS user_databases (
  user_id TEXT PRIMARY KEY,
  turso_db_name TEXT NOT NULL,
  turso_url TEXT NOT NULL,
  turso_auth_token TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
