-- Who's Bluffing for Slack. Stores only: team id, bot token, channel id, post hour, post timestamps,
-- and per-day hits keyed by the salted member hash. No message text, names, emails or raw member ids.

CREATE TABLE installs (
  team_id TEXT PRIMARY KEY,
  bot_token TEXT NOT NULL,
  channel_id TEXT,                    -- NULL until /bluff setup
  post_hour_utc INTEGER NOT NULL,
  installed_at TEXT NOT NULL
);

-- Today's post in the chosen channel. ts is NULL while the cron's claim is in flight.
CREATE TABLE posts (
  team_id TEXT NOT NULL,
  date TEXT NOT NULL,
  ts TEXT,
  PRIMARY KEY (team_id, date)
);

-- One row per completed play. anon_id = sha256(team_id:user_id:SALT).
CREATE TABLE scores (
  team_id TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (team_id, date, anon_id)
);
