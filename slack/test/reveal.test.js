import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import {
  BOT_KEY, DATE, QUESTION, REVEAL, SALT, anon, apiCalls, at, install, makeEnv, mockFetch, replies, send, sha256, signedRequest,
  slackCalls, slashBody, tsAt,
} from './helpers.js';

const POST_TS = tsAt(`${DATE}T14:00:02Z`);
const NAMES = { U1: 'Maya', U5: 'Kim', U7: 'Sam', U8: 'Lee' };

// Today's post in C1 (with its stored question) and five answers, not yet scored. U9 is not in the channel, so it
// can't be named.
async function setup({ roast = 0 } = {}) {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', roast });
  await store.claimPost(env.DB, 'T1', DATE, 'C1', QUESTION, POST_TS);
  for (const [user, choice, conf] of [['U1', 0, 90], ['U7', 1, 90], ['U8', 0, 60], ['U9', 0, 70], ['U5', 1, 50]]) {
    await store.saveAnswer(env.DB, 'T1', anon('T1', user), DATE, { choice, conf });
  }
  return env;
}

const bluffer = { anon_id: anon('T1', 'U7'), conf: 90, choice: 1 };
const mocks = (reveal) => ({
  slack: {
    'conversations.members': () => ({ members: ['U5', 'U7', 'U8', 'U1', 'U2'] }),
    'users.info': (c) => ({ user: { id: c.body.user, profile: { display_name: NAMES[c.body.user] } } }),
  },
  api: { '/api/round/reveal': () => reveal },
});
const updatedText = (calls) => JSON.parse(slackCalls(calls, 'chat.update')[0].body.blocks)[0].text.text;

test('reveal, roast off: the post becomes the answer with values and sources, counts, named points, an anonymous bluff line', async (t) => {
  at(t, `${DATE}T16:00:00Z`);
  const env = await setup();
  const calls = mockFetch(mocks({ ...REVEAL, n: 5, pct_a: 60, pct_b: 40, biggest_bluff: bluffer }));
  await send(env, signedRequest(slashBody({ text: 'reveal', user_id: 'U2' })));
  assert.equal(apiCalls(calls, '/api/round/daily-question').length, 0, 'the reveal uses the question stored with the post');

  const [update] = slackCalls(calls, 'chat.update');
  assert.deepEqual([update.body.channel, update.body.ts, update.headers.authorization], ['C1', POST_TS, 'Bearer xoxb-T1']);
  const blocks = JSON.parse(update.body.blocks);
  assert.ok(!blocks.some((b) => b.type === 'actions'), 'the revealed post keeps no buttons');
  assert.match(blocks.at(-1).elements[0].text, /whosbluffing\.com\/slack/, 'the reveal ends with the install line');
  assert.equal(updatedText(calls), [
    "*Who's Bluffing?* · Which is longer: the Nile or the Danube?",
    '*Answer: A, the Nile.* the Nile: 6,650 km (<https://www.wikidata.org/wiki/Q3392|source>) · the Danube: 2,850 km (<https://www.wikidata.org/wiki/Q1653|source>)',
    '5 answered · 60% A · 40% B',
    '*Points:* 1. Maya +96 · 2. a teammate +64 · 3. Lee +36',
    "Someone was 90% sure it was B (the Danube). It wasn't.",
  ].join('\n'));
  assert.equal(update.body.text, updatedText(calls));

  // Roast off: the bluffer's name is never looked up; nobody is named next to zero or negative points.
  assert.deepEqual(slackCalls(calls, 'users.info').map((c) => c.body.user).sort(), ['U1', 'U8']);
  const [revealCall] = apiCalls(calls, '/api/round/reveal');
  assert.deepEqual(revealCall.query, { date: DATE, community: `slack:${sha256(`T1:${SALT}`)}` });
  assert.equal(revealCall.headers['x-bluff-bot'], BOT_KEY);
  // Points come from the revealed answer (A) by the contract's formula.
  const scored = env.DB.rows('SELECT anon_id, correct, points FROM answers');
  const byUser = (user) => scored.find((row) => row.anon_id === anon('T1', user));
  assert.deepEqual(['U1', 'U7', 'U8', 'U9', 'U5'].map((u) => [byUser(u).correct, byUser(u).points]), [[1, 96], [0, -224], [1, 36], [1, 64], [0, 0]]);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 1 }]);
  assert.equal(replies(calls)[0].body.text, 'Revealed in <#C1>.');
  assert.equal(replies(calls)[0].body.response_type, 'ephemeral');
});

