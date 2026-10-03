// Daily game core (docs/api-daily.md): day numbers, scoring, share text, and the D1 work behind /api/daily/* and
// /api/flag. The pool and schedule come in as data ({items, schedule, datesByItem} from loadDaily), so tests can
// use fixtures; functions/_daily_data.js loads the bundled copies. Every function returns {status, body}.
// Bounded reads: each request touches O(1) rows (at most a day's 5 items, its daily_agg rows, one player's play).

export const EPOCH = '2026-10-17'; // day #1 (soft launch); earlier dates show #0 (preview)
export const SURFACES = ['web', 'slack', 'classroom'];
export const RETIRE_FLAGS = 3;
export const ANON_RE = /^[A-Za-z0-9_-]{1,64}$/; // opaque; web: 22 random chars, Slack: 64-char sha256 hex
const COMMUNITY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_MS = 86400000;
const MAX_REASON = 280;

const ok = (body) => ({ status: 200, body });
const err = (status, error) => ({ status, body: { error } });
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);
const dayMs = (date) => Date.parse(`${date}T00:00:00Z`);
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(dayMs(s))
  && new Date(dayMs(s)).toISOString().slice(0, 10) === s; // rejects 2026-02-30, which Date.parse rolls over
export const addDays = (date, n) => new Date(dayMs(date) + n * DAY_MS).toISOString().slice(0, 10);
export const dayNumber = (date) => Math.max(0, Math.round((dayMs(date) - dayMs(EPOCH)) / DAY_MS) + 1);

// pool: {items:[...]}; schedule: {"YYYY-MM-DD": [5 item ids]}.
export function loadDaily(pool, schedule) {
  const datesByItem = new Map();
  for (const [date, ids] of Object.entries(schedule)) {
    for (const id of ids) datesByItem.set(id, [...(datesByItem.get(id) ?? []), date]);
  }
  return { items: new Map(pool.items.map((i) => [i.id, i])), schedule, datesByItem };
}

// Signed log10 of (range midpoint / truth): 0 = centred on the truth, +1 = ten times too high.
// null when the midpoint or the truth is not positive (e.g. melting points below 0 °C).
export function logRatioError(low, high, truth) {
  const mid = (low + high) / 2;
  return mid > 0 && truth > 0 ? Math.round(Math.log10(mid / truth) * 1e6) / 1e6 : null;
}

// ids: the day's scheduled ids in order; answers: [{item_id, hit}]. Retired items are left out of hits, n and grid;
// mask keeps every hit (bit k = ids[k]) so the day's aggregates can be recomputed after a retirement.
export function scorePlay(ids, retired, answers) {
  const hitBy = new Map(answers.map((a) => [a.item_id, Boolean(a.hit)]));
  const live = ids.filter((id) => !retired.has(id));
  const grid = live.map((id) => hitBy.get(id) === true);
  return {
    hits: grid.filter(Boolean).length,
    n: live.length,
    grid,
    mask: ids.reduce((m, id, k) => (hitBy.get(id) ? m | (1 << k) : m), 0),
    missing: live.filter((id) => !hitBy.has(id)),
  };
}

const bitCount = (x) => { let c = 0; for (let v = x; v; v &= v - 1) c += 1; return c; };
const maskOf = (ids, set) => ids.reduce((m, id, k) => (set.has(id) ? m | (1 << k) : m), 0);

// hits_hist [n0..n5] from the 32 hit-pattern counts, ignoring retired items.
export function histFromPatterns(patterns, retiredMask) {
  const hist = [0, 0, 0, 0, 0, 0];
  patterns.forEach((count, mask) => { hist[bitCount(mask & ~retiredMask)] += count; });
  return hist;
}

// Sums a day's daily_agg rows (one per surface) into {players, avg_hits, hist}.
export function sumAgg(rows) {
  const hist = [0, 0, 0, 0, 0, 0];
  let players = 0;
  for (const r of rows) {
    players += r.players;
    JSON.parse(r.hits_hist).forEach((c, h) => { hist[h] += c; });
  }
  const total = hist.reduce((s, c, h) => s + c * h, 0);
  return { players, avg_hits: players ? Math.round((100 * total) / players) / 100 : null, hist };
}

export function shareText({ number, grid, hits, n, avg, url }) {
  const squares = grid.map((hit) => (hit ? '🟩' : '🟥')).join('');
  return `HowSure #${number} ${squares} ${hits}/${n} at 90%\nToday's average ${(avg ?? 0).toFixed(1)}/${n}\n${url}`;
}

