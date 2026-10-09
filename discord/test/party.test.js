import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as partyStore from '../src/party-store.js';
import { partyLobby } from '../src/game.js';
import {
  CHANNEL, GUILD, USER, anon, apiCalls, buttonPayload, commandPayload, fakeD1, followUps, freeze,
  channelPosts, install, makeEnv, mockFetch, originalEdits, roundItems, runCron, send, signedRequest,
} from './helpers.js';

const SECOND = '880000000000000002';
const OTHER_CHANNEL = '660000000000000002';
const PUBLIC = String((1n << 11n) | (1n << 50n));
let seq = 0;

function fixture({ slow = 0, readDelay = 0, api = {}, forcePrivate = false } = {}) {
  const env = makeEnv(fakeD1({ readDelay }));
  const replies = new Map();
  let rounds = 0;
  const calls = mockFetch({ slow, api: {
    '/api/round': () => ({ round_id: `r${++rounds}`, items: roundItems() }), ...api,
  }, discord: (c) => {
    if (c.method === 'PATCH' && c.path.endsWith('/messages/@original')) return { body: replies.get(c.path.split('/')[5]) };
  } });
  async function run(payload) {
    const publicStart = payload.type === 3 && payload.data.custom_id.startsWith('ss:') && payload.data.custom_id.endsWith(':party');
    const publicEdit = publicStart || payload.type === 3 && ['tr', 'tm'].includes(payload.data.custom_id.split(':')[0]);
    const join = payload.type === 3 && payload.data.custom_id.startsWith('tj:');
    replies.set(payload.token, {
      id: payload.type === 3 && !join && !publicStart ? payload.message.id : String(990000000000000000n + BigInt(++seq)),
      flags: forcePrivate || !publicEdit ? 64 : 0,
    });
    return send(env, signedRequest(payload));
  }
  const payload = (p, { dm = false, userOnly = false, name = 'Sam' } = {}) => {
    p.member.user.global_name = name;
    if (dm) {
      p.user = p.member.user;
      delete p.member;
      delete p.guild_id;
      p.context = 2;
    }
    p.authorizing_integration_owners = dm || userOnly ? { 1: USER } : { 0: GUILD };
    return p;
  };
  const start = async (who = {}) => {
    const p = payload(commandPayload('party', [], { ...who, permissions: who.permissions ?? PUBLIC }), who);
    p.id = String(1800000000000000000n + BigInt(++seq));
    const response = await run(p);
    const s = env.DB.rows('SELECT * FROM round_setups').at(-1);
    if (!s) return { id: p.id, response, request: p };
    const startResponse = await click(`ss:${s.id}:${s.revision}:party`, { ...who, messageId: s.message_id, flags: 64 });
    return { id: s.id, response: startResponse, request: p };
  };
  const click = async (custom, who = {}) => {
    const p = payload(buttonPayload(custom, { ...who, permissions: who.permissions ?? PUBLIC }), who);
    p.message.flags = who.flags ?? 0;
    return run(p);
  };
  const publicClick = async (id, kind = 'tj', who = {}) => {
    const p = await partyStore.get(env.DB, id);
    return click(`${kind}:${id}`, { messageId: p.message_id, ...who });
  };
  const player = async (id, who = {}) => partyStore.player(env.DB, id, anon(who.dm ? `dm:${who.channel ?? CHANNEL}` : GUILD, who.user ?? USER));
  const privateClick = async (id, kind, tail = '', who = {}) => click(`${kind}:${id}${tail}`, {
    ...who, flags: 64, messageId: (await player(id, who)).message_id,
  });
  const finish = async (id, who = {}) => {
    for (let k = (await player(id, who)).step; k < 10; k++) {
      await privateClick(id, 'tc', `:${k}:0:90`, who);
      await privateClick(id, 'tn', `:${k + 1}`, who);
    }
  };
  return { env, calls, start, run, click, publicClick, privateClick, player, finish };
}