test('reveal, roast on: names the biggest bluffer and shows everyone in the top 5', async (t) => {
  at(t, `${DATE}T16:00:00Z`);
  const env = await setup({ roast: 1 });
  const calls = mockFetch(mocks({ ...REVEAL, a_source: undefined, b_source: undefined, n: 5, pct_a: 60, pct_b: 40, biggest_bluff: bluffer }));
  await send(env, signedRequest(slashBody({ text: 'reveal' })));
  const lines = updatedText(calls).split('\n');
  assert.equal(lines[1], '*Answer: A, the Nile.* the Nile: 6,650 km · the Danube: 2,850 km'); // a reveal without sources still renders
  assert.equal(lines[3], '*Points:* 1. Maya +96 · 2. a teammate +64 · 3. Lee +36 · 4. Kim 0 · 5. Sam -224');
  assert.equal(lines[4], "Sam was 90% sure it was B (the Danube). It wasn't.");
});

test('reveal happens once; a bluff line only for a wrong answer at 80% or more; nobody answered', async (t) => {
  at(t, `${DATE}T16:00:00Z`);
  const env = await setup();
  let calls = mockFetch(mocks({ ...REVEAL, biggest_bluff: { anon_id: anon('T1', 'U9'), conf: 70, choice: 1 } }));
  await send(env, signedRequest(slashBody({ text: 'reveal' })));
  assert.equal(updatedText(calls).split('\n').length, 4, 'a wrong 70% is no bluff');
  await send(env, signedRequest(slashBody({ text: 'reveal' })));
  assert.equal(slackCalls(calls, 'chat.update').length, 1);
  assert.equal(replies(calls).at(-1).body.text, "Today's answer is already out. A new question comes tomorrow.");

  // A "bluff" that picked the right answer is no bluff either.
  const right = await setup();
  calls = mockFetch(mocks({ ...REVEAL, biggest_bluff: { anon_id: anon('T1', 'U1'), conf: 100, choice: 0 } }));
  await send(right, signedRequest(slashBody({ text: 'reveal' })));
  assert.ok(!updatedText(calls).includes('sure it was'));

  const quiet = makeEnv();
  await install(quiet, 'T1', { channel: 'C1' });
  await store.claimPost(quiet.DB, 'T1', DATE, 'C1', QUESTION, POST_TS);
  calls = mockFetch(mocks({ ...REVEAL, n: 0, pct_a: 0, pct_b: 0 }));
  await send(quiet, signedRequest(slashBody({ text: 'reveal' })));
  assert.deepEqual(updatedText(calls).split('\n').slice(2), ['Nobody answered this one.']);
});

test('/bluff reveal with no open question says so; a failed reveal stays open for a retry', async (t) => {
  at(t, `${DATE}T16:00:00Z`);
  const empty = makeEnv();
  await install(empty, 'T1', { channel: 'C1' });
  let calls = mockFetch();
  await send(empty, signedRequest(slashBody({ text: 'reveal' })));
  assert.equal(replies(calls)[0].body.text, "There is no open question to reveal. Type /bluff to post today's question.");

  const env = await setup();
  calls = mockFetch({ apiDown: true });
  await send(env, signedRequest(slashBody({ text: 'reveal' })));
  assert.equal(replies(calls)[0].body.text, "Who's Bluffing is taking a break, try again in a minute.");
  assert.equal(slackCalls(calls, 'chat.update').length, 0);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 0 }]);

  calls = mockFetch({ slack: { 'chat.update': () => ({ ok: false, error: 'message_not_found' }) } });
  await send(env, signedRequest(slashBody({ text: 'reveal' })));
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 0 }]);
});
