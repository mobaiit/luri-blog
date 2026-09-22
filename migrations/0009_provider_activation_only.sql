UPDATE luri_music_preferences
SET active_provider_config_id = NULL,
    provider_revision = provider_revision + 1,
    updated_at = datetime('now');

DELETE FROM luri_music_provider_configs;