test('personal install redirect has commands only; personal users cannot invoke server bot features', async () => {
  const f = fixture();
  const res = await send(f.env, new Request('https://worker.test/install?type=user'));
  const url = new URL(res.headers.get('location'));
  assert.deepEqual(Object.fromEntries(url.searchParams), { client_id: '424242', scope: 'applications.commands', integration_type: '1' });
  for (const sub of ['question', 'stats', 'setup', 'reveal']) {
    const p = commandPayload(sub, [], { permissions: String(1 << 3) });
    p.authorizing_integration_owners = { 1: USER };
    const result = await (await f.run(p)).json();
    assert.equal(result.data.flags, 64);
    assert.match(result.data.content, /need a server install/);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.env.DB.rows('SELECT * FROM installs').length, 0);
});

test('personal party respects channel permissions and detects Discord-forced private responses', async () => {
  let f = fixture();
  const denied = await f.start({ userOnly: true, permissions: '2048' });
  assert.equal((await denied.response.json()).data.flags, 64);
  assert.equal(apiCalls(f.calls, '/api/round').length, 0);
  f = fixture({ forcePrivate: true });
  const p = await f.start({ userOnly: true });
  assert.equal((await partyStore.get(f.env.DB, p.id)).message_id, null);
  assert.match(originalEdits(f.calls).at(-1).body.content, /only allows private app replies/);
  assert.deepEqual(originalEdits(f.calls).at(-1).body.components, []);
});

test('Join is private, resumes one participant, stores only opted-in names, and binds chat + message', async () => {
  const f = fixture();
  const { id } = await f.start({ userOnly: true });
  const joined = await f.publicClick(id, 'tj', { userOnly: true, name: '**Sam**\n@everyone' });
  assert.deepEqual(await joined.json(), { type: 5, data: { flags: 64 } });
  assert.equal(apiCalls(f.calls, '/api/round').length, 1);
  assert.equal(apiCalls(f.calls, '/api/round/answer').length, 0);
  assert.equal(apiCalls(f.calls, '/api/round/complete').length, 0);
  const p = await f.player(id);
  assert.equal(p.name, '**Sam**@everyone');
  assert.equal(f.env.DB.rows('SELECT * FROM installs').length, 0);
  assert.ok(!JSON.stringify(f.env.DB.rows('SELECT * FROM party_players')).includes(USER));
  await f.privateClick(id, 'tc', ':0:0:90', { userOnly: true });
  await f.publicClick(id, 'tj', { userOnly: true });
  assert.equal((await f.player(id)).step, 1);
  assert.match(originalEdits(f.calls).at(-1).body.content, /Right at 90%/);
  await f.publicClick(id, 'tr', { userOnly: true });
  const lobby = originalEdits(f.calls).at(-1).body;
  assert.ok(!/Question 1\?|Right at|Alpha|@everyone/.test(lobby.content));
  assert.deepEqual(lobby.allowed_mentions, { parse: [] });
  const before = apiCalls(f.calls, '/api/round/answer').length;
  await f.publicClick(id, 'tj', { userOnly: true, channel: OTHER_CHANNEL });
  await f.click(`tj:${id}`, { userOnly: true, messageId: 'bogus-message' });
  await f.click(`tc:${id}:1:0:90`, { userOnly: true, flags: 64, messageId: p.message_id, user: SECOND });
  await f.privateClick(id, 'tn', ':1', { userOnly: true });
  await f.privateClick(id, 'tc', ':1:7:90', { userOnly: true });
  await f.privateClick(id, 'tc', ':1:0:999', { userOnly: true });
  assert.equal(apiCalls(f.calls, '/api/round/answer').length, before);
});

