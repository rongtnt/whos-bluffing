import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bluffLine, revealMessage } from '../src/game.js';
import * as store from '../src/store.js';
import {
  CHANNEL, DATE, GUILD, MANAGER, QUESTION, TRUTH, addAnswer, addPost, anon, apiCalls, commandPayload, community, fakeD1, install,
  makeEnv, memberLists, messageEdits, mockFetch, originalEdits, runCron, send, signedRequest,
} from './helpers.js';

const [MAYA, SAM, LEE, ANA] = ['880000000000000011', '880000000000000012', '880000000000000013', '880000000000000014'];
const MEMBERS = [
  { user: { id: '880000000000000099', username: 'quiet' } },
  { user: { id: MAYA, username: 'maya_r', global_name: 'Maya' }, nick: null },
  { user: { id: SAM, username: 'sam', global_name: 'Samuel' }, nick: 'Sam' },
  { user: { id: LEE, username: 'lee' } },
]; // Ana is not in the first page of members
const REVEAL = { n: 4, pct_a: 75, pct_b: 25, correct: 0, ...TRUTH, biggest_bluff: { anon_id: anon(GUILD, LEE), conf: 90, choice: 1 } };
const membersOk = (list = MEMBERS) => (c) => (c.path.endsWith('/members') ? { body: list } : undefined);
const HEAD = [
  "**Who's Bluffing?** · Which is longer: the Nile or the Danube?",
  `✅ **A · the Nile**: 6,650 km ([source](<${TRUTH.a_source}>))`,
  `B · the Danube: 2,850 km ([source](<${TRUTH.b_source}>))`,
  '4 answered · 75% A · 25% B',
];

async function answeredDay(env, roast = 0) {
  await install(env, GUILD, { channel: CHANNEL, roast });
  await addPost(env);
  // Points are pending until the reveal settles them from its `correct` (A): +96, +64, +36, and -224 for the bluff.
  await addAnswer(env, { user: MAYA, choice: 0, conf: 90, pending: true });
  await addAnswer(env, { user: SAM, choice: 0, conf: 70, pending: true });
  await addAnswer(env, { user: ANA, choice: 0, conf: 60, pending: true });
  await addAnswer(env, { user: LEE, choice: 1, conf: 90, pending: true });
}

const revealCommand = (permissions = MANAGER) => signedRequest(commandPayload('reveal', [], { permissions }));

test('reveal, roast off: both values with sources, the split, top 5 by name (positive scores only), an anonymous bluff', async () => {
  const env = makeEnv();
  await answeredDay(env);
  const calls = mockFetch({ discord: membersOk(), api: { '/api/round/reveal': () => REVEAL } });
  await runCron(env, '2026-10-06T22:00:00Z');

  assert.deepEqual(apiCalls(calls, '/api/round/reveal').map((c) => Object.fromEntries(c.url.searchParams)), [
    { date: DATE, community: community(GUILD) },
  ]);
  const [members] = memberLists(calls);
  assert.equal(members.url.search, '?limit=1000');
  assert.equal(members.headers.authorization, 'Bot bot-token');

  const [edit] = messageEdits(calls);
  assert.equal(edit.path, `/api/v10/channels/${CHANNEL}/messages/9001`);
  assert.equal(edit.headers.authorization, 'Bot bot-token');
  assert.deepEqual(edit.body, {
    content: [
      ...HEAD,
      '**Top 3:** 1. Maya +96 · 2. Sam +64 · 3. a member +36',
      "Someone was 90% sure the Danube is longer. It isn't.",
    ].join('\n'),
    components: [{ type: 1, components: [{ type: 2, style: 5, url: 'https://discord.com/oauth2/authorize?client_id=424242&scope=bot+applications.commands&permissions=83968&integration_type=0', label: 'Add to your server' }] }],
    allowed_mentions: { parse: [] },
  });
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 1 }]);
  assert.deepEqual(env.DB.rows('SELECT anon_id, points, correct FROM answers ORDER BY points DESC'), [
    { anon_id: anon(GUILD, MAYA), points: 96, correct: 1 },
    { anon_id: anon(GUILD, SAM), points: 64, correct: 1 },
    { anon_id: anon(GUILD, ANA), points: 36, correct: 1 },
    { anon_id: anon(GUILD, LEE), points: -224, correct: 0 },
  ]);
  const [reveal] = apiCalls(calls, '/api/round/reveal');
  assert.equal(reveal.headers['x-bluff-bot'], 'test-bot-key');
});

