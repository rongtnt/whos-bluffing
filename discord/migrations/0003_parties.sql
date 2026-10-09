-- Chat-scoped, one-hour parties. Names are stored only after explicit Join consent.
-- No raw user/channel ids or interaction tokens.
CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  message_id TEXT,
  round_id TEXT,
  items TEXT,
  expires_at INTEGER NOT NULL,
  next_id TEXT,
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX parties_expiry ON parties(expires_at);

CREATE TABLE party_players (
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  seat INTEGER NOT NULL,
  name TEXT NOT NULL,
  message_id TEXT,
  step INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  last_result TEXT,
  done TEXT,
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(party_id, anon_id),
  UNIQUE(party_id, seat)
);
