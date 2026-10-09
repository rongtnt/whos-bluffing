import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME, channelHello, playEnd } from '../src/game.js';
import {
  COMPLETE, GUILD, TRUTH, USER, anon, apiCalls, buttonPayload, commandPayload, community, fakeD1, followUps, makeEnv, mockFetch,
  originalEdits, send, signedRequest,
} from './helpers.js';

const MESSAGE = '990000000000000001';
const press = (env, customId, who = {}, values) => {
  const p = buttonPayload(customId, { messageId: MESSAGE, ...who }); p.message.flags = 64;
  if (values) { p.data.values = values; p.data.component_type = 3; }
  return send(env, signedRequest(p));
};
const begin = async (env) => {
  const response = await send(env, signedRequest(commandPayload('play')));
  const s = env.DB.rows('SELECT * FROM round_setups').at(-1);
  await press(env, `ss:${s.id}:${s.revision}:play`);
  return response;
};
const lastEdit = (calls) => originalEdits(calls).at(-1).body;
const ids = (msg) => msg.components.flatMap((r) => r.components.map((b) => b.custom_id));
const labels = (msg) => msg.components.flatMap((r) => r.components.map((b) => b.label));

test('public Play now buttons start separate private rounds and report failures privately', async () => {
  const env = makeEnv();
  let calls = mockFetch();
  for (const [index, message] of [WELCOME, channelHello(14, Date.now())].entries()) {
    const user = String(BigInt(USER) + BigInt(index));
    const res = await send(env, signedRequest(buttonPayload(ids(message)[0], { user })));
    assert.deepEqual(await res.json(), { type: 5, data: { flags: 64 } });
    assert.match(lastEdit(calls).content, /Choose a topic and difficulty/);
  }
  assert.equal(env.DB.rows('SELECT * FROM round_setups').length, 2);
  assert.ok(calls.filter((c) => c.host === 'discord.com').every((c) =>
    c.method === 'PATCH' && c.path.endsWith('/messages/@original')));

  calls = mockFetch({ apiDown: true });
  const res = await press(env, 'start');
  assert.deepEqual(await res.json(), { type: 5, data: { flags: 64 } });
  assert.match(lastEdit(calls).content, /Choose a topic and difficulty/);
  assert.equal(followUps(calls).length, 0, 'resolve the private deferred reply on failure');
});

// Plays question k: A at 90% on even k (right, +96), B at 60% on odd k (wrong, -44).
async function answer(env, calls, round, k) {
  const choice = k % 2;
  const conf = choice ? 60 : 90;
  await press(env, `pa:${round}:${k}:${choice}`);
  await press(env, `pc:${round}:${k}:${choice}:${conf}`);
  return lastEdit(calls);
}

