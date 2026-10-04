import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATE, QUESTION, SALT, anon, apiCalls, at, install, makeEnv, mockFetch, payloadBody, replies, send, sha256, signedRequest, tsAt,
} from './helpers.js';

const POST_URL = 'https://hooks.slack.com/actions/T1/1/post';
const PICKER_URL = 'https://hooks.slack.com/actions/T1/2/picker';
const VALUE = JSON.stringify({ r: QUESTION.round_id, i: QUESTION.item_id, d: DATE });
const NOW = `${DATE}T15:00:00Z`;

const tapAB = (choice, user = 'U1', value = VALUE) =>
  payloadBody({
    type: 'block_actions', team: { id: 'T1' }, user: { id: user }, response_url: POST_URL, channel: { id: 'C1' },
    actions: [{ action_id: `pick:${choice}`, type: 'button', value, text: { type: 'plain_text', text: choice ? 'B · the Danube' : 'A · the Nile' } }],
  });

const tapConf = (value, conf, user = 'U1') =>
  payloadBody({
    type: 'block_actions', team: { id: 'T1' }, user: { id: user }, response_url: PICKER_URL, container: { is_ephemeral: true },
    actions: [{ action_id: `conf:${conf}`, type: 'button', value }],
  });

// The day's post went up at 14:00 in C1, so the reveal is at 22:00.
async function setup(revealed = 0) {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  await env.DB.prepare('INSERT INTO posts (team_id, date, channel_id, ts, revealed) VALUES (?, ?, ?, ?, ?)')
    .bind('T1', DATE, 'C1', tsAt(`${DATE}T14:00:02Z`), revealed).run();
  return env;
}

const pickerButtons = (calls) => replies(calls).at(-1).body.blocks.find((b) => b.type === 'actions').elements;

// A/B tap, then a confidence tap on the picker it sent. Returns the reply to the confidence tap.
async function answer(t, env, calls, choice, conf, user = 'U1') {
  await send(env, signedRequest(tapAB(choice, user)));
  const button = pickerButtons(calls).find((b) => b.action_id === `conf:${conf}`);
  t.mock.timers.tick(4000);
  await send(env, signedRequest(tapConf(button.value, conf, user)));
  return replies(calls).at(-1);
}

const answers = (env) => env.DB.rows('SELECT team_id, anon_id, date, choice, conf, correct, points FROM answers');

test('A/B tap sends a private confidence picker: 50 to 100, "coin flip" to "stake it all"; calls no API', async (t) => {
  at(t, NOW);
  const env = await setup();
  const calls = mockFetch();
  const res = await send(env, signedRequest(tapAB(1)));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');

  const [picker] = replies(calls);
  assert.equal(picker.url.href, POST_URL);
  assert.equal(picker.body.response_type, 'ephemeral');
  assert.equal(picker.body.replace_original, false);
  assert.equal(picker.body.text, 'You picked B · the Danube. How sure are you?');
  const buttons = pickerButtons(calls);
  assert.deepEqual(buttons.map((b) => [b.action_id, b.text.text]), [
    ['conf:50', '50% · coin flip'], ['conf:60', '60%'], ['conf:70', '70%'], ['conf:80', '80%'], ['conf:90', '90%'], ['conf:100', '100% · stake it all'],
  ]);
  assert.deepEqual(JSON.parse(buttons[0].value), { r: QUESTION.round_id, i: QUESTION.item_id, d: DATE, c: 1, t: Date.parse(NOW) });
  assert.equal(calls.filter((c) => c.host === 'api.test').length, 0);
  assert.equal(answers(env).length, 0);
});

test('confidence tap: contract payload to /api/round/answer, answer stored, picker replaced by "Locked in", truth hidden', async (t) => {
  at(t, NOW);
  const env = await setup();
  const calls = mockFetch();
  const locked = await answer(t, env, calls, 1, 80);

  const me = anon('T1', 'U1');
  const [call] = apiCalls(calls, '/api/round/answer');
  assert.deepEqual(call.body, {
    round_id: 'dq-2026-10-31', item_id: 'p00042', choice: 1, conf: 80, rt_ms: 4000, anon_id: me,
    community: `slack:${sha256(`T1:${SALT}`)}`, surface: 'slack',
  });
  assert.ok(!('revision' in call.body), 'a first answer is not a revision');

  assert.equal(locked.url.href, PICKER_URL);
  assert.equal(locked.body.replace_original, true);
  assert.equal(locked.body.response_type, 'ephemeral');
  assert.equal(locked.body.text, 'Locked in: B at 80%. Reveal at 22:00 UTC.');
  assert.equal(locked.body.blocks, undefined);

  assert.deepEqual(answers(env), [{ team_id: 'T1', anon_id: me, date: DATE, choice: 1, conf: 80, correct: 0, points: -156 }]);
  assert.ok(!JSON.stringify(calls.filter((c) => c.host === 'api.test')).includes('U1'), 'raw member id reached the API');
});

