// The bundled pool, pairs and ranked days, written by `npm run sync-items` (git-ignored). Kept out of _rounds.js so unit
// tests can run the same code on fixtures.
import pool from './_pool.json';
import pairs from './_pairs.json';
import rounds from './_rounds.json';
import { loadRounds } from './_rounds.js';

export const ROUNDS = loadRounds(pool, pairs, rounds);
