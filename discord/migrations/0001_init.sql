-- HowSure for Discord. Stores only: server id, chosen channel, post hour, reveal delay, roast flag, the bot's own
-- daily posts (message id and the day's question as the API served it), and per-day answers keyed by a salted hash
-- of the member id. No member messages, names or raw member ids.

CREATE TABLE installs (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,                          -- NULL until /howsure setup, or after the channel stops accepting posts
  post_hour_utc INTEGER NOT NULL DEFAULT 14,
  reveal_delay_h INTEGER NOT NULL DEFAULT 8,
  roast INTEGER NOT NULL DEFAULT 0,         -- 1 = the reveal names the biggest bluffer
  installed_at TEXT NOT NULL,               -- first time the server used a command
  last_recap TEXT                           -- UTC date of the last weekly recap
);

-- One daily question per server per UTC day. message_id is NULL while the post is in flight.
CREATE TABLE posts (
  guild_id TEXT NOT NULL,
  date TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  reveal_at TEXT NOT NULL,                  -- ISO time of the hourly tick that reveals it
  revealed INTEGER NOT NULL DEFAULT 0,
  -- The day's question as the API served it (the same for every server). Kept so a late reveal can still be drawn:
  -- daily-question only serves today and yesterday. HowSure's own text, never member messages.
  prompt TEXT NOT NULL,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  PRIMARY KEY (guild_id, date)
);
CREATE INDEX posts_due ON posts (revealed, reveal_at);

-- One row per member per daily question; a change of mind before the reveal replaces it.
-- anon_id = hex sha256("<server id>:<member id>:<SALT>"), computed in src/api.js; the member id itself is never stored.
CREATE TABLE answers (
  guild_id TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  date TEXT NOT NULL,
  choice INTEGER NOT NULL,                  -- 0 = A, 1 = B
  conf INTEGER NOT NULL,                    -- 50, 60, ... 100
  points INTEGER NOT NULL,
  correct INTEGER NOT NULL,                 -- needed for calibration: 50% scores 0 points right or wrong
  PRIMARY KEY (guild_id, date, anon_id)
);

-- The member's current /howsure play round (one per member per server).
CREATE TABLE play_state (
  anon_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  items TEXT NOT NULL,                      -- the round's questions as JSON: id, prompt, a, b
  step INTEGER NOT NULL,                    -- questions answered so far (11 while the score is being fetched)
  total INTEGER NOT NULL,
  updated_at INTEGER NOT NULL               -- ms since epoch when the current question was shown
);
