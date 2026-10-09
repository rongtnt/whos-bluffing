import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIFETIME } from '../src/party-store.js';
import { COMPLETE, USER, GUILD, TRUTH, anon, apiCalls, buttonPayload, commandPayload, fakeD1, makeEnv, mockFetch, originalEdits, roundItems, send, signedRequest, freeze, runCron } from './helpers.js';
const MESSAGE = '990000000000000001';
const last = (calls) => originalEdits(calls).at(-1)?.body;
function fixture({ api = {}, discord, slow = 0, readDelay = 0 } = {}) {
  const env = makeEnv(fakeD1({ readDelay })); let n = 0;
  const calls = mockFetch({ slow, discord, api: {
    '/api/round': (c) => ({ round_id: `r${++n}`, pack: c.url.searchParams.get('pack') ?? 'history', difficulty: c.url.searchParams.get('difficulty') ?? 'easy', items: roundItems().map((q) => ({ ...q, id: `${n}-${q.id}` })) }), ...api,
  } });
  const press = (id, who = {}, values) => {
    const p = buttonPayload(id, { messageId: MESSAGE, ...who }); p.message.flags = who.flags ?? 64;
    if (values) { p.data.values = values; p.data.component_type = 3; }
    return send(env, signedRequest(p));
  };
  const picker = () => env.DB.rows('SELECT * FROM round_setups').at(-1);
  const open = async (mode = 'play') => { await send(env, signedRequest(commandPayload(mode))); return picker(); };
  const select = async (kind, value) => { const s = picker(); await press(`${kind}:${s.id}:${s.revision}`, {}, [value]); return picker(); };
  const start = () => { const s = picker(); return press(`ss:${s.id}:${s.revision}:${s.mode}`); };
  const finish = async (round = 'r1') => { for (let k = 0; k < 10; k++) { await press(`pc:${round}:${k}:0:90`); await press(`pn:${round}:${k + 1}`); } };
  return { env, calls, press, picker, open, select, start, finish };
}

test('pickers offer live topics and valid difficulties, validate inputs and wait for Start', async () => {
  const f = fixture(); await f.open();
  const topics = last(f.calls).components[0].components[0].options;
  assert.ok(topics.some((o) => o.value === 'history'));
  assert.ok(topics.every((o) => !['space', 'bridges', 'lakes'].includes(o.value)));
  assert.equal(apiCalls(f.calls, '/api/round').length, 0);
  await f.select('sp', 'elements');
  assert.equal(f.picker().difficulty, 'brutal');
  assert.deepEqual(last(f.calls).components[1].components[0].options.map((o) => o.value), ['brutal']);
  await f.select('sd', 'easy'); await f.select('sp', 'constructor');
  assert.equal(f.picker().pack, 'elements'); assert.equal(f.picker().difficulty, 'brutal');
  await f.select('sp', 'history'); await f.select('sd', 'easy'); await f.start();
  assert.deepEqual(Object.fromEntries(apiCalls(f.calls, '/api/round')[0].url.searchParams), { mode: 'quick', pack: 'history', difficulty: 'easy' });
  assert.match(last(f.calls).content, /History · Easy/);
});

test('picker owner, chat, private message, revision and expiry reject stale or forged starts', async (t) => {
  freeze(t, '2026-10-09T12:00:00Z'); const f = fixture(); const s = await f.open();
  for (const who of [{ user: '880000000000000002' }, { channel: '660000000000000002' }, { messageId: 'bad' }, { flags: 0 }]) await f.press(`ss:${s.id}:0:play`, who);
  await f.select('sp', 'history'); await f.press(`ss:${s.id}:0:play`);
  assert.equal(apiCalls(f.calls, '/api/round').length, 0);
  t.mock.timers.tick(LIFETIME + 1); await f.start();
  assert.equal(apiCalls(f.calls, '/api/round').length, 0);
  await runCron(f.env, new Date().toISOString());
  assert.equal(f.env.DB.rows('SELECT * FROM round_setups').length, 0);
});

test('concurrent Start and a lost question edit reuse one saved round', async () => {
  let fail = true;
  const f = fixture({ slow: 5, readDelay: 2, discord: (c) => {
    if (c.body?.content?.includes('Question 1 of 10') && fail) { fail = false; return { status: 503 }; }
  } });
  await f.open(); await f.select('sp', 'history'); await f.select('sd', 'easy');
  await Promise.all([f.start(), f.start()]);
  assert.equal(apiCalls(f.calls, '/api/round').length, 1);
  assert.equal(f.env.DB.rows('SELECT round_id FROM play_state')[0].round_id, 'r1');
  await f.start(); assert.match(last(f.calls).content, /Question 1 of 10/);
  assert.equal(apiCalls(f.calls, '/api/round').length, 1);
});

