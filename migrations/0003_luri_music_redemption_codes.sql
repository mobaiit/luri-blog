ALTER TABLE luri_music_codes ADD COLUMN duration_type TEXT NOT NULL DEFAULT 'day';
ALTER TABLE luri_music_codes ADD COLUMN duration_value INTEGER NOT NULL DEFAULT 1;
ALTER TABLE luri_music_codes ADD COLUMN code_display TEXT NOT NULL DEFAULT '';
UPDATE luri_music_codes SET duration_value = duration_days WHERE code_display = '';
CREATE INDEX IF NOT EXISTS idx_luri_music_codes_redeemed_by ON luri_music_codes(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_luri_music_codes_created_at ON luri_music_codes(created_at);
