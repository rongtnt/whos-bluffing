import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, install, makeEnv, mockFetch, replies, send, signedRequest, slackCalls, slashBody } from './helpers.js';

test("/howsure posts today's game with a Play button in the current channel", async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  const res = await send(env, signedRequest(slashBody()));
  assert.equal(res.status, 200);
  const posts = slackCalls(calls, 'chat.postMessage');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.channel, 'C1');
  assert.equal(posts[0].headers.authorization, 'Bearer xoxb-T1');
  assert.equal(posts[0].body.text, "HowSure #12 — 5 questions, give a range you're 90% sure about. Today's average so far: 2.8/5.");
  const blocks = JSON.parse(posts[0].body.blocks);
  assert.ok(blocks.some((b) => b.type === 'actions' && b.elements[0].action_id === 'play' && b.elements[0].text.text === 'Play'));
  // Posted in the chosen channel: it becomes today's post, so the cron will not post a second one.
  assert.deepEqual(env.DB.rows('SELECT team_id, date, ts FROM posts'), [{ team_id: 'T1', date: DAY.date, ts: '1700000000.000100' }]);
});

test('/howsure in another channel posts there and does not become the tracked daily post', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  await send(env, signedRequest(slashBody({ channel_id: 'C5' })));
  assert.equal(slackCalls(calls, 'chat.postMessage')[0].body.channel, 'C5');
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0);
});

test('/howsure with the daily API down: private "taking a break" reply, nothing posted', async () => {
  const env = makeEnv();
  await install(env);
  const calls = mockFetch({ apiDown: true });
  await send(env, signedRequest(slashBody()));
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  const [reply] = replies(calls);
  assert.equal(reply.body.text, 'HowSure is taking a break, try again in a minute.');
  assert.equal(reply.body.response_type, 'ephemeral');
});

test('/howsure setup #channel [HH] stores channel and UTC hour (default 14); bad input shows usage', async () => {
  const env = makeEnv();
  await install(env);
  let calls = mockFetch();
  await send(env, signedRequest(slashBody({ text: 'setup <#C9|general> 9' })));
  assert.deepEqual(env.DB.rows('SELECT channel_id, post_hour_utc FROM installs'), [{ channel_id: 'C9', post_hour_utc: 9 }]);
  assert.equal(slackCalls(calls, 'conversations.info')[0].body.channel, 'C9');
  assert.match(replies(calls)[0].body.text, /<#C9> every day at 09:00 UTC/);

  await send(env, signedRequest(slashBody({ text: 'setup <#C8|>' })));
  assert.deepEqual(env.DB.rows('SELECT channel_id, post_hour_utc FROM installs'), [{ channel_id: 'C8', post_hour_utc: 14 }]);

  const usage = await send(env, signedRequest(slashBody({ text: 'setup <#C7|x> 24' })));
  assert.match((await usage.json()).text, /\/howsure setup #channel \[hour\]/);

  // A private channel the bot was not invited to is refused and nothing changes.
  calls = mockFetch({ slack: { 'conversations.info': () => ({ ok: false, error: 'channel_not_found' }) } });
  await send(env, signedRequest(slashBody({ text: 'setup <#G1|secret> 10' })));
  assert.match(replies(calls)[0].body.text, /invite me with \/invite @HowSure/);
  assert.deepEqual(env.DB.rows('SELECT channel_id, post_hour_utc FROM installs'), [{ channel_id: 'C8', post_hour_utc: 14 }]);
});

test('a workspace with no install row is told to reinstall', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  await send(env, signedRequest(slashBody()));
  assert.match(replies(calls)[0].body.text, /isn't installed/);
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
});