test('concurrent joins and answers count once; failed answer/complete can retry', async () => {
  let answerFailures = 1;
  let completeFailures = 1;
  const f = fixture({ readDelay: 2, slow: 2, api: {
    '/api/round/answer': (c) => answerFailures-- > 0 ? new Response('{}', { status: 503 }) : {
      choice: c.body.choice, conf: c.body.conf, correct: true, points: 96, total: (Number(c.body.item_id.slice(1)) + 1) * 96,
      truth: { a_value: 2, b_value: 1, unit: 'items' },
    },
    '/api/round/complete': () => completeFailures-- > 0 ? new Response('{}', { status: 503 }) : { score: 960, accuracy: 100, mean_conf: 90, type: 'Modest' },
  } });
  const { id } = await f.start();
  await Promise.all([f.publicClick(id), f.publicClick(id), f.publicClick(id, 'tj', { user: SECOND })]);
  assert.equal(f.env.DB.rows('SELECT * FROM party_players').length, 2);
  assert.equal(new Set(f.env.DB.rows('SELECT seat FROM party_players').map((p) => p.seat)).size, 2);
  await f.privateClick(id, 'tc', ':0:0:90');
  assert.equal((await f.player(id)).step, 0);
  await Promise.all([f.privateClick(id, 'tc', ':0:0:90'), f.privateClick(id, 'tc', ':0:1:60')]);
  assert.equal((await f.player(id)).step, 1);
  assert.equal(apiCalls(f.calls, '/api/round/answer').length, 2);
  await f.privateClick(id, 'tn', ':1');
  await f.finish(id);
  assert.equal((await f.player(id)).step, 10);
  assert.equal((await f.player(id)).done, null);
  await Promise.all([f.privateClick(id, 'tn', ':10'), f.privateClick(id, 'tn', ':10')]);
  assert.equal((await f.player(id)).done.score, 960);
  assert.equal(apiCalls(f.calls, '/api/round/complete').length, 2);
  await f.publicClick(id);
  assert.match(originalEdits(f.calls).at(-1).body.content, /960 points/);
  assert.equal((await f.player(id)).step, 10);
});

test('one fresh rematch survives concurrent presses and does not interrupt unfinished friends', async () => {
  const f = fixture({ readDelay: 2, slow: 2 });
  const { id } = await f.start({ dm: true });
  await f.publicClick(id, 'tj', { dm: true });
  await f.publicClick(id, 'tj', { dm: true, user: SECOND });
  await f.publicClick(id, 'tm', { dm: true, user: SECOND });
  assert.equal((await partyStore.get(f.env.DB, id)).next_id, null);
  await f.finish(id, { dm: true });
  await Promise.all([f.publicClick(id, 'tm', { dm: true }), f.publicClick(id, 'tm', { dm: true })]);
  const parent = await partyStore.get(f.env.DB, id);
  const child = await partyStore.get(f.env.DB, parent.next_id);
  assert.equal(apiCalls(f.calls, '/api/round').length, 2);
  assert.equal(apiCalls(f.calls, '/api/round').at(-1).url.searchParams.get('rematch'), parent.round_id);
  assert.notEqual(child.round_id, parent.round_id);
  await f.privateClick(id, 'tc', ':0:1:60', { dm: true, user: SECOND });
  assert.equal((await f.player(id, { dm: true, user: SECOND })).step, 1);
  await f.publicClick(id, 'tj', { dm: true, user: SECOND });
  assert.equal(f.env.DB.rows('SELECT * FROM party_players').length, 2, 'stale parent Join cannot create a child participant');
  await f.publicClick(child.id, 'tj', { dm: true });
  assert.equal((await f.player(child.id, { dm: true })).step, 0);
  assert.ok(apiCalls(f.calls, '/api/round/answer').every((c) => c.body.community === null));
  assert.equal(f.env.DB.rows('SELECT * FROM installs').length, 0);
});

