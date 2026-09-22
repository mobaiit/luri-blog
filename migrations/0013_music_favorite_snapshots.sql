CREATE TABLE IF NOT EXISTS luri_music_favorite_snapshots (
  user_id TEXT NOT NULL,
  provider_config_id TEXT NOT NULL,
  favorites_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, provider_config_id),
  FOREIGN KEY(user_id) REFERENCES luri_music_users(id) ON DELETE CASCADE,
  FOREIGN KEY(provider_config_id) REFERENCES luri_music_provider_configs(id) ON DELETE CASCADE
);
