ALTER TABLE luri_music_users ADD COLUMN disabled_at TEXT;
ALTER TABLE luri_music_users ADD COLUMN last_login_at TEXT;
UPDATE luri_music_users SET last_login_at = COALESCE(updated_at, created_at) WHERE last_login_at IS NULL;

CREATE TABLE IF NOT EXISTS luri_music_admin_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO luri_music_admin_accounts(id, username, password_hash, created_at, updated_at)
VALUES (
  'initial-luri-admin',
  'luri',
  'v2:10000:6d297803372170d2b7674cea39f8a26b33744cfae9fd37ddbedd5dac853f7d5e:cae1f454ade339a404ae6941f54c9e44fa8683506a0c9332672d4fb4dde76937',
  datetime('now'),
  datetime('now')
);

ALTER TABLE luri_music_admin_sessions ADD COLUMN admin_account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_luri_music_users_last_login_at ON luri_music_users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_luri_music_admin_sessions_account ON luri_music_admin_sessions(admin_account_id);
