// Signed Slack callbacks against the actual rounds API, scoring, migrations and question bank.
// Only Slack delivery is simulated; no request leaves this process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRounds, getRound, answer, complete, flagPair } from '../../web/functions/_rounds.js';
import { compactPairs, serverPool } from '../../web/scripts/sync-items.js';
import { openD1 } from '../../web/test/d1.js';
import AVAILABILITY from '../../web/public/pack-availability.json' with { type: 'json' };
import * as store from '../src/play-store.js';
import * as ui from '../src/play-ui.js';
import { makeEnv, install, signedRequest, slashBody, payloadBody, send, makeCtx, worker, BOT_KEY } from './helpers.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bank = loadRounds(serverPool(read('../../items/pool.json')), compactPairs(read('../../items/pairs.json')), read('../../daily/rounds.json'), { curated: read('../../items/quick_curated.json').items });
const buttonIds = (message) => (message.blocks ?? []).flatMap((b) => (b.elements ?? []).filter((e) => e.type === 'button').map((b) => b.action_id));

async function fixture(t) {
  const env = makeEnv(), db = openD1(), calls = [], hooks = {};
  await install(env);
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; db.sqlite.close(); });
  let serial = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : undefined;
    const call = { url, body, query: Object.fromEntries(url.searchParams) };
    calls.push(call);
    if (url.hostname === 'hooks.slack.com') {
      if (hooks.reply) await hooks.reply(call);
      return Response.json({ ok: true });
    }
    if (url.hostname === 'slack.com') {
      const custom = await hooks.slack?.(call);
      return Response.json(custom ?? (url.pathname.endsWith('users.info') ? { ok: true, user: { profile: { display_name: `Friend <@everyone> ${body.user}` } } } : { ok: true, ts: '1700000000.000100' }));
    }
    assert.equal(url.hostname, 'api.test');
    assert.equal(init.headers['x-bluff-bot'], BOT_KEY);
    await hooks.beforeApi?.(call);
    let result;
    if (url.pathname === '/api/round') result = await getRound(db, bank, call.query, new Date());
    else if (url.pathname === '/api/round/answer') result = await answer(db, bank, body, new Date());
    else if (url.pathname === '/api/round/complete') result = await complete(db, bank, body, new Date(), 'https://bots.whosbluffing.com');
    else if (url.pathname === '/api/flag') result = await flagPair(db, bank, body, new Date());
    else assert.fail(`Unexpected API path ${url.pathname}`);
    await hooks.afterApi?.(call, result);
    return Response.json(result.body, { status: result.status });
  };
  const last = () => calls.filter((c) => c.url.hostname === 'hooks.slack.com').at(-1)?.body;
  const tap = async (actionId, { user = 'U1', channel = 'C1', team = 'T1', privateMessage = true, ts = '1700000000.000100', selected, badSignature = false } = {}) => {
    const payload = { type: 'block_actions', team: { id: team }, user: { id: user, name: user }, channel: { id: channel }, container: { is_ephemeral: privateMessage, message_ts: ts }, message: { ts },
      response_url: `https://hooks.slack.com/actions/${++serial}`, actions: [{ action_id: actionId }],
      ...(selected && { state: { values: { 'play-settings': { 'play:settings': { selected_option: { value: selected } } } } } }) };
    const res = await send(env, signedRequest(payloadBody(payload), badSignature ? { secret: 'not-the-secret' } : {}));
    return { res, message: last() };
  };
  const begin = async (kind = 'solo', selected = 'memes:normal') => {
    const ack = await send(env, signedRequest(slashBody({ text: kind === 'solo' ? 'play' : 'party', trigger_id: `trigger-${++serial}` })));
    assert.equal(await ack.text(), '');
    const id = buttonIds(last())[0].split(':')[2];
    const chooser = last();
    await tap(`play:start:${id}`, { selected });
    return { ...await store.get(env.DB, id), chooser };
  };
  const finish = async (p, user = 'U1', wrong = false) => {
    for (let step = 0; step < 10; step++) {
      const correct = bank.pairs.get(p.items[step].id).truth;
      const choice = wrong ? 1 - correct : correct;
      await tap(`play:pick:${p.id}:${step}:${choice}`, { user });
      assert.ok(buttonIds(last()).includes(`play:conf:${p.id}:${step}:${choice}:80`));
      await tap(`play:conf:${p.id}:${step}:${choice}:80`, { user });
      assert.match(JSON.stringify(last()), /\|source>/);
      await tap(`play:conf:${p.id}:${step}:${1 - choice}:100`, { user }); // stale tap
      await tap(`play:next:${p.id}:${step + 1}`, { user });
    }
    return last();
  };
  return { env, db, calls, hooks, begin, tap, finish, last };
}