test('expiry rejects every party action immediately; hourly cleanup removes names, progress and old solo state', async (t) => {
  freeze(t, '2026-10-08T12:00:00Z');
  const f = fixture();
  const { id } = await f.start();
  await f.publicClick(id);
  await f.env.DB.prepare('INSERT INTO play_state (anon_id, round_id, items, step, total, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('old-solo', 'r0', '[]', 0, 0, Date.now()).run();
  t.mock.timers.tick(partyStore.LIFETIME + 1);
  const before = apiCalls(f.calls, '/api/round/answer').length;
  await f.privateClick(id, 'tc', ':0:0:90');
  await f.publicClick(id, 'tr');
  assert.equal(apiCalls(f.calls, '/api/round/answer').length, before);
  assert.match(followUps(f.calls).at(-1).body.content, /party has ended/);
  await runCron(f.env, new Date().toISOString());
  assert.equal(f.env.DB.rows('SELECT * FROM party_players').length, 0);
  assert.equal(f.env.DB.rows('SELECT * FROM parties').length, 0);
  assert.equal(f.env.DB.rows('SELECT * FROM play_state').length, 0);
});

test('public scoreboard bounds long escaped names and never pings', () => {
  const msg = partyLobby({ id: 'test', expires_at: Date.now() }, {
    joined: 100, finished: 100, top: Array.from({ length: 10 }, (_, i) => ({ name: '@'.repeat(32), score: -3000, seat: i })),
  });
  assert.ok(msg.content.length <= 2000);
  assert.deepEqual(msg.allowed_mentions, { parse: [] });
  assert.match(msg.content, /Top 10 of 100/);
});

test('a cleanup failure does not prevent existing scheduled daily posts', async () => {
  const f = fixture();
  await install(f.env, GUILD, { channel: CHANNEL, hour: 14 });
  const prepare = f.env.DB.prepare;
  f.env.DB.prepare = (sql) => {
    if (sql.startsWith('DELETE FROM party_players')) throw new Error('cleanup unavailable');
    return prepare(sql);
  };
  await runCron(f.env, '2026-10-06T14:00:00Z');
  assert.equal(channelPosts(f.calls).length, 1);
});

test('personal solo play uses the clicker, isolates private chats and rejects expired state', async (t) => {
  freeze(t, '2026-10-08T12:00:00Z');
  const f = fixture();
  const dm = (p) => {
    p.user = p.member.user;
    delete p.member;
    delete p.guild_id;
    p.authorizing_integration_owners = { 1: SECOND };
    return p;
  };
  await f.run(dm(commandPayload('play')));
  let s = f.env.DB.rows('SELECT * FROM round_setups').at(-1);
  let start = dm(buttonPayload(`ss:${s.id}:0:play`, { messageId: s.message_id })); start.message.flags = 64;
  await f.run(start);
  await f.run(dm(commandPayload('play', [], { channel: OTHER_CHANNEL })));
  s = f.env.DB.rows('SELECT * FROM round_setups').at(-1);
  start = dm(buttonPayload(`ss:${s.id}:0:play`, { messageId: s.message_id, channel: OTHER_CHANNEL })); start.message.flags = 64;
  await f.run(start);
  assert.equal(f.env.DB.rows('SELECT * FROM play_state').length, 2);
  let p = dm(buttonPayload('pc:r1:0:0:90', { messageId: f.env.DB.rows('SELECT message_id FROM play_state WHERE round_id = ?', 'r1')[0].message_id })); p.message.flags = 64;
  await f.run(p);
  const body = apiCalls(f.calls, '/api/round/answer')[0].body;
  assert.equal(body.anon_id, anon(`dm:${CHANNEL}`, USER));
  assert.equal(body.community, null);
  t.mock.timers.tick(partyStore.LIFETIME + 1);
  await f.run(dm(buttonPayload('pc:r2:0:0:90', { channel: OTHER_CHANNEL })));
  assert.equal(apiCalls(f.calls, '/api/round/answer').length, 1);
  assert.match(followUps(f.calls).at(-1).body.content, /round has ended/);
});
