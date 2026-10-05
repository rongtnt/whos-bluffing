-- Party claims (docs/api-rounds.md, POST /api/round/party and GET /api/parties): the lab board of migration 0008 becomes
-- one board per pack. `board` names it: `labs` (the AI pack; every claim so far) or `parties` (the Politics pack: sides
-- democrat, republican, independent, none). The side stays in `lab`. Side ids are distinct across boards
-- (public/packs.js; a unit test checks it), so lab_agg's key (lab, date, difficulty) still holds one row per board,
-- side, day and difficulty.
ALTER TABLE lab_claims ADD COLUMN board TEXT NOT NULL DEFAULT 'labs';
ALTER TABLE lab_agg ADD COLUMN board TEXT NOT NULL DEFAULT 'labs';