test('solo: available topics/difficulties, source feedback, real score, explicit challenge and fresh same-settings replay', async (t) => {
  const f = await fixture(t);
  const p = await f.begin('solo', 'history:brutal');
  const picker = p.chooser.blocks[1].elements[0];
  assert.deepEqual(picker.option_groups.flatMap((g) => g.options.map((o) => o.value)).sort(), Object.entries(AVAILABILITY).flatMap(([d, packs]) => packs.map((p) => `${p}:${d}`)).sort());
  assert.equal(p.pack, 'history'); assert.equal(p.difficulty, 'brutal');
  assert.equal(f.calls.filter((c) => c.url.pathname.endsWith('chat.postMessage')).length, 0, 'solo game stays private');
  const result = await f.finish(p);
  assert.match(result.text, /840 points/);
  assert.match(JSON.stringify(result), /https:\/\/whosbluffing.com\/c\//);
  assert.match(JSON.stringify(result), /\|Open challenge link>/);
  await f.tap(`play:next:${p.id}:10`);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 1);
  const apiCalls = f.calls.filter((c) => c.url.hostname === 'api.test');
  assert.equal(apiCalls.filter((c) => c.url.pathname.endsWith('/answer')).length, 10);
  assert.equal(apiCalls.filter((c) => c.url.pathname.endsWith('/complete')).length, 1);
  assert.ok(apiCalls.filter((c) => c.body).every((c) => c.body.surface === 'slack' && /^[a-f0-9]{64}$/.test(c.body.anon_id) && /^slack:[a-f0-9]{64}$/.test(c.body.community)));
  await f.tap(`play:share:${p.id}`);
  await f.tap(`play:share:${p.id}`);
  const shares = f.calls.filter((c) => c.url.pathname.endsWith('chat.postMessage'));
  assert.equal(shares.length, 1); assert.match(shares[0].body.blocks, /&lt;@everyone&gt;/);
  assert.equal(shares[0].body.parse, 'none');
  await f.tap(`play:replay:${p.id}`);
  await f.tap(`play:replay:${p.id}`);
  const child = await store.get(f.env.DB, (await store.get(f.env.DB, p.id)).next_id);
  assert.deepEqual([child.pack, child.difficulty], ['history', 'brutal']);
  assert.notEqual(child.round_id, p.round_id);
  assert.ok(child.items.every((it) => !p.items.some((old) => old.id === it.id)));
  assert.equal(f.calls.filter((c) => c.url.pathname === '/api/round').length, 2);
  assert.equal(f.db.sqlite.prepare('SELECT SUM(rounds) AS n FROM player_days').get().n, 1);
  const allResponses = f.calls.filter((c) => c.url.hostname === 'hooks.slack.com');
  assert.ok(allResponses.every((c) => c.body.response_type === 'ephemeral'));
  assert.ok(Math.max(...Object.values(Object.groupBy(allResponses, (c) => c.url.href)).map((c) => c.length)) <= 2, 'fresh callback URL for each click, no reused 5-message allowance');
});

