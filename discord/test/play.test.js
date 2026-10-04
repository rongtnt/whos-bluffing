import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLETE, GUILD, TRUTH, USER, anon, apiCalls, buttonPayload, commandPayload, community, fakeD1, followUps, makeEnv, mockFetch,
  originalEdits, send, signedRequest,
} from './helpers.js';

const press = (env, customId) => send(env, signedRequest(buttonPayload(customId)));
const lastEdit = (calls) => originalEdits(calls).at(-1).body;
const ids = (msg) => msg.components.flatMap((r) => r.components.map((b) => b.custom_id));
const labels = (msg) => msg.components.flatMap((r) => r.components.map((b) => b.label));

// Plays question k: A at 90% on even k (right, +96), B at 60% on odd k (wrong, -44).
async function answer(env, calls, round, k) {
  const choice = k % 2;
  const conf = choice ? 60 : 90;
  await press(env, `pa:${round}:${k}:${choice}`);
  await press(env, `pc:${round}:${k}:${choice}:${conf}`);
  return lastEdit(calls);
}

test('/howsure play: a private 10-question round in one message, from the first question to the challenge post', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  const start = await send(env, signedRequest(commandPayload('play')));
  assert.deepEqual(await start.json(), { type: 5, data: { flags: 64 } });
  assert.equal(apiCalls(calls, '/api/round')[0].url.search, '?mode=quick');
  let msg = lastEdit(calls);
  assert.equal(msg.content, '**HowSure quick round** · Question 1 of 10 · 0 points\nQuestion 1?');
  assert.deepEqual(labels(msg), ['A · Alpha 0', 'B · Beta 0']);
  assert.deepEqual(ids(msg), ['pa:r1:0:0', 'pa:r1:0:1']);

  // A/B -> confidence buttons, in place (type 6).
  const choose = await press(env, 'pa:r1:0:0');
  assert.deepEqual(await choose.json(), { type: 6 });
  msg = lastEdit(calls);
  assert.equal(msg.content, '**HowSure quick round** · Question 1 of 10 · 0 points\nQuestion 1?\nYou picked **A · Alpha 0**. How sure are you?');
  assert.deepEqual(ids(msg), [50, 60, 70, 80, 90, 100].map((c) => `pc:r1:0:0:${c}`));

  // Confidence -> the answer goes to the API; the reveal shows points, both values with sources, and Next.
  await press(env, 'pc:r1:0:0:90');
  const [first] = apiCalls(calls, '/api/round/answer');
  assert.deepEqual({ ...first.body, rt_ms: 0 }, {
    round_id: 'r1', item_id: 'i0', choice: 0, conf: 90, rt_ms: 0, anon_id: anon(GUILD, USER), community: community(GUILD), surface: 'discord',
  });
  assert.ok(Number.isInteger(first.body.rt_ms) && first.body.rt_ms >= 0);
  msg = lastEdit(calls);
  assert.equal(msg.content, [
    '**HowSure quick round** · Question 1 of 10',
    'Question 1?',
    'Right at 90%: **+96** · total 96 points',
    `✅ **A · Alpha 0**: 6,650 km ([source](<${TRUTH.a_source}>))`,
    `B · Beta 0: 2,850 km ([source](<${TRUTH.b_source}>))`,
  ].join('\n'));
  assert.deepEqual([ids(msg), labels(msg)], [['pn:r1:1'], ['Next']]);

  // A repeated confidence tap changes nothing and sends nothing.
  const before = calls.length;
  await press(env, 'pc:r1:0:0:90');
  assert.equal(calls.length, before);
  assert.equal(env.DB.rows('SELECT step, total FROM play_state')[0].step, 1);

  // Questions 2-10.
  for (let k = 1; k < 10; k += 1) {
    await press(env, `pn:r1:${k}`);
    assert.match(lastEdit(calls).content, new RegExp(`^\\*\\*HowSure quick round\\*\\* · Question ${k + 1} of 10 · `));
    msg = await answer(env, calls, 'r1', k);
  }
  assert.match(msg.content, /^\*\*HowSure quick round\*\* · Question 10 of 10\nQuestion 10\?\nWrong at 60%: \*\*-44\*\* · total 260 points\n/);
  assert.match(msg.content, /\n✅ \*\*A · Alpha 9\*\*: 6,650 km \(.*\)\nB · Beta 9: 2,850 km \(/);
  assert.deepEqual([ids(msg), labels(msg)], [['pn:r1:10'], ['See your score']]);
  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM play_state')).includes(USER), 'raw user id stored');

  // See your score -> complete with hashed ids -> score, type, roast, Play again and Challenge.
  await press(env, 'pn:r1:10');
  assert.deepEqual(apiCalls(calls, '/api/round/complete').map((c) => c.body), [
    { round_id: 'r1', anon_id: anon(GUILD, USER), community: community(GUILD), surface: 'discord' },
  ]);
  msg = lastEdit(calls);
  assert.equal(msg.content, [
    '**HowSure quick round** · **260 points**',
    'Bluffer: much more sure than right. 50% right at 75% sure.',
    'The Nile would like a word.',
    'Streak: 3 days.',
  ].join('\n'));
  assert.deepEqual([ids(msg), labels(msg)], [['pp', 'px:260:/c/r1/tok1234567'], ['Play again', 'Challenge']]);
  assert.equal(env.DB.rows('SELECT * FROM play_state').length, 0);

  // Challenge posts the link publicly under the player's display name, read from the press; nobody is pinged.
  const challenge = await press(env, 'px:260:/c/r1/tok1234567');
  assert.deepEqual(await challenge.json(), {
    type: 4,
    data: { allowed_mentions: { parse: [] }, content: `user${USER} scored 260 points in a HowSure round. Can you beat that? https://api.test/c/r1/tok1234567` },
  });
});

