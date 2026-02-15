import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.BEWRITTEN_DB_PATH || path.join(process.cwd(), 'server', 'bewritten.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      locked INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_email, expires_at DESC);

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_user_id),
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      return_to TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stories_user_updated ON stories(user_email, updated_at DESC);

    CREATE TABLE IF NOT EXISTS story_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_story_versions_story ON story_versions(story_id, version DESC);

    CREATE TABLE IF NOT EXISTS ai_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id TEXT,
      actor_email TEXT,
      task TEXT NOT NULL,
      model TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_email TEXT PRIMARY KEY,
      ai_target TEXT NOT NULL DEFAULT 'gemini',
      ai_api_key TEXT,
      ai_model TEXT,
      ai_base_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    );
  `);

  const userCols = db.prepare('PRAGMA table_info(users)').all();
  const userColNames = new Set(userCols.map((c) => c.name));
  if (!userColNames.has('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  if (!userColNames.has('locked')) db.exec('ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0');
  if (!userColNames.has('must_change_password')) db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');

  const storyCols = db.prepare('PRAGMA table_info(stories)').all();
  const storyColNames = new Set(storyCols.map((c) => c.name));
  if (!storyColNames.has('payload_hash')) db.exec('ALTER TABLE stories ADD COLUMN payload_hash TEXT');
  if (!storyColNames.has('version')) db.exec('ALTER TABLE stories ADD COLUMN version INTEGER NOT NULL DEFAULT 1');

  const registrationSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'registration_enabled'").get();
  if (!registrationSetting) {
    db.prepare(
      "INSERT INTO system_settings (key, value, updated_at) VALUES ('registration_enabled', 'true', datetime('now'))"
    ).run();
  }
}

export function getDb() {
  return db;
}
