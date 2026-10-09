// Signed Discord interactions against the real rounds/scoring API and current question bank.
// Only Discord's message transport is mocked; both stores run their actual SQLite migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRounds, getRound, answer, complete } from '../../web/functions/_rounds.js';
import { compactPairs, serverPool } from '../../web/scripts/sync-items.js';
import { openD1 } from '../../web/test/d1.js';
import { esc } from '../src/game.js';
import {
  BOT_KEY, GUILD, USER, community, makeEnv, mockFetch, originalEdits,
  commandPayload, buttonPayload, signedRequest, send,
} from './helpers.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const data = loadRounds(serverPool(read('../../items/pool.json')), compactPairs(read('../../items/pairs.json')),
  read('../../daily/rounds.json'), { curated: read('../../items/quick_curated.json').items });
const users = [USER, '880000000000000002', '880000000000000003'];
const buttonIds = (message) => message.components.flatMap((row) => row.components.map((button) => button.custom_id));

for (const [context, pack, difficulty] of [[0, 'memes', 'normal'], [2, 'memes', 'normal'], [0, 'history', 'easy'], [2, 'elements', 'brutal']]) test(`real ${pack}/${difficulty} API: three friends, score dedup and fresh rematch in context ${context}`, async (t) => {
  const env = makeEnv();
  const db = openD1();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; db.sqlite.close(); });
  const lobbyId = '660000000000000099';
  let responseMessage = { id: '660000000000000098', flags: 64 };
  const calls = mockFetch({ discord: () => ({ body: responseMessage }) });
  const discordFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === 'discord.com') return discordFetch(input, init);
    assert.equal(url.hostname, 'api.test');
    assert.equal(init.headers['x-bluff-bot'], BOT_KEY);
    const body = init.body && JSON.parse(init.body);
    requests.push({ path: url.pathname, body, query: Object.fromEntries(url.searchParams) });
    let result;
    if (url.pathname === '/api/round') result = await getRound(db, data, Object.fromEntries(url.searchParams), new Date());
    else if (url.pathname === '/api/round/answer') result = await answer(db, data, body, new Date());
    else if (url.pathname === '/api/round/complete') result = await complete(db, data, body, new Date(), url.origin);
    else assert.fail(`Unexpected API route ${url.pathname}`);
    return Response.json(result.body, { status: result.status });
  };
  const installed = (payload) => {
    payload.context = context;
    // One installer; the two friends clicking Join have not installed the app.
    payload.authorizing_integration_owners = { '1': USER };
    payload.app_permissions = String((1n << 50n) | (1n << 11n) | (1n << 14n));
    payload.member.permissions = payload.app_permissions;
    if (context === 2) { payload.user = payload.member.user; delete payload.member; delete payload.guild_id; }
    return payload;
  };
  const press = async (id, user, { privateMessage = false, messageId = lobbyId } = {}) => {
    const payload = installed(buttonPayload(id, { user, messageId }));
    payload.message.flags = privateMessage ? 64 : 0;
    responseMessage = { id: messageId, flags: payload.message.flags };
    return send(env, signedRequest(payload));
  };
  const lastMessage = () => originalEdits(calls).at(-1).body;
  const start = installed(commandPayload('party'));
  const ack = await (await send(env, signedRequest(start))).json();
  assert.equal(ack.type, 5);
  assert.equal(ack.data.flags, 64, 'the settings picker is private');
  let picker = env.DB.rows('SELECT * FROM round_setups')[0];
  for (const [kind, value] of [['sp', pack], ['sd', difficulty]]) {
    const selection = installed(buttonPayload(`${kind}:${picker.id}:${picker.revision}`, { messageId: picker.message_id }));
    selection.message.flags = 64; selection.data.component_type = 3; selection.data.values = [value];
    await send(env, signedRequest(selection));
    picker = env.DB.rows('SELECT * FROM round_setups')[0];
  }
  const launch = installed(buttonPayload(`ss:${picker.id}:${picker.revision}:party`, { messageId: picker.message_id }));
  launch.message.flags = 64;
  responseMessage = { id: lobbyId, flags: 0 };
  const launched = await (await send(env, signedRequest(launch))).json();
  assert.ok(!(launched.data?.flags & 64), 'the lobby is public');
  const party = env.DB.rows('SELECT * FROM parties')[0];
  const items = JSON.parse(party.items);
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map((q) => q.id)).size, 10);
  assert.equal(party.pack, pack); assert.equal(party.difficulty, difficulty);
  if (pack === 'memes') assert.ok(items.every((q) => data.pairs.get(q.id)?.topic === 'memes'));
  assert.ok(items.every((q) => Object.keys(q).sort().join() === 'a,b,id,prompt'), 'no answer keys in lobby state');
  assert.deepEqual(requests[0].query, { mode: 'quick', pack, difficulty });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 0);

  for (const [n, user] of users.entries()) {
    const messageId = `66000000000000010${n}`;
    responseMessage = { id: messageId, flags: 64 };
    const join = installed(buttonPayload(`tj:${party.id}`, { user, messageId: lobbyId }));
    join.message.flags = 0;
    assert.deepEqual(await (await send(env, signedRequest(join))).json(), { type: 5, data: { flags: 64 } });
    const tap = (id) => press(id, user, { privateMessage: true, messageId });
    for (const [step, question] of items.entries()) {
      assert.ok(lastMessage().content.includes(esc(question.prompt)), `player ${n}, question ${step}`);
      const truth = data.pairs.get(question.id).truth;
      const choice = n === 0 || (n === 2 && step % 2 === 0) ? truth : 1 - truth;
      await tap(`ta:${party.id}:${step}:${choice}`);
      const confidence = `tc:${party.id}:${step}:${choice}:80`;
      assert.ok(buttonIds(lastMessage()).includes(confidence));
      await tap(confidence);
      // A repeated old confidence tap cannot change the answer or add points.
      await tap(`tc:${party.id}:${step}:${1 - choice}:100`);
      await tap(`tn:${party.id}:${step + 1}`);
    }
    assert.ok(lastMessage().content.includes(`${[840, -1560, -360][n]}`));
    await tap(`tn:${party.id}:10`); // duplicate completion
  }

  const answers = requests.filter((r) => r.path.endsWith('/answer'));
  assert.equal(answers.length, 30);
  const identities = [...new Set(answers.map((r) => r.body.anon_id))];
  assert.equal(identities.length, 3, 'clickers must not collapse into the installer identity');
  for (const id of identities) assert.deepEqual(answers.filter((r) => r.body.anon_id === id).map((r) => r.body.item_id), items.map((q) => q.id));
  const plays = db.sqlite.prepare('SELECT score, surface, community FROM round_plays ORDER BY score DESC').all();
  assert.deepEqual(plays.map((p) => p.score), [840, -360, -1560]);
  assert.ok(plays.every((p) => p.surface === 'discord' && p.community === (context === 0 ? community(GUILD) : null)));
  assert.equal(db.sqlite.prepare('SELECT SUM(rounds) AS n FROM player_days').get().n, 3);
  await press(`tr:${party.id}`, USER);
  assert.match(lastMessage().content, /3 joined · 3 finished/);
  assert.ok(items.every((q) => !lastMessage().content.includes(q.prompt)), 'public results contain no question spoilers');

  await press(`tm:${party.id}`, USER);
  const childId = env.DB.rows('SELECT next_id FROM parties WHERE id = ?', party.id)[0].next_id;
  const child = env.DB.rows('SELECT * FROM parties WHERE id = ?', childId)[0];
  assert.notEqual(child.round_id, party.round_id);
  assert.equal(child.pack, pack); assert.equal(child.difficulty, difficulty);
  const saved = db.sqlite.prepare('SELECT pack, difficulty FROM rounds WHERE round_id = ?').get(child.round_id);
  assert.deepEqual({ ...saved }, { pack, difficulty });
  assert.ok(JSON.parse(child.items).every((q) => !items.some((old) => old.id === q.id)), 'rematch excludes the previous ten');
  await press(`tm:${party.id}`, USER); // a delayed repeat must reuse the same rematch
  assert.equal(env.DB.rows('SELECT * FROM parties').length, 2);
  assert.equal(requests.filter((r) => r.path === '/api/round').length, 2);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM round_plays').get().n, 3, 'rematch creation is not a completion');
});

