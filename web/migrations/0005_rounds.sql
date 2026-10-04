-- Rounds (docs/api-rounds.md): ten comparison pairs per round, the Slack/Discord daily question, challenges.
-- Request paths read the round's own rows; only the daily KPI job (POST /api/kpi/run) scans these tables, and retiring
-- a pair recomputes the affected ranked days from their answers. Dates are UTC YYYY-MM-DD; times are ISO strings.
-- Pair ids (p00001) and item ids (w0001) come from items/pairs.json and items/pool.json.

-- Quick rounds only: their ten pair ids, so answers are checked on the server. Ranked rounds (rk-<date>) and daily
-- questions (dq-<date>) come from the bundled daily/rounds.json and are never stored here.
CREATE TABLE rounds (
  round_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  date TEXT NOT NULL,
  items TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- One row per answered pair. The first answer is final, except a daily-question answer sent with revision: true while
-- the question is open. Daily-question answers keep correct and points NULL until they are settled (reveal or KPI run).
CREATE TABLE round_answers (
  anon_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  choice INTEGER NOT NULL,
  conf INTEGER NOT NULL,
  correct INTEGER,
  points INTEGER,
  rt_ms INTEGER,
  answered_at TEXT NOT NULL,
  surface TEXT NOT NULL,
  community TEXT,
  PRIMARY KEY (anon_id, round_id, item_id)
);
-- Reveal (one community's answers to a daily question) and the ranked-day recompute.
CREATE INDEX idx_round_answers_round ON round_answers(round_id, community);

-- One row per completed round (what MAU counts). day = UTC day it was completed; challenge_of = the challenger's
-- public token when the round was started from a challenge link. public_token is minted here, never the anon_id.
CREATE TABLE round_plays (
  anon_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  community TEXT,
  score INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  mean_conf REAL NOT NULL,
  overconf REAL NOT NULL,
  brier REAL NOT NULL,
  type TEXT NOT NULL,
  nickname TEXT,
  public_token TEXT NOT NULL UNIQUE,
  completed_at TEXT NOT NULL,
  day TEXT NOT NULL,
  mode TEXT NOT NULL,
  challenge_of TEXT,
  PRIMARY KEY (anon_id, round_id)
);
CREATE INDEX idx_round_plays_round ON round_plays(round_id, day);

-- The ranked round's completed plays per day and surface (completions on the day or the day after). score_hist =
-- JSON array of 1001 counts, index (score + 3000) / 4 (every score is a multiple of 4); sum_overconf in points.
CREATE TABLE round_agg (
  date TEXT NOT NULL,
  surface TEXT NOT NULL,
  players INTEGER NOT NULL,
  score_hist TEXT NOT NULL,
  sum_overconf REAL NOT NULL,
  PRIMARY KEY (date, surface)
);

-- Online difficulty per pair, counted on first answers to ranked and quick rounds (a revision cannot happen there);
-- retired_at is set by the third distinct flag.
CREATE TABLE pair_runtime (
  pair_id TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  n_correct INTEGER NOT NULL DEFAULT 0,
  sum_conf INTEGER NOT NULL DEFAULT 0,
  retired_at TEXT
);

-- Anonymous counters (share, challenge_view, play_again): no ids, just a count per day and type.
CREATE TABLE events (
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (day, type)
);

-- Days each anonymous id played: rounds = completed rounds that day (0 for a day with only a daily-question answer);
-- streak = consecutive days with a completed round, one missed day forgiven, so completing reads two rows, never a
-- history. The KPI job reads it for rounds per player per day and day-1 / day-7 return.
CREATE TABLE player_days (
  anon_id TEXT NOT NULL,
  day TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  PRIMARY KEY (anon_id, day)
);

-- KPI: Discord and rooms as surfaces and community platforms, and the engagement numbers (trailing 30 days).
ALTER TABLE kpi ADD COLUMN mau_discord INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kpi ADD COLUMN mau_room INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kpi ADD COLUMN guilds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kpi ADD COLUMN rooms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kpi ADD COLUMN rounds_per_player_day REAL;
ALTER TABLE kpi ADD COLUMN d1_return REAL;
ALTER TABLE kpi ADD COLUMN d7_return REAL;
ALTER TABLE kpi ADD COLUMN challenge_conversion REAL;
ALTER TABLE kpi ADD COLUMN share_rate REAL;
