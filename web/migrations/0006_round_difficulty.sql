-- Quick rounds record the difficulty they were drawn at (easy, normal, brutal: GET /api/round?difficulty=), so the
-- research data can tell them apart. Ranked rounds and daily questions are not stored in rounds.
ALTER TABLE rounds ADD COLUMN difficulty TEXT;
