import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openD1 } from './d1.js';
import { playerCounts, totalPlayers } from '../functions/_kpi.js';
import { onRequestGet as privateCounts } from '../functions/api/kpi/index.js';
import { onRequestGet as publicCount } from '../functions/api/players.js';
import { onRequest as gate } from '../functions/_middleware.js';

test('four counts: unique players, UTC day, inclusive 30/365-day windows, historical players and future exclusion', async () => {
  const db = openD1(), day = '2026-10-06';
  assert.deepEqual(await playerCounts(db, day), { as_of: day, total_players: 0, dau: 0, mau: 0, yau: 0 });
  let n = 0;
  const play = (id, date, surface = 'web') => db.sqlite.prepare(`INSERT INTO round_plays
    (anon_id, round_id, surface, score, accuracy, mean_conf, overconf, brier, type, public_token, completed_at, day, mode)
    VALUES (?, ?, ?, 0, 50, 50, 0, .25, 'Calibrated', ?, ?, ?, 'quick')`)
    .run(id, `round-${++n}`, surface, `token-${n}`, `${date}T23:59:59Z`, date);
  const chat = (id, questionDay, answeredDay, roundId = `dq-${questionDay}`) => db.sqlite.prepare(`INSERT INTO round_answers
    (anon_id, round_id, item_id, choice, conf, answered_at, surface) VALUES (?, ?, 'p00001', 0, 80, ?, 'slack')`)
    .run(id, roundId, `${answeredDay}T00:00:00Z`);
  const assessment = (id, date, anon = id) => db.sqlite.prepare(`INSERT INTO sessions (id, created_at, lang, answers, anon_id)
    VALUES (?, ?, 'en', '[]', ?)`).run(id, `${date}T12:00:00Z`, anon);
  play('same', day); play('same', day, 'discord'); play('same', '2026-10-05');
  assessment('duplicate', day, 'same'); chat('same', day, day);
  play('month-edge', '2026-09-07'); play('outside-month', '2026-09-06');
  assessment('year-edge', '2025-10-07'); assessment('outside-year', '2025-10-06');
  play('old', '2024-01-01'); play('future', '2026-10-07');
  chat('chat-today', '2026-10-05', day); // activity is when answered, not the scheduled day
  chat('unfinished', day, day, 'AAAAAAAAAAAA'); // a partial ten-question game is not a player
  assessment('no-id', day, null);
  assert.deepEqual(await playerCounts(db, day), { as_of: day, total_players: 7, dau: 2, mau: 3, yau: 5 });
  assert.equal(await totalPlayers(db, day), 7);
  db.sqlite.close();
});

test('private activity never enters a public response or cache; missing/wrong/unconfigured keys fail closed', async () => {
  const db = openD1(), env = { DB: db, KPI_KEY: 'owner-key', BOT_KEY: 'bot-key' };
  const request = (path, key, host = 'whosbluffing.com') => new Request(`https://${host}${path}`, {
    headers: key ? { 'x-kpi-key': key } : {},
  });
  for (const [key, configured] of [[null, true], ['wrong', true], ['owner-key', false]]) {
    const res = await privateCounts({ request: request('/api/kpi', key), env: configured ? env : { DB: db } });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.deepEqual(await res.json(), { error: 'unauthorized' });
  }
  const privateRes = await privateCounts({ request: request('/api/kpi', 'owner-key'), env });
  assert.deepEqual(Object.keys(await privateRes.json()).sort(), ['as_of', 'dau', 'mau', 'total_players', 'yau']);
  assert.match(privateRes.headers.get('cache-control'), /private, no-store/);
  assert.equal(privateRes.headers.get('access-control-allow-origin'), null);
  for (const path of ['/api/stats', '/api/daily/stats', '/api/round/stats/']) {
    let called = false;
    const next = () => { called = true; return new Response('{}', { headers: { 'cache-control': 'public', 'access-control-allow-origin': '*' } }); };
    for (const key of [null, 'wrong']) assert.equal((await gate({ request: request(path, key), env, next })).status, 401);
    assert.equal(called, false, 'authorization happens before even reading a cached aggregate');
    const authorized = await gate({ request: request(path, 'owner-key'), env, next });
    assert.equal(called, true);
    assert.equal(authorized.headers.get('access-control-allow-origin'), null);
    assert.match(authorized.headers.get('cache-control'), /private, no-store/);
    assert.equal((await gate({ request: request(path, 'owner-key', 'bots.whosbluffing.com'), env, next })).status, 403);
  }
  const previous = globalThis.caches, cached = new Map();
  globalThis.caches = { default: { match: async (key) => cached.get(key.url)?.clone(), put: async (key, value) => cached.set(key.url, value) } };
  try {
    for (let i = 0; i < 2; i++) {
      const res = await publicCount({ request: request('/api/players'), env, waitUntil: (p) => p });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { total_players: 0 });
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
    }
    assert.equal(cached.size, 1);
  } finally { globalThis.caches = previous; db.sqlite.close(); }
});