test('party: opt-in players share identical questions, private progress, public finished scores, fresh rematch while a friend is unfinished', async (t) => {
  const f = await fixture(t), p = await f.begin('party');
  const publicTap = (op, user = 'U1') => f.tap(`play:${op}:${p.id}`, { user, privateMessage: false });
  const posts = () => f.calls.filter((c) => c.url.pathname.endsWith('chat.postMessage'));
  assert.equal(posts().length, 1);
  assert.match(posts()[0].body.blocks, /Join shares your Slack display name and finished score/);
  assert.equal(f.env.DB.rows('SELECT * FROM play_players').length, 0);
  await publicTap('join'); await publicTap('join', 'U2'); await publicTap('join', 'U3');
  assert.ok(f.env.DB.rows('SELECT * FROM play_players').every((me) => me.step === 0));
  await f.finish(p, 'U1'); await f.finish(p, 'U2', true);
  await f.tap(`play:pick:${p.id}:0:0`, { user: 'U3' });
  await publicTap('board');
  const updates = f.calls.filter((c) => c.url.pathname.endsWith('chat.update'));
  const publicResult = updates.at(-1).body.blocks;
  assert.match(publicResult, /3 joined · 2 finished/);
  assert.match(publicResult, /840 points/); assert.match(publicResult, /-1560 points/);
  assert.doesNotMatch(publicResult, /Friend &lt;@everyone&gt; U3/);
  assert.ok(p.items.every((it) => !publicResult.includes(it.prompt)), 'no question or answer spoilers');
  const plays = f.db.sqlite.prepare('SELECT surface, score FROM round_plays ORDER BY score DESC').all();
  assert.deepEqual(plays.map((r) => [r.surface, r.score]), [['slack', 840], ['slack', -1560]]);
  await publicTap('rematch', 'U3');
  assert.equal((await store.get(f.env.DB, p.id)).next_id, null, 'unfinished players cannot restart the party');
  await publicTap('rematch'); await publicTap('rematch');
  const child = await store.get(f.env.DB, (await store.get(f.env.DB, p.id)).next_id);
  assert.ok(child.items.every((it) => !p.items.some((old) => old.id === it.id)));
  assert.equal(child.lobby_ts, p.lobby_ts);
  assert.equal(f.env.DB.rows('SELECT * FROM play_sessions').length, 2);
  await f.finish(p, 'U3'); // old private round remains usable after lobby changes
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 3);
  await publicTap('join', 'U2'); // delayed old Join converges on current rematch
  const childPlayers = f.env.DB.rows('SELECT * FROM play_players WHERE session_id = ?', child.id);
  assert.equal(childPlayers.length, 1); assert.equal(childPlayers[0].step, 0);
  const ids = f.calls.filter((c) => c.url.pathname.endsWith('/answer')).map((c) => c.body.anon_id);
  assert.equal(new Set(ids).size, 3);
  const rows = f.env.DB.rows('SELECT * FROM play_sessions');
  assert.ok(rows.every((r) => !JSON.stringify(r).includes('hooks.slack.com') && !JSON.stringify(r).includes('T1') && !JSON.stringify(r).includes('C1')));
});

test('signed ownership/scope checks reject other players, workspaces, channels, public answers and forged callbacks', async (t) => {
  const f = await fixture(t), p = await f.begin();
  await install(f.env, 'T2');
  const before = f.calls.filter((c) => c.url.hostname === 'api.test').length;
  for (const opts of [{ user: 'U2' }, { channel: 'C2' }, { team: 'T2' }, { privateMessage: false }, { badSignature: true }]) {
    const result = await f.tap(`play:conf:${p.id}:0:0:80`, opts);
    if (opts.badSignature) assert.equal(result.res.status, 401);
  }
  assert.equal(f.calls.filter((c) => c.url.hostname === 'api.test').length, before);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 0);
  await f.tap(`play:conf:${p.id}:0:0:99`);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 0);
});

test('API accepted an answer before network failure: retry uses first stored choice, no duplicate points; complete and rematch recover', async (t) => {
  const f = await fixture(t), p = await f.begin();
  let fail = true;
  f.hooks.afterApi = (call) => { if (fail && call.url.pathname.endsWith('/answer')) { fail = false; throw new Error('lost response'); } };
  const correct = bank.pairs.get(p.items[0].id).truth;
  await f.tap(`play:conf:${p.id}:0:${correct}:80`);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 0);
  await f.tap(`play:conf:${p.id}:0:${1 - correct}:100`);
  assert.equal(f.env.DB.rows('SELECT step, total FROM play_players')[0].total, 84);
  assert.match(f.last().text, /Right at 80%/);
  await f.tap(`play:next:${p.id}:1`);
  for (let step = 1; step < 10; step++) {
    await f.tap(`play:conf:${p.id}:${step}:${bank.pairs.get(p.items[step].id).truth}:80`);
    if (step < 9) await f.tap(`play:next:${p.id}:${step + 1}`);
  }
  fail = true;
  f.hooks.afterApi = (call) => { if (fail && call.url.pathname.endsWith('/complete')) { fail = false; throw new Error('lost completion response'); } };
  await f.tap(`play:next:${p.id}:10`);
  assert.equal(f.env.DB.rows('SELECT done FROM play_players')[0].done, null);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 1);
  await f.tap(`play:next:${p.id}:10`);
  assert.match(f.last().text, /840 points/);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 1);
  fail = true;
  f.hooks.beforeApi = (call) => { if (fail && call.url.pathname === '/api/round') { fail = false; throw new Error('temporary outage'); } };
  await f.tap(`play:replay:${p.id}`);
  const childId = (await store.get(f.env.DB, p.id)).next_id;
  assert.equal((await store.get(f.env.DB, childId)).round_id, null);
  await f.tap(`play:replay:${p.id}`);
  assert.ok((await store.get(f.env.DB, childId)).round_id);
  assert.equal(f.env.DB.rows('SELECT * FROM play_sessions').length, 2);
});

