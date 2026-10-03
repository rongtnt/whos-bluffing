import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, SALT, anon, apiCalls, install, makeEnv, mockFetch, payloadBody, replies, send, sha256, signedRequest, slackCalls,
} from './helpers.js';

const RESPONSE_URL = 'https://hooks.slack.com/actions/T1/1/abc';
const NAMES = { U1: 'Maya', U7: 'Sam' };
const RANGES = Object.fromEntries(DAY.items.map((it) => [it.id, [10, 20000]]));

const click = (user = 'U1') =>
  payloadBody({
    type: 'block_actions', team: { id: 'T1' }, user: { id: user }, trigger_id: 'trigger-1',
    response_url: RESPONSE_URL, channel: { id: 'C1' }, actions: [{ action_id: 'play', type: 'button' }],
  });

const stateFrom = (ranges) =>
  Object.fromEntries(Object.entries(ranges).flatMap(([id, [lo, hi]]) => [
    [`${id}:lo`, { v: { type: 'number_input', value: String(lo) } }],
    [`${id}:hi`, { v: { type: 'number_input', value: String(hi) } }],
  ]));

const submission = (view, ranges, user = 'U1') =>
  payloadBody({
    type: 'view_submission', team: { id: 'T1' }, user: { id: user },
    view: { id: 'V1', callback_id: view.callback_id, private_metadata: view.private_metadata, state: { values: stateFrom(ranges) } },
  });

// Slack mocks for the board: both players are channel members with display names.
const slackMocks = {
  'conversations.members': () => ({ members: ['U7', 'U1'] }),
  'users.info': (c) => ({ user: { id: c.body.user, profile: { display_name: NAMES[c.body.user] } } }),
};
// U7 scores 5, everyone else 3.
const apiMocks = {
  '/api/daily/complete': (c) => ({ hits: c.body.anon_id === anon('T1', 'U7') ? 5 : 3, today: { players: 11, avg_hits: 2.9 } }),
};

// Clicks Play and returns the opened modal.
async function openModal(env, calls, user = 'U1') {
  await send(env, signedRequest(click(user)));
  return JSON.parse(slackCalls(calls, 'views.open').at(-1).body.view);
}

test('Play opens a modal: 5 questions, each a prompt with unit and low/high number inputs', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  const view = await openModal(env, calls);
  assert.equal(slackCalls(calls, 'views.open')[0].body.trigger_id, 'trigger-1');
  assert.equal(view.title.text, 'HowSure #12');
  const inputs = view.blocks.filter((b) => b.type === 'input');
  assert.equal(inputs.length, 10);
  assert.ok(inputs.every((b) => b.element.type === 'number_input' && b.element.is_decimal_allowed));
  assert.deepEqual(inputs.slice(0, 2).map((b) => [b.block_id, b.label.text]), [['w1:lo', 'Low (m)'], ['w1:hi', 'High (m)']]);
  assert.ok(view.blocks.some((b) => b.text?.text === '*1. Question 1?* (m)'));
  const meta = JSON.parse(view.private_metadata);
  assert.equal(meta.d, DAY.date);
  assert.equal(meta.r, RESPONSE_URL);
});

test('submit with low > high or a missing number returns field errors inside the ack and calls nothing', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch();
  const view = await openModal(env, calls);
  calls.length = 0;
  const res = await send(env, signedRequest(submission(view, { ...RANGES, w3: [50, 5], w4: ['', 9] })));
  assert.deepEqual(await res.json(), {
    response_action: 'errors',
    errors: { 'w3:hi': 'High must be at least as large as low.', 'w4:lo': 'Enter a number.' },
  });
  assert.equal(calls.length, 0);
});