// --- request validation -------------------------------------------------------------------------------------

function dayError(data, date, now) {
  if (!isDate(date)) return err(400, 'date must be YYYY-MM-DD');
  if (date > todayUTC(now) || !data.schedule[date]) return err(404, 'no game for that date');
  return null;
}

// answer/complete: today's game or yesterday's (a form opened before midnight UTC can be sent after it).
function playDateError(data, date, now) {
  if (!isDate(date)) return err(400, 'date must be YYYY-MM-DD');
  const today = todayUTC(now);
  if (date !== today && date !== addDays(today, -1)) return err(400, 'date must be today or yesterday (UTC)');
  return dayError(data, date, now);
}

function playerError(b) {
  if (!isObject(b)) return err(400, 'body must be a JSON object');
  if (typeof b.anon_id !== 'string' || !ANON_RE.test(b.anon_id)) return err(400, 'bad anon_id');
  if (!SURFACES.includes(b.surface)) return err(400, 'surface must be web, slack or classroom');
  if (b.community != null && !(typeof b.community === 'string' && COMMUNITY_RE.test(b.community))) return err(400, 'bad community');
  return null;
}

// --- D1 ------------------------------------------------------------------------------------------------------

const RETIRED_SQL = (n) => `SELECT item_id FROM items_runtime WHERE retired_at IS NOT NULL AND item_id IN (${Array(n).fill('?').join(', ')})`;
const retiredStmt = (db, ids) => db.prepare(RETIRED_SQL(ids.length)).bind(...ids);
const AGG_SQL = 'SELECT surface, players, hits_hist, patterns FROM daily_agg WHERE date = ?';
const ANSWER_SQL = 'SELECT low, high, hit FROM daily_answers WHERE anon_id = ? AND date = ? AND item_id = ?';
const PLAY_SQL = 'SELECT hits, n, streak FROM plays WHERE anon_id = ? AND date = ? ORDER BY completed_at LIMIT 1';

// Running difficulty for an item, counted once per first answer (see items_runtime in migrations/0003_daily.sql).
const RUNTIME_SQL = `INSERT INTO items_runtime (item_id, n_answers, n_hits, mean_log_err, n_log_err) VALUES (?, 1, ?, ?, ?)
  ON CONFLICT (item_id) DO UPDATE SET n_answers = n_answers + 1, n_hits = n_hits + excluded.n_hits,
  mean_log_err = CASE WHEN excluded.n_log_err = 0 THEN mean_log_err
    ELSE COALESCE(mean_log_err, 0) + (excluded.mean_log_err - COALESCE(mean_log_err, 0)) / (n_log_err + 1.0) END,
  n_log_err = n_log_err + excluded.n_log_err`;

async function retiredSet(db, ids) {
  const { results } = await retiredStmt(db, ids).all();
  return new Set(results.map((r) => r.item_id));
}

// GET /api/daily (date defaults to today): the day's non-retired items, never answers or sources.
export async function getDay(db, data, dateParam, now) {
  const date = dateParam || todayUTC(now);
  const bad = dayError(data, date, now);
  if (bad) return bad;
  const ids = data.schedule[date];
  const retired = await retiredSet(db, ids);
  const items = ids.filter((id) => !retired.has(id)).map((id) => {
    const it = data.items.get(id);
    return { id: it.id, prompt: it.en.prompt, unit: it.en.unit, accept: it.accept };
  });
  return ok({ date, number: dayNumber(date), items });
}

const answerResult = (item, a) => ({
  hit: Boolean(a.hit), truth: item.answer, source: item.source, log_ratio_error: logRatioError(a.low, a.high, item.answer),
});

// Stores a community (Slack team hash, class code) on the player record; web players have none. Writes nothing
// when it is unchanged. Created here, a record has plays = 0 until its first completed play.
const communityStmt = (db, b, at) => db.prepare(`INSERT INTO players (anon_id, surface, first_seen, last_seen, plays, community)
  VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT (anon_id) DO UPDATE SET community = excluded.community WHERE community IS NOT excluded.community`)
  .bind(b.anon_id, b.surface, at, at, b.community);
const hasCommunity = (b) => b.surface !== 'web' && b.community != null;

