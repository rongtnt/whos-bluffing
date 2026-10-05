// Lab claims (docs/api-rounds.md): after a quick round in the AI pack a player can say which lab they are with
// (POST /api/round/lab), and GET /api/labs shows how each lab's players score. Self-reported and anonymous: one claim per
// round with the play's day, the round's difficulty and the stored play's score and overconfidence (migration 0008).
// Bounded: a claim reads the round and its play by key, then one batch writes the claim and two lab_agg rows and reads
// the board; the board sums lab_agg (at most 6 labs x 3 difficulties a day), never lab_claims.
import { ANON_RE, todayUTC, addDays } from './_daily.js';
import { parseRoundId } from './_rounds.js';
import { PACKS, LABS } from '../public/packs.js';

const MIN_LAB_PLAYERS = 10; // averages are shown from this many claims
const LAB_RANGES = { all: null, '30d': 30 }; // range -> trailing UTC days, today included (null = every day)
const ok = (body) => ({ status: 200, body });
const err = (status, error) => ({ status, body: { error } });
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const r1 = (x) => Math.round(x * 10) / 10;
const LAB_LIST = Object.keys(LABS);
const BAD_LAB = `lab must be ${LAB_LIST.slice(0, -1).join(', ')} or ${LAB_LIST.at(-1)}`;
const NOT_AI = 'only quick rounds in the AI pack can be claimed';

// ponytail: sums every lab_agg row in the range (18 a day); add an all-time totals row if the days pile up.
const BOARD_SQL = `SELECT lab, SUM(players) AS players, SUM(sum_score) AS sum_score, SUM(sum_overconf) AS sum_overconf
  FROM lab_agg WHERE date >= ? GROUP BY lab`;

// A claim is one batch, so lab_agg always equals the sums over lab_claims: UNCLAIM takes the stored claim (if any) off
// its row, ADD puts the new one on its row, CLAIM stores it. A moved claim leaves the old lab's row and joins the new
// one; the same lab again nets out.
const UNCLAIM_SQL = `UPDATE lab_agg SET players = players - 1, sum_score = sum_score - c.score, sum_overconf = sum_overconf - c.overconfidence
  FROM lab_claims c WHERE c.round_id = ? AND lab_agg.lab = c.lab AND lab_agg.date = c.date AND lab_agg.difficulty = c.difficulty`;
const ADD_SQL = `INSERT INTO lab_agg (lab, date, difficulty, players, sum_score, sum_overconf) VALUES (?, ?, ?, 1, ?, ?)
  ON CONFLICT (lab, date, difficulty) DO UPDATE SET players = players + 1,
  sum_score = sum_score + excluded.sum_score, sum_overconf = sum_overconf + excluded.sum_overconf`;
const CLAIM_SQL = `INSERT INTO lab_claims (round_id, lab, date, difficulty, score, overconfidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (round_id) DO UPDATE SET lab = excluded.lab, date = excluded.date, difficulty = excluded.difficulty,
  score = excluded.score, overconfidence = excluded.overconfidence`;

// The rounds table does not keep the pack, so a round is in the AI pack when every pair comes from its categories.
const inAiPack = (data, ids) => ids.length > 0
  && ids.every((id) => PACKS.ai.categories.includes(data.items.get(data.pairs.get(id)?.a_id)?.category));

// rows: [{lab, players, sum_score, sum_overconf}] summed over the range. Every lab, means only from MIN_LAB_PLAYERS;
// those labs first by average score, then the rest by players (ties keep the LABS order).
export function boardBody(rows, range, now) {
  const by = new Map(rows.map((r) => [r.lab, r]));
  const labs = Object.entries(LABS).map(([lab, name]) => {
    const r = by.get(lab);
    const players = r?.players ?? 0;
    const shown = players >= MIN_LAB_PLAYERS;
    return { lab, name, players, mean_score: shown ? r1(r.sum_score / players) : null, mean_overconfidence: shown ? r1(r.sum_overconf / players) : null };
  });
  const ranked = labs.filter((l) => l.mean_score !== null).sort((x, y) => y.mean_score - x.mean_score);
  const rest = labs.filter((l) => l.mean_score === null).sort((x, y) => y.players - x.players);
  return { as_of: now.toISOString(), range, min_players: MIN_LAB_PLAYERS, labs: [...ranked, ...rest] };
}

const fromDate = (range, now) => (LAB_RANGES[range] ? addDays(todayUTC(now), 1 - LAB_RANGES[range]) : '');

// GET /api/labs?range=all|30d
export async function labBoard(db, range, now) {
  if (!Object.hasOwn(LAB_RANGES, range)) return err(400, 'range must be all or 30d');
  const { results } = await db.prepare(BOARD_SQL).bind(fromDate(range, now)).all();
  return ok(boardBody(results, range, now));
}

function claimBodyError(b) {
  if (!isObject(b)) return err(400, 'body must be a JSON object');
  if (typeof b.anon_id !== 'string' || !ANON_RE.test(b.anon_id)) return err(400, 'bad anon_id');
  const r = parseRoundId(b.round_id);
  if (r === null) return err(400, 'bad round_id');
  if (r.kind !== 'quick') return err(400, NOT_AI);
  if (typeof b.lab !== 'string' || !Object.hasOwn(LABS, b.lab)) return err(400, BAD_LAB);
  return null;
}

// POST /api/round/lab {round_id, anon_id, lab} -> {ok, lab, board}: the board fresh, with this claim (range all).
export async function claimLab(db, data, b, now) {
  const bad = claimBodyError(b);
  if (bad) return bad;
  const [round, play] = await db.batch([
    db.prepare('SELECT items, difficulty FROM rounds WHERE round_id = ?').bind(b.round_id),
    db.prepare('SELECT score, overconf, day FROM round_plays WHERE anon_id = ? AND round_id = ?').bind(b.anon_id, b.round_id),
  ]);
  const r = round.results[0];
  if (!r) return err(404, 'unknown round');
  if (!inAiPack(data, JSON.parse(r.items))) return err(400, NOT_AI);
  const p = play.results[0];
  if (!p) return err(404, 'finish this round first');
  const claimed = [b.lab, p.day, r.difficulty ?? 'normal', p.score, p.overconf]; // pre-0006 quick rounds were all normal
  const out = await db.batch([
    db.prepare(UNCLAIM_SQL).bind(b.round_id),
    db.prepare(ADD_SQL).bind(...claimed),
    db.prepare(CLAIM_SQL).bind(b.round_id, ...claimed, now.toISOString()),
    db.prepare(BOARD_SQL).bind(''),
  ]);
  return ok({ ok: true, lab: b.lab, board: boardBody(out.at(-1).results, 'all', now) });
}
