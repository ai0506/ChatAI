CREATE TABLE IF NOT EXISTS api_key_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_key_profiles_owner ON api_key_profiles(owner_id, is_active DESC, updated_at DESC);