// POST /api/daily/answer. The first answer per (anon_id, date, item_id) is final; repeats return it unchanged.
export async function answer(db, data, b, now) {
  const bad = playerError(b) ?? playDateError(data, b.date, now);
  if (bad) return bad;
  if (!data.schedule[b.date].includes(b.item_id)) return err(400, 'item is not in that day\'s game');
  if (!Number.isFinite(b.low) || !Number.isFinite(b.high) || b.low > b.high) return err(400, 'low and high must be numbers with low <= high');
  if (b.rt_ms != null && !(Number.isFinite(b.rt_ms) && b.rt_ms >= 0)) return err(400, 'bad rt_ms');
  const item = data.items.get(b.item_id);
  const key = [b.anon_id, b.date, b.item_id];
  const first = await db.prepare(ANSWER_SQL).bind(...key).first();
  if (first) return ok(answerResult(item, first));
  const a = { low: b.low, high: b.high, hit: b.low <= item.answer && item.answer <= b.high ? 1 : 0 };
  const logErr = logRatioError(a.low, a.high, item.answer);
  try {
    await db.batch([
      db.prepare('INSERT INTO daily_answers (anon_id, date, item_id, low, high, hit, rt_ms, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(...key, a.low, a.high, a.hit, b.rt_ms == null ? null : Math.round(b.rt_ms), now.toISOString()),
      db.prepare(RUNTIME_SQL).bind(b.item_id, a.hit, logErr == null ? null : Math.abs(logErr), logErr == null ? 0 : 1),
      ...(hasCommunity(b) ? [communityStmt(db, b, now.toISOString())] : []),
    ]);
  } catch (e) {
    const raced = await db.prepare(ANSWER_SQL).bind(...key).first(); // a concurrent first answer won; it is final
    if (!raced) throw e;
    return ok(answerResult(item, raced));
  }
  return ok(answerResult(item, a));
}

function oneHot(length, index) {
  const xs = Array(length).fill(0);
  xs[index] = 1;
  return JSON.stringify(xs);
}

// POST /api/daily/complete: needs every non-retired item answered. Marks the play complete (what MAU counts) once;
// repeats return the same play with fresh day stats.
export async function complete(db, data, b, now, url) {
  const bad = playerError(b) ?? playDateError(data, b.date, now);
  if (bad) return bad;
  const ids = data.schedule[b.date];
  const [answers, retiredRows, prior] = await db.batch([
    db.prepare('SELECT item_id, hit FROM daily_answers WHERE anon_id = ? AND date = ?').bind(b.anon_id, b.date),
    retiredStmt(db, ids),
    db.prepare(PLAY_SQL).bind(b.anon_id, b.date),
  ]);
  const s = scorePlay(ids, new Set(retiredRows.results.map((r) => r.item_id)), answers.results);
  if (s.missing.length) return err(400, 'answer every question first');
  const respond = (streak, aggRows) => {
    const today = sumAgg(aggRows);
    const number = dayNumber(b.date);
    return ok({ hits: s.hits, n: s.n, streak, share_text: shareText({ number, ...s, avg: today.avg_hits, url }), today });
  };
  const replay = async () => {
    const [play, agg] = await db.batch([db.prepare(PLAY_SQL).bind(b.anon_id, b.date), db.prepare(AGG_SQL).bind(b.date)]);
    return play.results[0] ? respond(play.results[0].streak, agg.results) : null;
  };
  if (prior.results[0]) return replay();

  const at = now.toISOString();
  const community = hasCommunity(b) ? b.community : null;
  const yesterday = addDays(b.date, -1);
  try {
    const out = await db.batch([
      db.prepare(`INSERT INTO plays (anon_id, date, surface, hits, n, completed_at, streak) VALUES (?, ?, ?, ?, ?, ?,
        COALESCE((SELECT streak FROM plays WHERE anon_id = ? AND date = ? AND surface = ?), 0) + 1)`)
        .bind(b.anon_id, b.date, b.surface, s.hits, s.n, at, b.anon_id, yesterday, b.surface),
      db.prepare(`INSERT INTO players (anon_id, surface, first_seen, last_seen, plays, community) VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT (anon_id) DO UPDATE SET last_seen = excluded.last_seen, plays = plays + 1,
        community = COALESCE(excluded.community, community)`)
        .bind(b.anon_id, b.surface, at, at, community),
      db.prepare(`INSERT INTO daily_agg (date, surface, players, hits_hist, patterns) VALUES (?, ?, 1, ?, ?)
        ON CONFLICT (date, surface) DO UPDATE SET players = players + 1,
        hits_hist = json_set(hits_hist, ?, json_extract(hits_hist, ?) + 1),
        patterns = json_set(patterns, ?, json_extract(patterns, ?) + 1)`)
        .bind(b.date, b.surface, oneHot(6, s.hits), oneHot(32, s.mask), `$[${s.hits}]`, `$[${s.hits}]`, `$[${s.mask}]`, `$[${s.mask}]`),
      db.prepare('SELECT streak FROM plays WHERE anon_id = ? AND date = ? AND surface = ?').bind(b.anon_id, b.date, b.surface),
      db.prepare(AGG_SQL).bind(b.date),
    ]);
    return respond(out[3].results[0].streak, out[4].results);
  } catch (e) {
    const raced = await replay(); // a concurrent complete won; the batch rolled back, nothing was counted twice
    if (!raced) throw e;
    return raced;
  }
}

// GET /api/daily/stats (date defaults to today): completed plays, all surfaces.
export async function dayStats(db, data, dateParam, now) {
  const date = dateParam || todayUTC(now);
  const bad = dayError(data, date, now);
  if (bad) return bad;
  const { results } = await db.prepare(AGG_SQL).bind(date).all();
  return ok(sumAgg(results));
}

// Marks an item retired and recomputes hits_hist of every past day that scheduled it, from daily_agg alone.
// ponytail: a complete that commits between the two steps keeps its pre-retirement bucket until the day's next
// recompute; patterns stay exact, so re-running the recompute fixes it.
async function retire(db, data, itemId, dates, now) {
  await db.prepare(`INSERT INTO items_runtime (item_id, retired_at) VALUES (?, ?)
    ON CONFLICT (item_id) DO UPDATE SET retired_at = COALESCE(retired_at, excluded.retired_at)`).bind(itemId, now.toISOString()).run();
  for (const date of dates) {
    const ids = data.schedule[date];
    const [retiredRows, agg] = await db.batch([retiredStmt(db, ids), db.prepare(AGG_SQL).bind(date)]);
    const rmask = maskOf(ids, new Set(retiredRows.results.map((r) => r.item_id)));
    const updates = agg.results.map((r) => db.prepare('UPDATE daily_agg SET hits_hist = ? WHERE date = ? AND surface = ?')
      .bind(JSON.stringify(histFromPatterns(JSON.parse(r.patterns), rmask)), date, r.surface));
    if (updates.length) await db.batch(updates);
  }
}

// POST /api/flag. Only players who answered the item (on a day up to today) can flag it, so the public pool's ids
// cannot be used to retire future items. The third distinct flag retires it.
export async function flag(db, data, b, now) {
  if (!isObject(b)) return err(400, 'body must be a JSON object');
  if (typeof b.anon_id !== 'string' || !ANON_RE.test(b.anon_id)) return err(400, 'bad anon_id');
  if (typeof b.item_id !== 'string' || !data.items.has(b.item_id)) return err(400, 'unknown item');
  if (b.reason != null && !(typeof b.reason === 'string' && b.reason.length <= MAX_REASON)) return err(400, `reason must be text of at most ${MAX_REASON} characters`);
  const today = todayUTC(now);
  const dates = (data.datesByItem.get(b.item_id) ?? []).filter((d) => d <= today);
  const notAnswered = err(403, 'answer this question before flagging it');
  if (!dates.length) return notAnswered;
  const [answered, runtime] = await db.batch([
    db.prepare(`SELECT 1 FROM daily_answers WHERE anon_id = ? AND item_id = ? AND date IN (${dates.map(() => '?').join(', ')}) LIMIT 1`)
      .bind(b.anon_id, b.item_id, ...dates),
    db.prepare('SELECT retired_at FROM items_runtime WHERE item_id = ?').bind(b.item_id),
  ]);
  if (!answered.results.length) return notAnswered;
  const insert = db.prepare('INSERT OR IGNORE INTO item_flags (item_id, anon_id, reason, created_at) VALUES (?, ?, ?, ?)')
    .bind(b.item_id, b.anon_id, b.reason?.trim() || null, now.toISOString());
  if (runtime.results[0]?.retired_at) {
    await insert.run();
    return ok({ ok: true });
  }
  const [, count] = await db.batch([insert, db.prepare('SELECT COUNT(*) AS n FROM item_flags WHERE item_id = ?').bind(b.item_id)]);
  if (count.results[0].n >= RETIRE_FLAGS) await retire(db, data, b.item_id, dates, now);
  return ok({ ok: true });
}