test('taps that land at the same moment count once: one answer, one edit, one finished round', async () => {
  const env = makeEnv(fakeD1({ readDelay: 10 }));
  const calls = mockFetch({ slow: 15 }); // slow reads and API answers make the two taps overlap
  await send(env, signedRequest(commandPayload('play')));
  await press(env, 'pa:r1:0:0');
  const edits = originalEdits(calls).length;
  await Promise.all([press(env, 'pc:r1:0:0:90'), press(env, 'pc:r1:0:0:90')]);
  assert.equal(originalEdits(calls).length, edits + 1);
  assert.deepEqual(env.DB.rows('SELECT step, total FROM play_state'), [{ step: 1, total: 96 }]);

  for (let k = 1; k < 10; k += 1) {
    await press(env, `pn:r1:${k}`);
    await answer(env, calls, 'r1', k);
  }
  await Promise.all([press(env, 'pn:r1:10'), press(env, 'pn:r1:10')]);
  assert.equal(apiCalls(calls, '/api/round/complete').length, 1);
});

test('a button from an older round says the round has ended; Play again starts a fresh round in place', async () => {
  const env = makeEnv();
  let n = 0;
  const calls = mockFetch({
    api: { '/api/round': () => ({ round_id: `r${(n += 1)}`, mode: 'quick', items: Array.from({ length: 10 }, (_, k) => ({ id: `i${k}`, prompt: `Q${k}?`, a: 'x', b: 'y' })) }) },
  });
  await send(env, signedRequest(commandPayload('play')));
  await press(env, 'pp');
  assert.deepEqual(ids(lastEdit(calls)), ['pa:r2:0:0', 'pa:r2:0:1']);

  await press(env, 'pa:r1:0:0');
  assert.deepEqual(lastEdit(calls), { allowed_mentions: { parse: [] }, content: 'This round has ended. Type /howsure play for a new one.', components: [] });
  assert.deepEqual(env.DB.rows('SELECT round_id, step FROM play_state'), [{ round_id: 'r2', step: 0 }]);
});

test('if the score cannot be fetched, the round stays finished-but-unscored and "See your score" works on retry', async () => {
  const env = makeEnv();
  let calls = mockFetch();
  await send(env, signedRequest(commandPayload('play')));
  for (let k = 0; k < 10; k += 1) {
    await answer(env, calls, 'r1', k);
    if (k < 9) await press(env, `pn:r1:${k + 1}`);
  }
  calls = mockFetch({ apiDown: true });
  await press(env, 'pn:r1:10');
  assert.equal(originalEdits(calls).length, 0);
  assert.equal(followUps(calls)[0].body.content, 'HowSure is taking a break, try again in a minute.');
  assert.equal(env.DB.rows('SELECT step FROM play_state')[0].step, 10);

  calls = mockFetch();
  await press(env, 'pn:r1:10');
  assert.equal(apiCalls(calls, '/api/round/complete').length, 1);
  assert.match(lastEdit(calls).content, new RegExp(`^\\*\\*HowSure quick round\\*\\* · \\*\\*${COMPLETE.score} points\\*\\*`));
});
