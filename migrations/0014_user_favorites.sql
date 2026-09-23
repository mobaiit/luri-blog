ALTER TABLE luri_music_users ADD COLUMN favorites_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE luri_music_users ADD COLUMN favorites_updated_at TEXT;

UPDATE luri_music_users
SET favorites_json = COALESCE(
  (
    SELECT snapshots.favorites_json
    FROM luri_music_favorite_snapshots snapshots
    LEFT JOIN luri_music_preferences preferences ON preferences.user_id = snapshots.user_id
    WHERE snapshots.user_id = luri_music_users.id
    ORDER BY CASE WHEN snapshots.provider_config_id = preferences.active_provider_config_id THEN 0 ELSE 1 END,
             snapshots.updated_at DESC
    LIMIT 1
  ),
  '[]'
),
favorites_updated_at = (
  SELECT snapshots.updated_at
  FROM luri_music_favorite_snapshots snapshots
  LEFT JOIN luri_music_preferences preferences ON preferences.user_id = snapshots.user_id
  WHERE snapshots.user_id = luri_music_users.id
  ORDER BY CASE WHEN snapshots.provider_config_id = preferences.active_provider_config_id THEN 0 ELSE 1 END,
           snapshots.updated_at DESC
  LIMIT 1
);
