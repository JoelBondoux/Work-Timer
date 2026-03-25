import type { Client } from '@libsql/client';

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_rate', '0')`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_currency', 'USD')`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_min_block_minutes', '15')`,

  `CREATE TABLE IF NOT EXISTS projects (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL UNIQUE,
    billing_rate      REAL,
    currency          TEXT,
    min_block_minutes INTEGER,
    archived          INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id),
    start_time  TEXT NOT NULL DEFAULT (datetime('now')),
    end_time    TEXT,
    status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
    notes       TEXT,
    invoiced_at TEXT,
    invoice_ref TEXT,
    paid_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS pauses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id),
    pause_start TEXT NOT NULL DEFAULT (datetime('now')),
    pause_end   TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)`,
  `CREATE INDEX IF NOT EXISTS idx_pauses_session_id ON pauses(session_id)`,
];

export async function initializeDatabase(client: Client): Promise<void> {
  for (const sql of SCHEMA_SQL) {
    await client.execute(sql);
  }
}