test('overlapping confidence taps serialize; ACK does not wait for a slow API', async (t) => {
  const f = await fixture(t), p = await f.begin();
  let release, reached;
  const waiting = new Promise((r) => { reached = r; });
  f.hooks.beforeApi = async (call) => { if (call.url.pathname.endsWith('/answer')) { reached(); await new Promise((r) => { release = r; }); } };
  const first = f.tap(`play:conf:${p.id}:0:0:80`);
  await waiting;
  await f.tap(`play:conf:${p.id}:0:1:100`);
  assert.match(f.last().text, /still saving/);
  assert.equal(f.last().replace_original, false, 'a busy notice must preserve the current picker for retry');
  await f.tap(`play:back:${p.id}:0`);
  assert.match(f.last().text, /still saving/);
  assert.equal(f.last().replace_original, false, 'changing the answer must not interrupt an in-flight confidence save');
  release(); await first;
  assert.equal(f.calls.filter((c) => c.url.pathname.endsWith('/answer')).length, 1);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 1);
  // The worker fetch resolves its acknowledgment before background API completion.
  let releaseReply;
  f.hooks.reply = () => new Promise((r) => { releaseReply = r; });
  const ctx = makeCtx();
  const ack = await worker.fetch(signedRequest(slashBody({ text: 'play', trigger_id: 'slow-command' })), f.env, ctx);
  assert.equal(ack.status, 200); assert.equal(await ack.text(), '');
  while (!releaseReply) await new Promise((r) => setImmediate(r));
  releaseReply(); await ctx.settle();
});

test('failed Slack lobby publish retries same round; expired sessions purge names/progress without affecting daily data', async (t) => {
  const f = await fixture(t);
  let fail = true;
  f.hooks.slack = (call) => { if (call.url.pathname.endsWith('chat.postMessage') && fail) { fail = false; throw new Error('Slack down'); } };
  const p = await f.begin('party');
  assert.equal(p.lobby_ts, null); assert.ok(p.round_id);
  await f.tap(`play:start:${p.id}`);
  const current = await store.get(f.env.DB, p.id);
  assert.ok(current.lobby_ts);
  assert.equal(f.calls.filter((c) => c.url.pathname === '/api/round').length, 1);
  await f.tap(`play:join:${p.id}`, { privateMessage: false });
  await f.env.DB.prepare('UPDATE play_sessions SET expires_at = ? WHERE id = ?').bind(Date.now() - 1, p.id).run();
  await f.tap(`play:conf:${p.id}:0:0:80`);
  assert.match(f.last().text, /expired/);
  await store.purge(f.env.DB, Date.now());
  assert.equal(f.env.DB.rows('SELECT * FROM play_players').length, 0);
  assert.equal(f.env.DB.rows('SELECT * FROM play_sessions').length, 0);
  assert.equal(f.env.DB.rows('SELECT * FROM installs').length, 1);
});

test('safe sources/challenge paths and unsupported settings cannot cause off-site links or mention injection', async () => {
  assert.equal(ui.challengeUrl('https://evil.test/c/round/token', 'round'), null);
  assert.equal(ui.challengeUrl('javascript:alert(1)', 'round'), null);
  assert.equal(ui.challengeUrl('https://whosbluffing.com/c/other/token', 'round'), null);
  assert.equal(ui.challengeUrl('https://bots.whosbluffing.com/c/round/token', 'round'), 'https://whosbluffing.com/c/round/token');
  assert.equal(ui.validSettings('space', 'normal'), false);
  const p = { id: '1'.repeat(32), items: [{ prompt: '<!channel>', a: '<@U1>', b: 'B' }] };
  const m = ui.feedback(p, { total: 84 }, 0, 0, 80, { correct: true, points: 84, truth: { a_value: '<script>', a_source: 'javascript:alert(1)', b_value: 'wrong', b_source: 'https://example.com/source' } });
  assert.doesNotMatch(JSON.stringify(m.blocks), /javascript:|<!channel>|<@U1>|<script>/);
  assert.match(JSON.stringify(m.blocks), /https:\/\/example.com\/source\|source/);
});

