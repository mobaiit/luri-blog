# Luri Music module deployment

The module is intentionally independent from the blog. It needs a D1 binding named `LURI_MUSIC_DB` and three Worker secrets: `ADMIN_PASSWORD`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_SITE_KEY`.

1. Create a D1 database in Cloudflare, then add its database ID to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "LURI_MUSIC_DB"
database_name = "luri-music"
database_id = "replace-with-the-new-d1-id"
```

2. Apply `migrations/0001_luri_music.sql` to that database.
3. Create a Turnstile widget for the production domain and set the site key in the frontend build environment as `VITE_TURNSTILE_SITE_KEY`.
4. Store the secret key and admin password using `wrangler secret put`; never commit them or place them in frontend code.

Until the binding is present, the existing blog music page remains available and the Luri Music API returns a configuration error rather than accepting unprotected accounts or codes.
