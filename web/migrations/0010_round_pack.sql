-- Preserve the chosen pack when friends load a saved round.
ALTER TABLE rounds ADD COLUMN pack TEXT;
