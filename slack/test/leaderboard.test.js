import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import { anon, fakeD1, install, makeEnv, mockFetch, replies, send, signedRequest, slashBody } from './helpers.js';

// [anon, date, points]; every day revealed unless listed in `open`.
async function seed(db, team, rows, open = []) {
  for (const [id, date, points] of rows) {
    await store.claimPost(db, team, date, 'C1', '1.0');
    if (!open.includes(date)) await db.prepare('UPDATE posts SET revealed = 1 WHERE team_id = ? AND date = ?').bind(team, date).run();
    await store.saveAnswer(db, team, id, date, { choice: 0, conf: 90, correct: Number(points > 0), points });
  }
}

test('30-day board: top 10 by total points, ties by more answers, unrevealed and old days left out', async () => {
  const db = fakeD1();
  await seed(db, 'T1', [
    ['p', '2026-10-10', 96], ['p', '2026-10-11', 36],
    ['q', '2026-10-12', 96], ['q', '2026-10-13', 36], ['q', '2026-10-14', 0],
    ['r', '2026-10-15', 0], ['r', '2026-10-16', 96], ['r', '2026-10-17', 36],
    ['s', '2026-10-30', 100], ['s', '2026-10-31', 100], // Oct 31 is still open: it must not count
    ['s', '2026-09-01', 100], // outside the window
  ], ['2026-10-31']);
  for (let i = 0; i < 12; i += 1) await seed(db, 'T1', [[`x${i}`, '2026-10-20', 0]]);
  await seed(db, 'T2', [['z', '2026-10-20', 100]]);
  const board = await store.periodBoard(db, 'T1', '2026-10-02');
  assert.deepEqual(board.top.slice(0, 4).map((r) => [r.anon_id, r.points, r.answers]),
    [['q', 132, 3], ['r', 132, 3], ['p', 132, 2], ['s', 100, 1]]);
  assert.equal(board.top.length, 10);
  assert.equal(board.players, 16);
  assert.equal(board.answers, 21);
});

test('/howsure stats posts the 30-day board in the channel; names via channel members only; roast off hides negative totals', async () => {
  const env = makeEnv();
  await install(env);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await seed(env.DB, 'T1', [
    [anon('T1', 'U1'), today, 96], [anon('T1', 'U1'), yesterday, 64],
    [anon('T1', 'U2'), today, 100],
    [anon('T1', 'U3'), today, 36], // not in the channel
    [anon('T1', 'U4'), today, -300], // negative total
  ]);
  const calls = mockFetch({
    slack: {
      'conversations.members': () => ({ members: ['U2', 'U9', 'U1', 'U4'] }),
      'users.info': (c) => ({ user: { profile: { display_name: { U1: 'Maya', U2: 'Sam <b>', U4: 'Lee' }[c.body.user] } } }),
    },
  });
  await send(env, signedRequest(slashBody({ text: 'stats' })));
  const [reply] = replies(calls);
  assert.equal(reply.body.response_type, 'in_channel');
  assert.equal(reply.body.text, [
    '*HowSure, last 30 days:* 4 members gave 5 answers.',
    '1. Maya — 160 points in 2 answers',
    '2. Sam &lt;b&gt; — 100 points in 1 answer',
    '3. a teammate — 36 points in 1 answer',
  ].join('\n'));

  await env.DB.prepare('UPDATE installs SET roast = 1').run();
  await send(env, signedRequest(slashBody({ text: 'stats' })));
  assert.match(replies(calls).at(-1).body.text, /\n4\. Lee — -300 points in 1 answer$/);
  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM answers')).match(/U1|U2|Maya|Sam|Lee/));
});

test('/howsure stats with no revealed answers yet', async () => {
  const env = makeEnv();
  await install(env);
  const calls = mockFetch();
  await send(env, signedRequest(slashBody({ text: 'stats' })));
  assert.equal(replies(calls)[0].body.text, "No revealed answers in the last 30 days yet. Type /howsure to post today's question.");
});
