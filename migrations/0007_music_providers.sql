CREATE TABLE IF NOT EXISTS luri_music_provider_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  protocol_version TEXT NOT NULL DEFAULT '1.0',
  auth_type TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_key_version INTEGER NOT NULL DEFAULT 1,
  cached_status TEXT NOT NULL DEFAULT 'unknown',
  cached_expires_at TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES luri_music_users(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider_url, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_luri_music_provider_user ON luri_music_provider_configs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS luri_music_preferences (
  user_id TEXT PRIMARY KEY,
  active_provider_config_id TEXT,
  provider_revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES luri_music_users(id) ON DELETE CASCADE,
  FOREIGN KEY(active_provider_config_id) REFERENCES luri_music_provider_configs(id) ON DELETE SET NULL
);
