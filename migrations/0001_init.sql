CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated ON conversations(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  UNIQUE(conversation_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence ON messages(conversation_id, sequence);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_connections (
  owner_id TEXT PRIMARY KEY,
  encrypted_refresh_token TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_oauth_attempts (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