test('changing your mind before the reveal sends revision: true and the last answer wins', async (t) => {
  at(t, NOW);
  const env = await setup();
  const calls = mockFetch();
  await answer(t, env, calls, 1, 80);

  await send(env, signedRequest(tapAB(0)));
  assert.match(replies(calls).at(-1).body.blocks[0].text.text, /You are locked in at B, 80%\. Pick again to change it\./);
  const button = pickerButtons(calls).find((b) => b.action_id === 'conf:90');
  await send(env, signedRequest(tapConf(button.value, 90)));

  const [, second] = apiCalls(calls, '/api/round/answer');
  assert.equal(second.body.revision, true);
  assert.deepEqual([second.body.choice, second.body.conf], [0, 90]);
  assert.equal(replies(calls).at(-1).body.text, 'Locked in: A at 90%. Reveal at 22:00 UTC.');
  assert.deepEqual(answers(env).map((a) => [a.choice, a.conf, a.correct, a.points]), [[0, 90, 1, 96]]);
});

test('the API refusing a revision (4xx) shows "already locked in" and keeps the first answer', async (t) => {
  at(t, NOW);
  const env = await setup();
  let refuse = false;
  const calls = mockFetch({
    api: {
      '/api/round/answer': () => (refuse
        ? new Response('{"error":"locked"}', { status: 409 })
        : { correct: false, truth: {}, points: -156, total: -156 }),
    },
  });
  await answer(t, env, calls, 1, 80);
  refuse = true;
  const reply = await answer(t, env, calls, 0, 100);
  assert.equal(reply.body.text, "You're already locked in: B at 80%. Reveal at 22:00 UTC.");
  assert.equal(reply.body.replace_original, true);
  assert.deepEqual(answers(env).map((a) => [a.choice, a.conf]), [[1, 80]]);
});

test('after the reveal, A/B taps and leftover pickers are refused locally and call no API', async (t) => {
  at(t, NOW);
  const env = await setup(1);
  const calls = mockFetch();
  await send(env, signedRequest(tapAB(0)));
  assert.equal(replies(calls)[0].body.text, 'This question is closed. A new one comes tomorrow.');

  const leftover = JSON.stringify({ r: QUESTION.round_id, i: QUESTION.item_id, d: DATE, c: 0, t: 1 });
  await send(env, signedRequest(tapConf(leftover, 70)));
  assert.equal(replies(calls)[1].body.text, 'This question is closed. A new one comes tomorrow.');
  assert.equal(replies(calls)[1].body.replace_original, true);

  // A copy of a question from two days ago is closed too.
  const old = JSON.stringify({ r: 'dq-2026-10-29', i: 'p00001', d: '2026-10-29' });
  await send(env, signedRequest(tapAB(1, 'U1', old)));
  assert.equal(replies(calls)[2].body.text, 'This question is closed. A new one comes tomorrow.');
  assert.equal(calls.filter((c) => c.host === 'api.test').length, 0);
  assert.equal(answers(env).length, 0);
});

test('confidence tap with the API down: "taking a break", the picker stays, nothing stored', async (t) => {
  at(t, NOW);
  const env = await setup();
  const calls = mockFetch();
  await send(env, signedRequest(tapAB(0)));
  const button = pickerButtons(calls)[2];
  const down = mockFetch({ apiDown: true });
  await send(env, signedRequest(tapConf(button.value, 70)));
  const [reply] = replies(down);
  assert.equal(reply.body.text, 'HowSure is taking a break, try again in a minute.');
  assert.equal(reply.body.replace_original, false);
  assert.equal(answers(env).length, 0);
});

test('storage holds only the salted hash, choice, confidence, correct and points: no ids, names or text', async (t) => {
  at(t, NOW);
  const env = await setup();
  const calls = mockFetch();
  await answer(t, env, calls, 0, 90, 'U1');
  await answer(t, env, calls, 1, 60, 'U7');
  const dump = JSON.stringify(['installs', 'posts', 'answers', 'scores'].map((table) => env.DB.rows(`SELECT * FROM ${table}`)));
  for (const forbidden of ['U1', 'U7', 'Nile', 'Danube', 'Which is longer', 'Locked in']) assert.ok(!dump.includes(forbidden), forbidden);
  assert.deepEqual(env.DB.rows('PRAGMA table_info(answers)').map((c) => c.name), ['team_id', 'anon_id', 'date', 'choice', 'conf', 'correct', 'points']);
});
