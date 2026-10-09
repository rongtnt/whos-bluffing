-- Settings and retry-safe solo controls use the same one-hour transient retention.
ALTER TABLE parties ADD COLUMN pack TEXT NOT NULL DEFAULT 'memes';
ALTER TABLE parties ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE play_state ADD COLUMN pack TEXT NOT NULL DEFAULT 'all';
ALTER TABLE play_state ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE play_state ADD COLUMN scope TEXT;
ALTER TABLE play_state ADD COLUMN message_id TEXT;
ALTER TABLE play_state ADD COLUMN last_result TEXT;
ALTER TABLE play_state ADD COLUMN done TEXT;
ALTER TABLE play_state ADD COLUMN lease TEXT;
ALTER TABLE play_state ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0;

CREATE TABLE round_setups (
  id TEXT PRIMARY KEY,
  anon_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  message_id TEXT,
  mode TEXT NOT NULL,
  pack TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  started INTEGER NOT NULL DEFAULT 0,
  start_until INTEGER NOT NULL DEFAULT 0,
  round_id TEXT,
  expires_at INTEGER NOT NULL
);
