-- The home page's live panel (GET /api/round/stats), both bounded reads:
-- calib: per ranked day and surface, answers and right answers at each confidence (12 counts: n and right for 50, 60,
-- ... 100%), added at complete and rebuilt with the day's other aggregates when a pair retires.
-- idx_round_answers_bluffs: per ranked pair, its costliest miss at 90% or surer (the most recent on a tie) in one
-- LIMIT 1 lookup; only confident misses are indexed, so an answer adds an index row only when it is one.
ALTER TABLE round_agg ADD COLUMN calib TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0]';
CREATE INDEX idx_round_answers_bluffs ON round_answers(round_id, item_id, points, answered_at DESC) WHERE correct = 0 AND conf >= 90;
