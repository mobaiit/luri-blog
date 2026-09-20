CREATE TABLE IF NOT EXISTS luri_music_email_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(email, purpose)
);

CREATE INDEX IF NOT EXISTS idx_luri_music_email_codes_expires_at
  ON luri_music_email_codes(expires_at);