test('submit: 5 answers + complete with hashed ids, private result, score stored, board posted then updated', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch({ slack: slackMocks, api: apiMocks });
  const view = await openModal(env, calls);
  calls.length = 0;
  const res = await send(env, signedRequest(submission(view, RANGES)));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');

  const me = anon('T1', 'U1');
  const community = sha256(`T1:${SALT}`);
  const answers = apiCalls(calls, '/api/daily/answer');
  assert.deepEqual(answers.map((a) => a.body.item_id).sort(), ['w1', 'w2', 'w3', 'w4', 'w5']);
  for (const { body } of answers) {
    assert.deepEqual({ ...body, item_id: undefined, rt_ms: undefined },
      { date: DAY.date, item_id: undefined, low: 10, high: 20000, anon_id: me, community, surface: 'slack', rt_ms: undefined });
    assert.ok(Number.isInteger(body.rt_ms) && body.rt_ms >= 0);
  }
  assert.deepEqual(apiCalls(calls, '/api/daily/complete').map((c) => c.body), [{ date: DAY.date, anon_id: me, community, surface: 'slack' }]);
  assert.ok(!JSON.stringify(calls.filter((c) => c.host === 'api.test')).includes('U1'), 'raw member id reached the API');

  const [result] = replies(calls);
  assert.equal(result.url.href, RESPONSE_URL);
  assert.equal(result.body.response_type, 'ephemeral');
  assert.equal(result.body.text, 'HowSure #12 🟩🟥🟩🟥🟩 3/5 at 90%');
  assert.match(result.body.blocks[0].text.text, /🟩 Question 1\? \*1,000 m\* · <https:\/\/www\.wikidata\.org\/wiki\/Q1\|source>/);
  assert.match(result.body.blocks[0].text.text, /🟥 Question 2\? \*2,000 m\*/);

  assert.deepEqual(env.DB.rows('SELECT team_id, anon_id, date, hits FROM scores'), [{ team_id: 'T1', anon_id: me, date: DAY.date, hits: 3 }]);

  // No post today yet: the board is posted to the chosen channel and becomes today's post.
  const [first] = slackCalls(calls, 'chat.postMessage');
  assert.equal(first.body.channel, 'C1');
  assert.match(first.body.text, /Today's average so far: 2\.9\/5\./);
  assert.match(first.body.blocks, /1 player, average 3\.0\/5\\n1\. Maya — 3\/5/);
  assert.deepEqual(env.DB.rows('SELECT ts FROM posts'), [{ ts: '1700000000.000100' }]);

  // A second member plays: the same message is updated, ordered by hits.
  calls.length = 0;
  const view2 = await openModal(env, calls, 'U7');
  await send(env, signedRequest(submission(view2, RANGES, 'U7')));
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  const [update] = slackCalls(calls, 'chat.update');
  assert.deepEqual([update.body.channel, update.body.ts], ['C1', '1700000000.000100']);
  assert.match(update.body.blocks, /2 players, average 4\.0\/5\\n1\. Sam — 5\/5\\n2\. Maya — 3\/5/);

  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM scores')).match(/U1|U7|Maya|Sam/), 'raw id or name stored');
});

test('a member who already completed gets the result again, not a second play', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch({ slack: slackMocks, api: apiMocks });
  const view = await openModal(env, calls);
  await send(env, signedRequest(submission(view, RANGES)));
  calls.length = 0;

  await send(env, signedRequest(click()));
  assert.equal(slackCalls(calls, 'views.open').length, 0);
  assert.equal(apiCalls(calls, '/api/daily/complete').length, 0);
  const [again] = replies(calls);
  assert.equal(again.body.text, 'You already played today. HowSure #12 🟩🟥🟩🟥🟩 3/5 at 90%');

  // A second modal left open and submitted later does not complete a second play either.
  await send(env, signedRequest(submission(view, RANGES)));
  assert.equal(apiCalls(calls, '/api/daily/complete').length, 0);
  assert.match(replies(calls).at(-1).body.text, /^You already played today\./);
  assert.equal(env.DB.rows('SELECT * FROM scores').length, 1);
});

test('Play with the daily API down: private "taking a break" reply, no modal', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  const calls = mockFetch({ apiDown: true });
  await send(env, signedRequest(click()));
  assert.equal(slackCalls(calls, 'views.open').length, 0);
  assert.equal(replies(calls)[0].body.text, 'HowSure is taking a break, try again in a minute.');
});
