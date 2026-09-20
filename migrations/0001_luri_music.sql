CREATE TABLE IF NOT EXISTS luri_music_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS luri_music_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES luri_music_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS luri_music_admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS luri_music_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_by TEXT,
  redeemed_at TEXT,
  disabled_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(redeemed_by) REFERENCES luri_music_users(id)
);
CREATE TABLE IF NOT EXISTS luri_music_entitlements (
  user_id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES luri_music_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS luri_music_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO luri_music_settings(key, value, updated_at) VALUES ('music_enabled', 'true', datetime('now'));