test("settling at the reveal follows the contract's points rule at every confidence, either answer right", async () => {
  const db = fakeD1();
  const conf = [50, 60, 70, 80, 90, 100];
  for (const c of conf) {
    await store.saveAnswer(db, { guild_id: 'G', anon_id: `a${c}`, date: DATE, choice: 0, conf: c });
    await store.saveAnswer(db, { guild_id: 'G', anon_id: `b${c}`, date: DATE, choice: 1, conf: c });
  }
  await store.settleAnswers(db, 'G', DATE, 1); // B was right
  const got = Object.fromEntries(db.rows('SELECT anon_id, points, correct FROM answers').map((r) => [r.anon_id, [r.points, r.correct]]));
  // Vectors from the rounds brief: 100% right +100, 50% 0, 100% wrong -300, 80% wrong -156.
  assert.deepEqual(conf.map((c) => got[`b${c}`]), [[0, 1], [36, 1], [64, 1], [84, 1], [96, 1], [100, 1]]);
  assert.deepEqual(conf.map((c) => got[`a${c}`]), [[0, 0], [-44, 0], [-96, 0], [-156, 0], [-224, 0], [-300, 0]]);
});

test('reveal, roast on: names the biggest bluffer; names are looked up, never stored', async () => {
  const env = makeEnv();
  await answeredDay(env, 1);
  const calls = mockFetch({ discord: membersOk(), api: { '/api/round/reveal': () => REVEAL } });
  await runCron(env, '2026-10-06T22:00:00Z');
  const lines = messageEdits(calls)[0].body.content.split('\n');
  assert.equal(lines.at(-2), '**Top 3:** 1. Maya +96 · 2. Sam +64 · 3. a member +36');
  assert.equal(lines.at(-1), "lee was 90% sure the Danube is longer. It isn't.");
  const stored = JSON.stringify([env.DB.rows('SELECT * FROM answers'), env.DB.rows('SELECT * FROM posts'), env.DB.rows('SELECT * FROM installs')]);
  assert.ok(!/Maya|Sam|lee|880000000000000/.test(stored), 'a name or raw member id was stored');
});

test('without the Server Members Intent (403) everyone is "a member" and roast mode falls back to "Someone"', async () => {
  const env = makeEnv();
  await answeredDay(env, 1);
  const calls = mockFetch({
    discord: (c) => (c.path.endsWith('/members') ? { status: 403, body: { code: 50001 } } : undefined),
    api: { '/api/round/reveal': () => REVEAL },
  });
  await runCron(env, '2026-10-06T22:00:00Z');
  const lines = messageEdits(calls)[0].body.content.split('\n');
  assert.equal(lines.at(-2), '**Top 3:** 1. a member +96 · 2. a member +64 · 3. a member +36');
  assert.equal(lines.at(-1), "Someone was 90% sure the Danube is longer. It isn't.");
});

test('display names are markdown-escaped and nobody is pinged', async () => {
  const env = makeEnv();
  await answeredDay(env);
  const sneaky = [{ user: { id: MAYA, username: 'x' }, nick: '@everyone *boss* <@1>' }];
  const calls = mockFetch({ discord: membersOk(sneaky), api: { '/api/round/reveal': () => REVEAL } });
  await runCron(env, '2026-10-06T22:00:00Z');
  const { body } = messageEdits(calls)[0];
  assert.match(body.content, /1\. \\@everyone \\\*boss\\\* \\<\\@1\\> \+96/);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
});