test('/bluff play: a private 10-question round in one message, from the first question to the challenge post', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  const start = await begin(env);
  assert.deepEqual(await start.json(), { type: 5, data: { flags: 64 } });
  assert.equal(apiCalls(calls, '/api/round')[0].url.search, '?mode=quick&pack=all&difficulty=normal');
  let msg = lastEdit(calls);
  assert.equal(msg.content, "**Who's Bluffing? quick round** · Question 1 of 10 · 0 points\nQuestion 1?");
  assert.deepEqual(labels(msg), ['A · Alpha 0', 'B · Beta 0']);
  assert.deepEqual(ids(msg), ['pa:r1:0:0', 'pa:r1:0:1']);

  // A/B -> confidence buttons, in place (type 6).
  const choose = await press(env, 'pa:r1:0:0');
  assert.deepEqual(await choose.json(), { type: 6 });
  msg = lastEdit(calls);
  assert.equal(msg.content, "**Who's Bluffing? quick round** · Question 1 of 10 · 0 points\nQuestion 1?\nYou picked **A · Alpha 0**. Say how sure you are.");
  assert.deepEqual(ids(msg), [...[50, 60, 70, 80, 90, 100].map((c) => `pc:r1:0:0:${c}`), 'pb:r1:0']);

  // Confidence -> the answer goes to the API; the reveal shows points, both values with sources, and Next.
  await press(env, 'pc:r1:0:0:90');
  const [first] = apiCalls(calls, '/api/round/answer');
  assert.deepEqual({ ...first.body, rt_ms: 0 }, {
    round_id: 'r1', item_id: 'i0', choice: 0, conf: 90, rt_ms: 0, anon_id: anon(GUILD, USER), community: community(GUILD), surface: 'discord',
  });
  assert.ok(Number.isInteger(first.body.rt_ms) && first.body.rt_ms >= 0);
  msg = lastEdit(calls);
  assert.equal(msg.content, [
    "**Who's Bluffing? quick round** · Question 1 of 10",
    'Question 1?',
    'Right at 90%: **+96** · total 96 points',
    `✅ **A · Alpha 0**: 6,650 km ([source](<${TRUTH.a_source}>))`,
    `B · Beta 0: 2,850 km ([source](<${TRUTH.b_source}>))`,
  ].join('\n'));
  assert.deepEqual([ids(msg), labels(msg)], [['pn:r1:1', 'pf:r1:0'], ['Next', 'Report question']]);

  // A repeated confidence tap changes nothing and sends nothing.
  const before = apiCalls(calls, '/api/round/answer').length;
  await press(env, 'pc:r1:0:0:90');
  assert.equal(apiCalls(calls, '/api/round/answer').length, before);
  assert.equal(env.DB.rows('SELECT step, total FROM play_state')[0].step, 1);

  // Questions 2-10.
  for (let k = 1; k < 10; k += 1) {
    await press(env, `pn:r1:${k}`);
    assert.match(lastEdit(calls).content, new RegExp(`^\\*\\*Who's Bluffing\\? quick round\\*\\* · Question ${k + 1} of 10 · `));
    msg = await answer(env, calls, 'r1', k);
  }
  assert.match(msg.content, /^\*\*Who's Bluffing\? quick round\*\* · Question 10 of 10\nQuestion 10\?\nWrong at 60%: \*\*-44\*\* · total 260 points\n/);
  assert.match(msg.content, /\n✅ \*\*A · Alpha 9\*\*: 6,650 km \(.*\)\nB · Beta 9: 2,850 km \(/);
  assert.deepEqual([ids(msg), labels(msg)], [['pn:r1:10', 'pf:r1:9'], ['See your score', 'Report question']]);
  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM play_state')).includes(USER), 'raw user id stored');

  // See your score -> complete with hashed ids -> score, type, roast, Play again and Challenge.
  await press(env, 'pn:r1:10');
  assert.deepEqual(apiCalls(calls, '/api/round/complete').map((c) => c.body), [
    { round_id: 'r1', anon_id: anon(GUILD, USER), community: community(GUILD), surface: 'discord' },
  ]);
  msg = lastEdit(calls);
  assert.equal(msg.content, [
    "**Who's Bluffing? quick round** · **260 points**",
    'Bluffer',
    '50% right at 75% sure.',
    'The Nile would like a word.',
    'Streak: 3 days.',
  ].join('\n'));
  assert.deepEqual([ids(msg), labels(msg)], [['pp:r1', 'px:r1', undefined], ['Play again', 'Challenge', 'Add to your server']]); // the third button is the install link (no custom_id)
  assert.equal(env.DB.rows('SELECT * FROM play_state').length, 1);

  // Challenge posts the link publicly under the player's display name, read from the press; nobody is pinged.
  const challenge = await press(env, 'px:r1');
  assert.deepEqual(await challenge.json(), { type: 5, data: {} });
  assert.deepEqual(lastEdit(calls), { allowed_mentions: { parse: [] }, content: `user${USER} scored 260 points in a Who's Bluffing round. Can you beat that? https://api.test/c/r1/tok1234567` });
});

test('the end screen matches the short web type names without explanatory sentences', () => {
  const typeLine = (type) => playEnd({ ...COMPLETE, type, roast: null, streak: 1 }, null).content.split('\n')[1];
  assert.deepEqual(['Bluffer', 'Hot-headed', 'Calibrated', 'Modest', 'Hedger', 'constructor'].map(typeLine),
    ['Bluffer', 'Too sure', 'Spot on', 'Too modest', 'Playing it safe', 'constructor']);
});

test('taps that land at the same moment count once: one answer, one edit, one finished round', async () => {
  const env = makeEnv(fakeD1({ readDelay: 10 }));
  const calls = mockFetch({ slow: 15 }); // slow reads and API answers make the two taps overlap
  await begin(env);
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

test('old round controls cannot erase a newer round in the same message', async () => {
  const env = makeEnv(); let n = 0;
  const calls = mockFetch({ api: { '/api/round': () => ({ round_id: `r${++n}`, items: Array.from({length:10}, (_, k) => ({ id:`i${k}`, prompt:'Q?', a:'x', b:'y' })) }) } });
  await begin(env); await begin(env);
  const edits = originalEdits(calls).length;
  await press(env, 'pa:r1:0:0'); await press(env, 'pp:r1');
  assert.equal(originalEdits(calls).length, edits + 1);
  assert.equal(env.DB.rows('SELECT round_id FROM play_state')[0].round_id, 'r2');
});

test('if the score cannot be fetched, the round stays finished-but-unscored and "See your score" works on retry', async () => {
  const env = makeEnv();
  let calls = mockFetch();
  await begin(env);
  for (let k = 0; k < 10; k += 1) {
    await answer(env, calls, 'r1', k);
    if (k < 9) await press(env, `pn:r1:${k + 1}`);
  }
  calls = mockFetch({ apiDown: true });
  await press(env, 'pn:r1:10');
  assert.equal(originalEdits(calls).length, 0);
  assert.equal(followUps(calls)[0].body.content, "Who's Bluffing is taking a break, try again in a minute.");
  assert.equal(env.DB.rows('SELECT step FROM play_state')[0].step, 10);

  calls = mockFetch();
  await press(env, 'pn:r1:10');
  assert.equal(apiCalls(calls, '/api/round/complete').length, 1);
  assert.match(lastEdit(calls).content, new RegExp(`^\\*\\*Who's Bluffing\\? quick round\\*\\* · \\*\\*${COMPLETE.score} points\\*\\*`));
});
