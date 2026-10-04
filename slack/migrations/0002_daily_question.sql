-- Who's Bluffing for Slack v0.2: one question a day in the channel, answered with a confidence, revealed later.
-- Additive only. The v0.1 table `scores` is no longer read or written (see NOTES.md).

ALTER TABLE installs ADD COLUMN roast INTEGER NOT NULL DEFAULT 0;  -- 1 = the reveal names the biggest bluffer
ALTER TABLE installs ADD COLUMN recap_week TEXT;                   -- Monday (UTC date) of the last weekly recap

ALTER TABLE posts ADD COLUMN channel_id TEXT;                      -- where the post is, so the reveal can edit it
ALTER TABLE posts ADD COLUMN revealed INTEGER NOT NULL DEFAULT 0;
-- The day's question as the API served it, kept for the reveal (daily-question only serves today and yesterday).
-- The app's own text, never member messages.
ALTER TABLE posts ADD COLUMN item_id TEXT;
ALTER TABLE posts ADD COLUMN prompt TEXT;
ALTER TABLE posts ADD COLUMN a TEXT;
ALTER TABLE posts ADD COLUMN b TEXT;

-- One row per member per day; a changed answer replaces the row. anon_id = sha256(team_id:user_id:SALT).
-- The API gives no points before the reveal: correct and points are filled in at the reveal.
CREATE TABLE answers (
  team_id TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  date TEXT NOT NULL,
  choice INTEGER NOT NULL,   -- 0 = A, 1 = B
  conf INTEGER NOT NULL,     -- 50, 60, 70, 80, 90 or 100
  correct INTEGER,           -- 0 or 1, NULL until the reveal
  points INTEGER,            -- NULL until the reveal
  PRIMARY KEY (team_id, date, anon_id)
);
