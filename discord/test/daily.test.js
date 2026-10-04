import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNEL, DATE, GUILD, QUESTION, USER, addPost, anon, apiCalls, buttonPayload, community, followUps, install,
  makeEnv, mockFetch, originalEdits, send, signedRequest, snowflake,
} from './helpers.js';

const qId = (choice) => `q:${DATE}:${QUESTION.round_id}:${QUESTION.item_id}:${choice}`;
const cId = (choice, conf) => `c:${DATE}:${QUESTION.round_id}:${QUESTION.item_id}:${choice}:${conf}`;

async function postedToday(env, extra = {}) {
  await install(env, GUILD, { channel: CHANNEL });
  await addPost(env, extra);
}

// A confidence tap made `ms` after the picker appeared.
const tapAfter = (customId, ms) => {
  const shown = Date.now() - ms;
  return buttonPayload(customId, { messageId: snowflake(shown), at: shown + ms });
};

test('tapping B on the daily post answers at once with a private confidence picker (no I/O)', async () => {
  const calls = mockFetch();
  const res = await send(makeEnv(), signedRequest(buttonPayload(qId(1))));
  const body = await res.json();
  assert.equal(body.type, 4);
  assert.equal(body.data.flags, 64);
  assert.equal(body.data.content, 'You picked **B**. How sure are you?');
  const buttons = body.data.components.flatMap((r) => r.components);
  assert.deepEqual(buttons.map((b) => b.label), ['50% · coin flip', '60%', '70%', '80%', '90%', '100% · stake it all']);
  assert.deepEqual(buttons.map((b) => b.custom_id), [50, 60, 70, 80, 90, 100].map((c) => cId(1, c)));
  assert.deepEqual(body.data.allowed_mentions, { parse: [] });
  assert.equal(calls.length, 0);
});

test('a confidence tap defers, sends the hashed answer to the API, stores it, and edits the picker into "Locked in"', async () => {
  const env = makeEnv();
  await postedToday(env);
  const calls = mockFetch();
  const res = await send(env, signedRequest(tapAfter(cId(1, 80), 4000)));
  assert.deepEqual(await res.json(), { type: 6 });

  const [answer] = apiCalls(calls, '/api/round/answer');
  assert.deepEqual(answer.body, {
    round_id: 'dq-2026-10-06', item_id: 'p00042', choice: 1, conf: 80, rt_ms: 4000,
    anon_id: anon(GUILD, USER), community: community(GUILD), surface: 'discord',
  });
  assert.ok(!JSON.stringify(calls.filter((c) => c.host === 'api.test')).includes(USER), 'raw user id reached the API');

  const [edit] = originalEdits(calls);
  assert.match(edit.path, /^\/api\/v10\/webhooks\/424242\/token-\d+\/messages\/@original$/);
  assert.deepEqual(edit.body, { allowed_mentions: { parse: [] }, content: 'Locked in: B at 80%. Reveal at 22:00 UTC.', components: [] });

  assert.deepEqual(env.DB.rows('SELECT guild_id, anon_id, date, choice, conf, points, correct FROM answers'), [
    { guild_id: GUILD, anon_id: anon(GUILD, USER), date: DATE, choice: 1, conf: 80, points: -156, correct: 0 },
  ]);
});

test('changing your mind before the reveal sends revision: true and replaces the stored answer', async () => {
  const env = makeEnv();
  await postedToday(env);
  const calls = mockFetch();
  await send(env, signedRequest(tapAfter(cId(1, 80), 3000)));
  await send(env, signedRequest(tapAfter(cId(0, 60), 2000)));

  const [first, second] = apiCalls(calls, '/api/round/answer');
  assert.equal(first.body.revision, undefined);
  assert.equal(second.body.revision, true);
  assert.deepEqual([second.body.choice, second.body.conf], [0, 60]);
  assert.deepEqual(env.DB.rows('SELECT choice, conf, points, correct FROM answers'), [{ choice: 0, conf: 60, points: 36, correct: 1 }]);
  assert.equal(originalEdits(calls).at(-1).body.content, 'Locked in: A at 60%. Reveal at 22:00 UTC.');
});

test('after the reveal a confidence tap is refused without calling the API', async () => {
  const env = makeEnv();
  await postedToday(env, { revealed: 1 });
  const calls = mockFetch();
  await send(env, signedRequest(tapAfter(cId(0, 90), 1000)));
  assert.equal(apiCalls(calls, '/api/round/answer').length, 0);
  assert.equal(originalEdits(calls)[0].body.content, 'Too late: answers for this question are closed.');
  assert.equal(env.DB.rows('SELECT * FROM answers').length, 0);
});

test('409 locked from the API: the earlier answer stands ("Already locked in"); with none it is too late', async () => {
  const env = makeEnv();
  await postedToday(env);
  let calls = mockFetch();
  await send(env, signedRequest(tapAfter(cId(1, 80), 2000)));

  const locked = () => Response.json({ error: 'locked' }, { status: 409 });
  calls = mockFetch({ api: { '/api/round/answer': locked } });
  await send(env, signedRequest(tapAfter(cId(0, 100), 1000)));
  assert.equal(apiCalls(calls, '/api/round/answer')[0].body.revision, true);
  assert.equal(originalEdits(calls)[0].body.content, 'Already locked in: B at 80%. Reveal at 22:00 UTC.');
  assert.deepEqual(env.DB.rows('SELECT choice, conf FROM answers'), [{ choice: 1, conf: 80 }]);

  await send(env, signedRequest(buttonPayload(cId(0, 100), { user: '880000000000000002' })));
  assert.equal(originalEdits(calls)[1].body.content, 'Too late: answers for this question are closed.');
  assert.equal(env.DB.rows('SELECT * FROM answers').length, 1);
});

test('API down: the picker stays for another try and a private "taking a break" follow-up is sent', async () => {
  const env = makeEnv();
  await postedToday(env);
  const calls = mockFetch({ apiDown: true });
  await send(env, signedRequest(tapAfter(cId(0, 90), 1000)));
  assert.equal(originalEdits(calls).length, 0);
  assert.deepEqual(followUps(calls)[0].body, {
    allowed_mentions: { parse: [] }, flags: 64, content: 'HowSure is taking a break, try again in a minute.',
  });
  assert.equal(env.DB.rows('SELECT * FROM answers').length, 0);
});