test('/bluff reveal: Manage Server only; reveals once, then there is nothing left to reveal', async () => {
  const env = makeEnv();
  await answeredDay(env);
  const calls = mockFetch({ discord: membersOk(), api: { '/api/round/reveal': () => REVEAL } });

  const denied = await send(env, revealCommand('0'));
  assert.deepEqual(await denied.json(), {
    type: 4, data: { allowed_mentions: { parse: [] }, content: 'Only members with the Manage Server permission can do that.', flags: 64 },
  });
  assert.equal(calls.length, 0);

  const ok = await send(env, revealCommand());
  assert.deepEqual(await ok.json(), { type: 5, data: { flags: 64 } });
  assert.equal(messageEdits(calls).length, 1);
  assert.equal(originalEdits(calls)[0].body.content, 'Revealed. The answer is on the question post.');

  await send(env, revealCommand());
  await runCron(env, '2026-10-06T23:00:00Z');
  assert.equal(messageEdits(calls).length, 1);
  assert.equal(originalEdits(calls)[1].body.content, "There is no question waiting for its answer. Type /bluff question to post today's.");
});

test('a miss below 80% is not a bluff; a day nobody answered says so', async () => {
  const env = makeEnv();
  await answeredDay(env);
  let reveal = { ...REVEAL, biggest_bluff: { anon_id: anon(GUILD, LEE), conf: 70, choice: 1 } };
  const calls = mockFetch({ discord: membersOk(), api: { '/api/round/reveal': () => reveal } });
  await runCron(env, '2026-10-06T22:00:00Z');
  assert.equal(messageEdits(calls)[0].body.content.split('\n').at(-1), '**Top 3:** 1. Maya +96 · 2. Sam +64 · 3. a member +36');

  await addPost(env, { date: '2026-10-07', revealAt: '2026-10-07T22:00:00.000Z' });
  reveal = { ...REVEAL, n: 0, pct_a: 0, pct_b: 0, biggest_bluff: null };
  await runCron(env, '2026-10-07T22:00:00Z');
  const lines = messageEdits(calls)[1].body.content.split('\n');
  assert.deepEqual(lines.slice(1), [HEAD[1], HEAD[2], 'Nobody here answered this one.']);
});

test('reveal failures: API down releases the reveal for the next hour; a deleted post stays revealed', async () => {
  const env = makeEnv();
  await answeredDay(env);
  let calls = mockFetch({ apiDown: true });
  await runCron(env, '2026-10-06T22:00:00Z');
  assert.equal(messageEdits(calls).length, 0);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 0 }]);

  calls = mockFetch({ api: { '/api/round/reveal': () => REVEAL }, discord: (c) => (c.method === 'PATCH' ? { status: 404 } : undefined) });
  await runCron(env, '2026-10-06T23:00:00Z');
  assert.equal(messageEdits(calls).length, 1);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 1 }]);
  await runCron(env, '2026-10-07T00:00:00Z');
  assert.equal(messageEdits(calls).length, 1);
});

test('roast off never names the bluffer, even when the name is known', () => {
  const r = { ...REVEAL };
  const names = new Map([[anon(GUILD, LEE), 'Lee']]);
  const line = (roast) => revealMessage({ q: QUESTION, r, top: [], names, bluff: r.biggest_bluff, roast }).content.split('\n').at(-1);
  assert.equal(line(false), "Someone was 90% sure the Danube is longer. It isn't.");
  assert.equal(line(true), "Lee was 90% sure the Danube is longer. It isn't.");
});

test('bluff line phrasing follows the prompt; anything else gets a plain fallback', () => {
  const bluff = { choice: 0, conf: 100 };
  assert.equal(bluffLine({ prompt: 'Which was founded first?', a: 'Yale', b: 'Harvard' }, bluff, null), "Someone was 100% sure Yale was founded first. It wasn't.");
  assert.equal(bluffLine({ prompt: 'Which came first: radio or radar?', a: 'radar', b: 'radio' }, bluff, 'Kim'), "Kim was 100% sure radar came first. It didn't.");
  assert.equal(bluffLine({ prompt: 'Pick the heavier one', a: 'a ton of feathers', b: 'x' }, bluff, null), "Someone was 100% sure it was a ton of feathers. It wasn't.");
  assert.equal(bluffLine(QUESTION, { choice: 1, conf: 90 }, null), "Someone was 90% sure the Danube is longer. It isn't.");
});