test('interrupted party child creation and public update recover to one shared rematch', async (t) => {
  const f = await fixture(t), p = await f.begin('party');
  await f.tap(`play:join:${p.id}`, { privateMessage: false });
  await f.finish(p);
  const prepare = f.env.DB.prepare.bind(f.env.DB);
  let fail = true;
  f.env.DB.prepare = (sql) => {
    if (sql.startsWith('INSERT OR IGNORE INTO play_sessions') && fail) { fail = false; throw new Error('interrupted child write'); }
    return prepare(sql);
  };
  await f.tap(`play:rematch:${p.id}`, { privateMessage: false });
  const nextId = (await store.get(f.env.DB, p.id)).next_id;
  assert.ok(nextId); assert.equal(await store.get(f.env.DB, nextId), null);
  let updateFails = true;
  f.hooks.slack = (call) => {
    if (call.url.pathname.endsWith('chat.update') && updateFails) { updateFails = false; return { ok: false, error: 'ratelimited' }; }
  };
  await f.tap(`play:rematch:${p.id}`, { privateMessage: false });
  assert.ok((await store.get(f.env.DB, nextId)).round_id);
  await f.tap(`play:rematch:${p.id}`, { privateMessage: false });
  assert.match(f.last().text, /rematch is ready/);
  assert.equal(f.env.DB.rows('SELECT * FROM play_sessions').length, 2);
  assert.equal(f.calls.filter((c) => c.url.pathname === '/api/round').length, 2);
});

test('a private source report requires an answered question and keeps the game controls', async (t) => {
  const f = await fixture(t), p = await f.begin();
  await f.tap(`play:flag:${p.id}:0:wrong`);
  assert.equal(f.calls.filter((c) => c.url.pathname === '/api/flag').length, 0);
  await f.tap(`play:conf:${p.id}:0:0:80`);
  await f.tap(`play:report:${p.id}:0`);
  assert.equal(f.last().replace_original, false);
  assert.ok(buttonIds(f.last()).includes(`play:flag:${p.id}:0:source`));
  await f.tap(`play:flag:${p.id}:0:source`);
  assert.match(f.last().text, /sent for review/);
  assert.equal(f.calls.filter((c) => c.url.pathname === '/api/flag').length, 1);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 1);
  await f.tap(`play:next:${p.id}:1`);
  assert.match(f.last().text, /Question 2 of 10/);
});

for (const kind of ['solo', 'party']) test(`${kind}: Change answer returns to the same unanswered question without sending or changing a score`, async (t) => {
  const f = await fixture(t), p = await f.begin(kind);
  if (kind === 'party') await f.tap(`play:join:${p.id}`, { privateMessage: false });
  const initial = f.last();
  await f.tap(`play:pick:${p.id}:0:0`);
  assert.ok(buttonIds(f.last()).includes(`play:back:${p.id}:0`));
  const changeButton = f.last().blocks.flatMap((b) => b.elements ?? []).find((b) => b.action_id === `play:back:${p.id}:0`);
  assert.equal(changeButton.text.text, 'Change answer');
  for (const opts of [{ user: 'U2' }, { channel: 'C2' }, { privateMessage: false }]) {
    await f.tap(`play:back:${p.id}:0`, opts);
    assert.equal(f.last().replace_original, false, 'an unauthorized or public callback leaves the game intact');
  }
  await f.tap(`play:back:${p.id}:0`);
  assert.equal(f.last().replace_original, true);
  assert.equal(f.last().text, initial.text);
  assert.deepEqual(buttonIds(f.last()), [`play:pick:${p.id}:0:0`, `play:pick:${p.id}:0:1`]);
  await f.tap(`play:back:${p.id}:0`); // repeated delivery does not progress or submit
  assert.equal(f.calls.filter((c) => c.url.pathname.endsWith('/answer')).length, 0);
  assert.deepEqual(f.env.DB.rows('SELECT step, total FROM play_players'), [{ step: 0, total: 0 }]);
  await f.tap(`play:pick:${p.id}:0:1`);
  await f.tap(`play:conf:${p.id}:0:1:80`);
  const feedback = f.last();
  const answers = f.calls.filter((c) => c.url.pathname.endsWith('/answer'));
  assert.equal(answers.length, 1);
  assert.equal(answers[0].body.choice, 1, 'only the replacement answer is submitted');
  await f.tap(`play:back:${p.id}:0`); // no changing a saved answer
  assert.deepEqual(f.last(), feedback);
  await f.tap(`play:next:${p.id}:1`);
  const second = f.last();
  await f.tap(`play:back:${p.id}:0`); // old button cannot rewind the next question
  assert.deepEqual(f.last(), second);
  assert.equal(f.env.DB.rows('SELECT step FROM play_players')[0].step, 1);
  assert.equal(f.calls.filter((c) => c.url.pathname.endsWith('/answer')).length, 1);
});
