-- Lab claims (docs/api-rounds.md, POST /api/round/lab and GET /api/labs): after a quick round in the AI pack a player can
-- say which lab they are with. Self-reported and anonymous: one claim per round, keeping the lab with the play's day
-- (round_plays.day), the round's difficulty and the stored play's score and overconfidence; nothing else.
CREATE TABLE lab_claims (
  round_id TEXT PRIMARY KEY,
  lab TEXT NOT NULL,
  date TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  score INTEGER NOT NULL,
  overconfidence REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_lab_claims_lab ON lab_claims(lab, date);

-- The claims summed per lab, day and difficulty, so the board reads at most 6 x 3 rows a day and never lab_claims.
-- A claim's batch takes the stored claim off its row and adds the new one, so these rows always equal the sums over
-- lab_claims (a moved claim decrements the old lab's row and increments the new one).
CREATE TABLE lab_agg (
  lab TEXT NOT NULL,
  date TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  players INTEGER NOT NULL,
  sum_score INTEGER NOT NULL,
  sum_overconf REAL NOT NULL,
  PRIMARY KEY (lab, date, difficulty)
);
