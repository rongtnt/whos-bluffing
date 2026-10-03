// The bundled pool and schedule, written by `npm run sync-items` (git-ignored). Kept out of _daily.js so unit
// tests can run the same code on fixtures.
import pool from './_pool.json';
import schedule from './_schedule.json';
import { loadDaily } from './_daily.js';

export const DAILY = loadDaily(pool, schedule);
