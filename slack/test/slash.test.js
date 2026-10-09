import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USAGE } from '../src/game.js';
import {
  DATE, QUESTION, apiCalls, at, clockToken, install, makeEnv, mockFetch, replies, send, signedRequest, slackCalls, slashBody,
} from './helpers.js';

const NOW = `${DATE}T09:30:00Z`;
const installs = (env) => env.DB.rows('SELECT channel_id, post_hour_utc, roast, reveal_delay_h FROM installs');
const NEW_YORK = -4 * 3600; // users.info tz_offset, seconds east of UTC (summer time)
const zone = (tzOffset) => ({ 'users.info': (c) => ({ user: { id: c.body.user, tz_offset: tzOffset } }) });
const REVEAL_8 = 'reveal the answer 8 hours later (change it with reveal N, 2 to 23)';

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
  // Posted before the 14:00 post hour: the reveal is still at 14:00 + 8 h, as a date token in each reader's own zone.
  assert.equal(blocks.at(-1).elements[0].text,
    'Tap A or B, then say how sure you are. Nobody sees your answer before the reveal: <!date^1793484000^{date_short_pretty} {time}|Oct 31 22:00 UTC>.');
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

test('/bluff setup #channel [HH] [roast on|off] [reveal N] and setup roast on|off; bad input shows usage', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env);
  let calls = mockFetch({ slack: zone(NEW_YORK) });
  await send(env, signedRequest(slashBody({ text: 'setup <#C9|general> 9' })));
  // 9 is 09:00 in the member's own zone (UTC-4), stored as 13 UTC.
  assert.deepEqual(installs(env), [{ channel_id: 'C9', post_hour_utc: 13, roast: 0, reveal_delay_h: null }]);
  assert.equal(slackCalls(calls, 'conversations.info')[0].body.channel, 'C9');
  assert.deepEqual(slackCalls(calls, 'users.info').map((c) => [c.body.user, c.headers.authorization]), [['U1', 'Bearer xoxb-T1']]);
  assert.equal(replies(calls)[0].body.text,
    `Done. Who's Bluffing will post the daily question in <#C9> every day at 09:00 your time (13:00 UTC) and ${REVEAL_8}. Roast mode is off.`);

  // Roast alone keeps the channel and hour, and checks neither the channel nor the time zone. The hour shows as UTC
  // and as a date token in the reader's own zone.
  calls = mockFetch({ slack: zone(NEW_YORK) });
  await send(env, signedRequest(slashBody({ text: 'setup roast ON' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C9', post_hour_utc: 13, roast: 1, reveal_delay_h: null }]);
  assert.equal(slackCalls(calls, 'conversations.info').length, 0);
  assert.equal(slackCalls(calls, 'users.info').length, 0);
  assert.equal(replies(calls)[0].body.text,
    `Done. Who's Bluffing will post the daily question in <#C9> every day at 13:00 UTC (${clockToken(`${DATE}T13:00:00Z`)} your time) ` +
    `and ${REVEAL_8}. Roast mode is on: the reveal names the biggest bluffer.`);
  assert.equal(clockToken(`${DATE}T13:00:00Z`), '<!date^1793451600^{time}|13:00 UTC>');

  // No hour: 14:00 UTC, no time zone lookup.
  await send(env, signedRequest(slashBody({ text: 'setup <#C8|> roast off' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0, reveal_delay_h: null }]);
  assert.equal(slackCalls(calls, 'users.info').length, 0);

  for (const text of ['setup <#C7|x> 24', 'setup', 'setup roast maybe', 'setup 9', 'setup 9 utc', 'setup <#C7|x> utc', 'unknown']) {
    const usage = await send(env, signedRequest(slashBody({ text })));
    const body = await usage.json();
    assert.match(body.text, /\/bluff setup #channel \[hour\] \[roast on\|off\] \[reveal N\]/, text);
    assert.match(body.text, /\/bluff reveal/);
  }
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0, reveal_delay_h: null }]);

  // A private channel the bot was not invited to is refused and nothing changes.
  calls = mockFetch({ slack: { 'conversations.info': () => ({ ok: false, error: 'channel_not_found' }) } });
  await send(env, signedRequest(slashBody({ text: 'setup <#G1|secret> 10 roast on' })));
  assert.match(replies(calls)[0].body.text, /invite me with \/invite @whosbluffing/);
  assert.deepEqual(installs(env), [{ channel_id: 'C8', post_hour_utc: 14, roast: 0, reveal_delay_h: null }]);
});

test("setup stores the UTC hour for the member's own hour: either side of UTC, past midnight, half-hour zones", async (t) => {
  at(t, NOW);
  for (const [tzOffset, typed, utcHour, mine] of [
    [NEW_YORK, 9, 13, '09:00'],
    [10 * 3600, 9, 23, '09:00'], // Sydney: 23:00 UTC the day before
    [-10 * 3600, 20, 6, '20:00'], // Honolulu: 06:00 UTC the next day
    [5.5 * 3600, 9, 3, '08:30'], // India: rounded down to the full UTC hour, and the reply says 08:30
    [0, 0, 0, '00:00'],
  ]) {
    const env = makeEnv();
    await install(env);
    const calls = mockFetch({ slack: zone(tzOffset) });
    await send(env, signedRequest(slashBody({ text: `setup <#C9|general> ${typed}` })));
    assert.equal(installs(env)[0].post_hour_utc, utcHour, `tz ${tzOffset}`);
    const text = replies(calls)[0].body.text;
    assert.ok(text.includes(` every day at ${mine} your time (${String(utcHour).padStart(2, '0')}:00 UTC) `), text);
  }
});

test('setup #channel 9 utc forces UTC: no time zone lookup', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env);
  const calls = mockFetch({ slack: zone(NEW_YORK) });
  await send(env, signedRequest(slashBody({ text: 'setup <#C9|general> 9 UTC reveal 12' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C9', post_hour_utc: 9, roast: 0, reveal_delay_h: 12 }]);
  assert.equal(slackCalls(calls, 'users.info').length, 0);
  assert.equal(replies(calls)[0].body.text,
    "Done. Who's Bluffing will post the daily question in <#C9> every day at 09:00 UTC (<!date^1793437200^{time}|09:00 UTC> your time) " +
    'and reveal the answer 12 hours later (change it with reveal N, 2 to 23). Roast mode is off.');
});

test("when Slack does not give the member's time zone, the hour is UTC and the reply says so", async (t) => {
  at(t, NOW);
  t.mock.method(console, 'error', () => {}); // the failed lookups are logged
  const failures = [
    () => ({ ok: false, error: 'user_not_found' }),
    () => ({ user: { id: 'U1' } }), // no tz_offset
    () => { throw new Error('network down'); },
  ];
  for (const usersInfo of failures) {
    const env = makeEnv();
    await install(env);
    const calls = mockFetch({ slack: { 'users.info': usersInfo } });
    await send(env, signedRequest(slashBody({ text: 'setup <#C9|general> 9' })));
    assert.equal(installs(env)[0].post_hour_utc, 9);
    assert.equal(replies(calls)[0].body.text,
      "Done. I couldn't read your time zone from Slack, so the hour is in UTC. Who's Bluffing will post the daily question in <#C9> " +
      `every day at 09:00 UTC (${clockToken(`${DATE}T09:00:00Z`)} your time) and ${REVEAL_8}. Roast mode is off.`);
  }
});

test('setup reveal N sets the hours from the post to the reveal (2 to 23), alone or with the rest; out of range shows usage', async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  const calls = mockFetch();
  await send(env, signedRequest(slashBody({ text: 'setup reveal 2' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C1', post_hour_utc: 14, roast: 0, reveal_delay_h: 2 }]);
  assert.equal(slackCalls(calls, 'users.info').length, 0);
  assert.match(replies(calls)[0].body.text, / reveal the answer 2 hours later /);
  await send(env, signedRequest(slashBody({ text: 'setup roast on reveal 23' })));
  assert.deepEqual(installs(env), [{ channel_id: 'C1', post_hour_utc: 14, roast: 1, reveal_delay_h: 23 }]);
  for (const text of ['setup reveal 1', 'setup reveal 24', 'setup reveal 0', 'setup <#C9|x> 9 reveal 99', 'setup reveal', 'setup reveal 12 roast on']) {
    const body = await (await send(env, signedRequest(slashBody({ text })))).json();
    assert.match(body.text, /reveal the answer N hours later \(2 to 23, default 8\)/, text);
  }
  assert.deepEqual(installs(env), [{ channel_id: 'C1', post_hour_utc: 14, roast: 1, reveal_delay_h: 23 }]);
});

test("the command list adds this workspace's schedule, in each reader's own time, once it has a channel", async (t) => {
  at(t, NOW);
  const env = makeEnv();
  await install(env);
  const calls = mockFetch();
  const usage = async () => (await (await send(env, signedRequest(slashBody({ text: 'help' })))).json()).text;
  assert.equal(await usage(), USAGE);
  await env.DB.prepare("UPDATE installs SET channel_id = 'C1', post_hour_utc = 13, reveal_delay_h = 20").run();
  assert.equal(await usage(), `${USAGE}\nThis workspace: a question in <#C1> every day at <!date^1793451600^{time}|13:00 UTC>, the answer 20 hours later.`);
  assert.equal(calls.length, 0); // answered at once, no Slack call
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
