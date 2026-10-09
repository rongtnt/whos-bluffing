-- Short-lived native rounds. No raw user/channel IDs or response URLs.
CREATE TABLE play_sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('solo', 'party')),
  scope TEXT NOT NULL,
  owner TEXT NOT NULL,
  pack TEXT NOT NULL DEFAULT 'memes',
  difficulty TEXT NOT NULL DEFAULT 'normal',
  round_id TEXT,
  items TEXT,
  lobby_ts TEXT,
  next_id TEXT,
  parent_round TEXT,
  expires_at INTEGER NOT NULL,
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE play_players (
  session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seat INTEGER NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  feedback TEXT,
  done TEXT,
  updated_at INTEGER NOT NULL,
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  shared INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, anon_id)
);
CREATE INDEX play_expiry ON play_sessions(expires_at);
