INSERT OR IGNORE INTO luri_music_settings(key, value, updated_at)
VALUES (
  'blog_site_enabled',
  COALESCE((SELECT CASE WHEN value = 'true' THEN 'false' ELSE 'true' END FROM luri_music_settings WHERE key = 'music_only_mode'), 'true'),
  datetime('now')
);

INSERT OR IGNORE INTO luri_music_settings(key, value, updated_at)
VALUES ('blog_posts_enabled', 'true', datetime('now'));

INSERT OR IGNORE INTO luri_music_settings(key, value, updated_at)
VALUES (
  'music_blog_navigation_enabled',
  COALESCE((SELECT CASE WHEN value = 'true' THEN 'false' ELSE 'true' END FROM luri_music_settings WHERE key = 'music_only_mode'), 'true'),
  datetime('now')
);
