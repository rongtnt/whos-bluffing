import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAnswer, apiCalls, channelOfPost, channelPosts, install, makeEnv, messageEdits, mockFetch, runCron,
} from './helpers.js';

const [G1, G2, G3, G4] = ['770000000000000011', '770000000000000012', '770000000000000013', '770000000000000014'];
const [C1, C2, C3] = ['660000000000000011', '660000000000000012', '660000000000000013'];
const questionPosts = (calls) => channelPosts(calls).filter((c) => c.body.content.startsWith('**HowSure** · '));
const posted = (calls) => questionPosts(calls).map(channelOfPost).sort();

test('posts the daily question once per server per day, as soon as its UTC hour has come', async () => {
  const env = makeEnv();
  await install(env, G1, { channel: C1, hour: 14 });
  await install(env, G2, { channel: C2, hour: 9 });
  await install(env, G3, { channel: C3, hour: 20 });
  await install(env, G4); // no channel chosen yet
  const calls = mockFetch();

  await runCron(env, '2026-10-06T14:00:00Z');
  await runCron(env, '2026-10-06T14:00:00Z'); // the same trigger twice
  await runCron(env, '2026-10-06T15:00:00Z');
  assert.deepEqual(posted(calls), [C1, C2]);
  const [post] = questionPosts(calls);
  assert.equal(post.headers.authorization, 'Bot bot-token');
  assert.match(post.headers['user-agent'], /^DiscordBot \(https:\/\/api\.test, 0\.1\)$/);
  assert.equal(post.body.content, '**HowSure** · Which is longer: the Nile or the Danube?\n-# Tap A or B, then say how sure you are. Answer at 22:00 UTC.');
  assert.deepEqual(post.body.components[0].components.map((b) => [b.label, b.custom_id]), [
    ['A · the Nile', 'q:2026-10-06:dq-2026-10-06:p00042:0'],
    ['B · the Danube', 'q:2026-10-06:dq-2026-10-06:p00042:1'],
  ]);
  assert.deepEqual(post.body.allowed_mentions, { parse: [] });

  await runCron(env, '2026-10-06T20:00:00Z');
  assert.deepEqual(posted(calls), [C1, C2, C3]);
  assert.deepEqual(env.DB.rows('SELECT guild_id, message_id, reveal_at FROM posts ORDER BY guild_id'), [
    { guild_id: G1, message_id: '9001', reveal_at: '2026-10-06T22:00:00.000Z' },
    { guild_id: G2, message_id: '9001', reveal_at: '2026-10-06T22:00:00.000Z' },
    { guild_id: G3, message_id: '9001', reveal_at: '2026-10-07T04:00:00.000Z' },
  ]);

  await runCron(env, '2026-10-07T23:00:00Z'); // next day: everyone once more
  assert.equal(questionPosts(calls).length, 6);
});

test('reveals each post once, at the first tick after post time + 8 hours', async () => {
  const env = makeEnv();
  await install(env, G1, { channel: C1, hour: 14 });
  const calls = mockFetch();
  await runCron(env, '2026-10-06T14:00:00Z');
  await runCron(env, '2026-10-06T21:00:00Z');
  assert.equal(messageEdits(calls).length, 0);
  await runCron(env, '2026-10-06T22:00:00Z');
  await runCron(env, '2026-10-06T22:00:00Z');
  await runCron(env, '2026-10-06T23:00:00Z');
  assert.deepEqual(messageEdits(calls).map((c) => c.path), [`/api/v10/channels/${C1}/messages/9001`]);
  assert.match(messageEdits(calls)[0].body.content, /^\*\*HowSure\*\* · Which is longer: the Nile or the Danube\?\n/);
  assert.deepEqual(env.DB.rows('SELECT revealed, prompt, a, b FROM posts'), [
    { revealed: 1, prompt: 'Which is longer: the Nile or the Danube?', a: 'the Nile', b: 'the Danube' },
  ]);
  // The reveal draws on the question stored with the post: daily-question only serves today and yesterday.
  assert.equal(apiCalls(calls, '/api/round/daily-question').length, 1);
});

