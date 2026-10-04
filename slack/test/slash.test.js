import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATE, QUESTION, apiCalls, at, install, makeEnv, mockFetch, replies, send, signedRequest, slackCalls, slashBody } from './helpers.js';

const NOW = `${DATE}T09:30:00Z`;
const installs = (env) => env.DB.rows('SELECT channel_id, post_hour_utc, roast FROM installs');

test("/bluff posts today's question with A and B buttons; in the chosen channel it becomes the day's post", async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  const res = await send(env, signedRequest(slashBody()));
  assert.equal(res.status, 200);
  const [post] = slackCalls(calls, 'chat.postMessage');
  assert.equal(post.body.channel, 'C1');
  assert.equal(post.headers.authorization, 'Bearer xoxb-T1');
  assert.equal(post.body.text, "Who's Bluffing? · Which is longer: the Nile or the Danube?");
  const blocks = JSON.parse(post.body.blocks);
  assert.deepEqual(blocks.find((b) => b.type === 'actions').elements.map((b) => b.text.text), ['A · the Nile', 'B · the Danube']);
  // Posted before the 14:00 post hour: the reveal is still at 14:00 + 8 h.
  assert.match(blocks.at(-1).elements[0].text, /before the reveal at 22:00 UTC\.$/);
  assert.equal(apiCalls(calls, '/api/round/daily-question')[0].query.date, DATE);
  assert.deepEqual(env.DB.rows('SELECT team_id, date, channel_id, ts, revealed FROM posts'),
    [{ team_id: 'T1', date: DATE, channel_id: 'C1', ts: '1700000000.000100', revealed: 0 }]);
  assert.deepEqual(env.DB.rows('SELECT item_id, prompt, a, b FROM posts'),
    [{ item_id: QUESTION.item_id, prompt: QUESTION.prompt, a: QUESTION.a, b: QUESTION.b }]);

  // A second /bluff there does not post the question twice.
  await send(env, signedRequest(slashBody()));
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 1);
  assert.equal(replies(calls).at(-1).body.text, "Today's question is already up in this channel.");
});

test('/bluff in another channel posts a copy there that is not the tracked post', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  await send(env, signedRequest(slashBody({ channel_id: 'C5' })));
  assert.equal(slackCalls(calls, 'chat.postMessage')[0].body.channel, 'C5');
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0);
});

test('/bluff with no chosen channel tracks the post, so it still gets a reveal', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env);
  mockFetch();
  await send(env, signedRequest(slashBody({ channel_id: 'C5' })));
  assert.deepEqual(env.DB.rows('SELECT channel_id FROM posts'), [{ channel_id: 'C5' }]);
});

test('/bluff after the day was revealed posts nothing and says so privately', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  await env.DB.prepare("INSERT INTO posts (team_id, date, channel_id, ts, revealed) VALUES ('T1', ?, 'C1', '1.0', 1)").bind(DATE).run();
  const calls = mockFetch();
  await send(env, signedRequest(slashBody()));
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  assert.equal(replies(calls)[0].body.text, "Today's answer is already out. A new question comes tomorrow.");
});

test('/bluff with the API down: private "taking a break" reply, nothing posted', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env);
  const calls = mockFetch({ apiDown: true });
  await send(env, signedRequest(slashBody()));
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  const [reply] = replies(calls);
  assert.equal(reply.body.text, "Who's Bluffing is taking a break, try again in a minute.");
  assert.equal(reply.body.response_type, 'ephemeral');
});

test('/bluff setup #channel [HH] [roast on|off] and setup roast on|off; bad input shows usage', async () => {
  const env = makeEnv();
  await install(env);
  let calls = mockFetch();
  await send(env, signedRequest(slashBody({ text: 'setup <#C9|general> 9' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C9', post_hour_utc: 9, roast: 0 }]);
  assert.equal(slackCalls(calls, 'conversations.info')[0].body.channel, 'C9');
  assert.equal(replies(calls)[0].body.text,
    "Done. Who's Bluffing will post the daily question in <#C9> every day at 09:00 UTC and reveal the answer 8 hours later. Roast mode is off.");

  // Roast alone keeps the channel and hour, and checks no channel.
  calls = mockFetch();
  await send(env, signedRequest(slashBody({ text: 'setup roast ON' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C9', post_hour_utc: 9, roast: 1 }]);
  assert.equal(slackCalls(calls, 'conversations.info').length, 0);
  assert.match(replies(calls)[0].body.text, /Roast mode is on: the reveal names the biggest bluffer\.$/);

  await send(env, signedRequest(slashBody({ text: 'setup <#C8|> roast off' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0 }]);

  for (const text of ['setup <#C7|x> 24', 'setup', 'setup roast maybe', 'setup 9', 'play']) {
    const usage = await send(env, signedRequest(slashBody({ text })));
    const body = await usage.json();
    assert.match(body.text, /\/bluff setup #channel \[hour\] \[roast on\|off\]/, text);
    assert.match(body.text, /\/bluff reveal/);
  }
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0 }]);

  // A private channel the bot was not invited to is refused and nothing changes.
  calls = mockFetch({ slack: { 'conversations.info': () => ({ ok: false, error: 'channel_not_found' }) } });
  await send(env, signedRequest(slashBody({ text: 'setup <#G1|secret> 10 roast on' })));
  assert.match(replies(calls)[0].body.text, /invite me with \/invite @whosbluffing/);
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0 }]);
});

test('without BOT_KEY the API is never called: private "taking a break", nothing posted', async (t) => {
  at(t, NOW);
  const env = { ...makeEnv(), BOT_KEY: undefined };
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  await send(env, signedRequest(slashBody()));
  assert.equal(calls.filter((c) => c.host === 'api.test').length, 0);
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  assert.equal(replies(calls)[0].body.text, "Who's Bluffing is taking a break, try again in a minute.");
});

test('a workspace with no install row is told to reinstall', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  await send(env, signedRequest(slashBody()));
  assert.match(replies(calls)[0].body.text, /isn't installed/);
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
});
