CREATE TABLE IF NOT EXISTS diagnostic_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  conversation_id TEXT,
  level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error')),
  event TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_created ON diagnostic_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_request ON diagnostic_events(request_id, created_at DESC);
