import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import { anon, fakeD1, install, makeEnv, mockFetch, replies, send, signedRequest, slashBody } from './helpers.js';

test('day board: players, average, top 5 by hits, scoped to one workspace', async () => {
  const db = fakeD1();
  for (const [id, hits] of [['a', 2], ['b', 5], ['c', 4], ['d', 5], ['e', 1], ['f', 3]]) {
    await store.addScore(db, 'T1', id, '2026-10-31', hits);
  }
  await store.addScore(db, 'T2', 'z', '2026-10-31', 5);
  await store.addScore(db, 'T1', 'b', '2026-10-31', 0); // a repeat completion is ignored
  const board = await store.dayBoard(db, 'T1', '2026-10-31');
  assert.equal(board.players, 6);
  assert.equal(board.avg, 20 / 6);
  assert.deepEqual(board.top.map((r) => [r.anon_id, r.hits]), [['b', 5], ['d', 5], ['c', 4], ['f', 3], ['a', 2]]);
});

test('30-day board: top 10 by total hits, ties broken by more plays, old plays excluded', async () => {
  const db = fakeD1();
  const plays = { p: [5, 3], q: [3, 3, 2], r: [4, 5], s: [5] };
  let day = 10;
  for (const [id, list] of Object.entries(plays)) {
    for (const hits of list) await store.addScore(db, 'T1', id, `2026-10-${day++}`, hits);
  }
  await store.addScore(db, 'T1', 's', '2026-09-01', 5); // outside the window
  for (let i = 0; i < 12; i += 1) await store.addScore(db, 'T1', `x${i}`, '2026-10-30', 1);
  const board = await store.periodBoard(db, 'T1', '2026-10-02');
  assert.deepEqual(board.top.slice(0, 4).map((r) => [r.anon_id, r.hits, r.plays]), [['r', 9, 2], ['q', 8, 3], ['p', 8, 2], ['s', 5, 1]]);
  assert.equal(board.top.length, 10);
  assert.equal(board.players, 16);
  assert.equal(board.plays, 20);
});

test('/howsure stats posts the 30-day board in the channel; names only via channel members, never stored', async () => {
  const env = makeEnv();
  await install(env);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await store.addScore(env.DB, 'T1', anon('T1', 'U1'), today, 4);
  await store.addScore(env.DB, 'T1', anon('T1', 'U1'), yesterday, 3);
  await store.addScore(env.DB, 'T1', anon('T1', 'U2'), today, 5);
  await store.addScore(env.DB, 'T1', anon('T1', 'U3'), today, 1); // not in the channel
  const calls = mockFetch({
    slack: {
      'conversations.members': () => ({ members: ['U2', 'U9', 'U1'] }),
      'users.info': (c) => ({ user: { profile: { display_name: { U1: 'Maya', U2: 'Sam <b>' }[c.body.user] } } }),
    },
  });
  await send(env, signedRequest(slashBody({ text: 'stats' })));
  const [reply] = replies(calls);
  assert.equal(reply.body.response_type, 'in_channel');
  assert.equal(reply.body.text, [
    '*HowSure, last 30 days:* 3 members played 4 games.',
    '1. Maya — 7 hits in 2 plays',
    '2. Sam &lt;b&gt; — 5 hits in 1 play',
    '3. a teammate — 1 hit in 1 play',
  ].join('\n'));
  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM scores')).match(/U1|U2|Maya|Sam/));
});