test('a delayed Start cannot replace a round from a newer picker', async () => {
  const f = fixture(); const old = await f.open(); let release;
  const fetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    if (new URL(args[0]).pathname === '/api/round' && !release) await new Promise((r) => { release = r; });
    return fetch(...args);
  };
  const waiting = f.press(`ss:${old.id}:0:play`);
  while (!release) await new Promise((r) => setImmediate(r));
  await f.open(); await f.start(); const saved = f.env.DB.rows('SELECT round_id FROM play_state')[0].round_id;
  release(); await waiting;
  assert.equal(f.env.DB.rows('SELECT round_id FROM play_state')[0].round_id, saved);
});

test('Play again preserves settings and recovers its lost edit without another round', async () => {
  let fail = false;
  const f = fixture({ slow: 2, discord: (c) => {
    if (fail && c.body?.components?.[0]?.components?.[0]?.custom_id === 'pa:r2:0:0') { fail = false; return { status: 503 }; }
  } });
  await f.open(); await f.select('sp', 'history'); await f.select('sd', 'easy'); await f.start(); await f.finish();
  fail = true; await Promise.all([f.press('pp:r1'), f.press('pp:r1')]);
  assert.equal(apiCalls(f.calls, '/api/round').length, 2);
  assert.equal(apiCalls(f.calls, '/api/round')[1].url.searchParams.get('rematch'), 'r1');
  const s = f.env.DB.rows('SELECT * FROM play_state')[0];
  assert.deepEqual([s.round_id, s.pack, s.difficulty, s.step], ['r2', 'history', 'easy', 0]);
  assert.ok(JSON.parse(s.items).every((q) => q.id.startsWith('2-')));
  await f.press('pp:r1'); assert.match(last(f.calls).content, /History · Easy.*Question 1 of 10/);
  assert.equal(apiCalls(f.calls, '/api/round').length, 2);
});

test('malformed answer and score bodies remain retryable and never manufacture scores', async () => {
  let answerFail = true, completeFail = true;
  const f = fixture({ api: {
    '/api/round/answer': () => answerFail ? (answerFail = false, new Response('{broken')) : { correct: true, choice: 0, conf: 90, points: 96, truth: TRUTH },
    '/api/round/complete': () => completeFail ? (completeFail = false, {}) : COMPLETE,
  } });
  await f.open(); await f.start(); await f.press('pc:r1:0:0:90');
  assert.deepEqual(f.env.DB.rows('SELECT step, lease FROM play_state'), [{ step: 0, lease: null }]);
  await f.finish();
  assert.deepEqual(f.env.DB.rows('SELECT step, lease, done FROM play_state'), [{ step: 10, lease: null, done: null }]);
  await f.press('pn:r1:10'); await f.press('pn:r1:10');
  assert.equal(apiCalls(f.calls, '/api/round/complete').length, 2);
  assert.equal(JSON.parse(f.env.DB.rows('SELECT done FROM play_state')[0].done).score, COMPLETE.score);
});

test('question feedback cancels, validates current answered item and binds owner/message', async () => {
  const f = fixture(); await f.open(); await f.start();
  await f.press('pf:r1:0'); assert.equal(apiCalls(f.calls, '/api/flag').length, 0);
  await f.press('pc:r1:0:0:90'); await f.press('pf:r1:0');
  assert.match(last(f.calls).content, /What should we check/);
  await f.press('pg:r1:0:cancel'); assert.equal(apiCalls(f.calls, '/api/flag').length, 0);
  assert.match(last(f.calls).content, /Right at 90%/);
  for (const who of [{ user: '880000000000000002' }, { messageId: 'bad' }]) await f.press('pg:r1:0:wrong', who);
  await f.press('pg:r1:0:invented'); assert.equal(apiCalls(f.calls, '/api/flag').length, 0);
  await f.press('pg:r1:0:wrong');
  assert.deepEqual(apiCalls(f.calls, '/api/flag')[0].body, { anon_id: anon(GUILD, USER), round_id: 'r1', item_id: '1-i0', reason: 'wrong' });
  await f.press('pn:r1:1'); await f.press('pg:r1:0:wrong');
  assert.equal(apiCalls(f.calls, '/api/flag').length, 1);
});

test('Challenge accepts the production public host and uses only its owners saved score/link', async () => {
  const f = fixture({ api: { '/api/round/complete': () => ({ ...COMPLETE, challenge_url: 'https://whosbluffing.com/c/r1/tok1234567' }) } });
  f.env.API_BASE = 'https://bots.whosbluffing.com';
  await f.open(); await f.start(); await f.finish(); await f.press('px:r1');
  assert.match(last(f.calls).content, /scored 260 points.*https:\/\/whosbluffing.com\/c\/r1\/tok1234567/);
  await f.press('px:r1', { user: '880000000000000002' });
  assert.doesNotMatch(last(f.calls).content, /scored|https:/);
});