test('real solo History/Easy round and Play again preserve settings and exclude the previous ten', async (t) => {
  const env = makeEnv(); const db = openD1(); const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; db.sqlite.close(); });
  const calls = mockFetch(); const discordFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input); if (url.hostname === 'discord.com') return discordFetch(input, init);
    const body = init.body && JSON.parse(init.body); let r;
    requests.push({ path: url.pathname, body, query: Object.fromEntries(url.searchParams) });
    if (url.pathname === '/api/round') r = await getRound(db, data, Object.fromEntries(url.searchParams), new Date());
    else if (url.pathname === '/api/round/answer') r = await answer(db, data, body, new Date());
    else if (url.pathname === '/api/round/complete') r = await complete(db, data, body, new Date(), url.origin);
    else assert.fail(`Unexpected API route ${url.pathname}`);
    return Response.json(r.body, { status: r.status });
  };
  const tap = async (id, values) => {
    const p = buttonPayload(id, { messageId: '990000000000000001' }); p.message.flags = 64;
    if (values) { p.data.values = values; p.data.component_type = 3; }
    return send(env, signedRequest(p));
  };
  await send(env, signedRequest(commandPayload('play')));
  let s = env.DB.rows('SELECT * FROM round_setups')[0];
  await tap(`sp:${s.id}:0`, ['history']); await tap(`sd:${s.id}:1`, ['easy']); await tap(`ss:${s.id}:2:play`);
  const old = env.DB.rows('SELECT * FROM play_state')[0]; const items = JSON.parse(old.items);
  assert.deepEqual(requests[0].query, { mode: 'quick', pack: 'history', difficulty: 'easy' });
  for (const [k, q] of items.entries()) {
    await tap(`pc:${old.round_id}:${k}:${data.pairs.get(q.id).truth}:80`);
    assert.match(originalEdits(calls).at(-1).body.content, /source/);
    await tap(`pn:${old.round_id}:${k + 1}`);
  }
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM round_plays').get().n, 1);
  assert.match(originalEdits(calls).at(-1).body.content, /840 points/);
  await tap(`pp:${old.round_id}`); await tap(`pp:${old.round_id}`);
  const next = env.DB.rows('SELECT * FROM play_state')[0];
  assert.notEqual(next.round_id, old.round_id);
  assert.deepEqual([next.pack, next.difficulty], ['history', 'easy']);
  assert.ok(JSON.parse(next.items).every((q) => !items.some((old) => old.id === q.id)));
  assert.equal(requests.filter((r) => r.path === '/api/round').length, 2);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM round_plays').get().n, 1);
});