test('API down claims nothing; a failed post retries next hour; a lost channel stops posting', async () => {
  const env = makeEnv();
  await install(env, G1, { channel: C1 });
  await install(env, G2, { channel: C2 });

  let calls = mockFetch({ apiDown: true });
  await runCron(env, '2026-10-06T14:00:00Z');
  assert.equal(channelPosts(calls).length, 0);
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0);

  let rateLimited = true;
  calls = mockFetch({
    discord: (c) => {
      if (c.method !== 'POST') return undefined;
      if (channelOfPost(c) === C2) return { status: 403, body: { code: 50001 } };
      return rateLimited ? { status: 429, body: { retry_after: 1 } } : undefined;
    },
  });
  await runCron(env, '2026-10-06T15:00:00Z');
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0); // claims released
  assert.deepEqual(env.DB.rows('SELECT guild_id, channel_id FROM installs ORDER BY guild_id'), [
    { guild_id: G1, channel_id: C1 },
    { guild_id: G2, channel_id: null },
  ]);

  rateLimited = false;
  await runCron(env, '2026-10-06T16:00:00Z');
  assert.deepEqual(env.DB.rows('SELECT guild_id, message_id FROM posts'), [{ guild_id: G1, message_id: '9001' }]);
});

test('Monday recap: once per server at its hour, before the question; skipped when nobody answered last week', async () => {
  const env = makeEnv();
  await install(env, G1, { channel: C1, hour: 14 });
  await install(env, G2, { channel: C2, hour: 14 });
  const [MAYA, SAM, LEE] = ['880000000000000021', '880000000000000022', '880000000000000023'];
  const week = [
    [MAYA, '2026-10-06', 0, 90], [MAYA, '2026-10-07', 0, 80], [MAYA, '2026-10-08', 1, 70], [MAYA, '2026-10-09', 0, 90],
    [SAM, '2026-10-06', 1, 100], [SAM, '2026-10-10', 1, 90], [SAM, '2026-10-11', 0, 60],
    [LEE, '2026-10-07', 0, 50], [LEE, '2026-10-11', 1, 50],
    [MAYA, '2026-10-04', 0, 90], // before the week: counts only for the streak lookback
    [SAM, '2026-10-12', 1, 100], // the recap day itself: not in last week
  ];
  for (const [user, date, choice, conf] of week) await addAnswer(env, { guild: G1, user, date, choice, conf });
  const calls = mockFetch({
    discord: (c) => (c.path.endsWith('/members') ? { body: [{ user: { id: MAYA, username: 'maya', global_name: 'Maya' } }] } : undefined),
  });

  await runCron(env, '2026-10-12T13:00:00Z'); // Monday, before the hour
  assert.equal(channelPosts(calls).length, 0);
  await runCron(env, '2026-10-12T14:00:00Z');
  await runCron(env, '2026-10-12T15:00:00Z');

  const recaps = channelPosts(calls).filter((c) => c.body.content.startsWith('**HowSure · last week'));
  assert.equal(recaps.length, 1);
  assert.equal(channelOfPost(recaps[0]), C1);
  assert.equal(recaps[0].body.content, [
    '**HowSure · last week in this server**',
    '9 answers from 3 members. Streak: 6 days in a row.',
    '50% sure: right 50% of the time (2 answers)',
    '60% sure: right 100% of the time (1 answer)',
    '70% sure: right 0% of the time (1 answer)',
    '80% sure: right 100% of the time (1 answer)',
    '90% sure: right 67% of the time (3 answers)',
    '100% sure: right 0% of the time (1 answer)',
    'Most calibrated: Maya, 75% right at 83% sure.',
    'Bluffs (80%+ sure and wrong): 2',
  ].join('\n'));
  assert.deepEqual(channelPosts(calls).map((c) => [channelOfPost(c), c.body.content.slice(0, 12)]), [
    [C1, '**HowSure · '], [C1, '**HowSure** '], [C2, '**HowSure** '],
  ]);
  assert.deepEqual(env.DB.rows('SELECT guild_id, last_recap FROM installs ORDER BY guild_id'), [
    { guild_id: G1, last_recap: '2026-10-12' },
    { guild_id: G2, last_recap: '2026-10-12' },
  ]);

  await runCron(env, '2026-10-13T14:00:00Z'); // Tuesday: questions only
  assert.equal(channelPosts(calls).filter((c) => c.body.content.startsWith('**HowSure · last week')).length, 1);
});
