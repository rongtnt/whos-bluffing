import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import { anon, install, makeCtx, makeEnv, mockFetch, points, slackCalls, worker } from './helpers.js';

const MONDAY = '2026-11-02'; // recaps Mon Oct 26 – Sun Nov 1

async function runCron(env, iso) {
  const ctx = makeCtx();
  await worker.scheduled({ scheduledTime: Date.parse(iso), cron: '0 * * * *' }, env, ctx);
  await ctx.settle();
}

// [user, date, conf, correct]. Maya: 82% sure, 80% right. Sam: 97% sure, 33% right. Lee is closer (50% sure, 50% right)
// but has only 2 answers last week, so he can't be most calibrated.
const WEEK = [
  ['U1', '2026-10-26', 90, 1], ['U1', '2026-10-27', 90, 1], ['U1', '2026-10-28', 90, 0], ['U1', '2026-10-29', 70, 1], ['U1', '2026-10-30', 70, 1],
  ['U7', '2026-10-26', 100, 0], ['U7', '2026-10-27', 100, 1], ['U7', '2026-10-28', 90, 0],
  ['U8', '2026-10-31', 50, 1], ['U8', '2026-11-01', 50, 0],
  ['U8', '2026-10-24', 70, 1], ['U8', '2026-10-25', 70, 1], ['U8', '2026-10-22', 70, 1], // the week before (streak only)
];

async function seed(env, team, rows) {
  for (const [user, date, conf, correct] of rows) {
    await store.claimPost(env.DB, team, date, 'C1', '1.0');
    await env.DB.prepare('UPDATE posts SET revealed = 1 WHERE team_id = ? AND date = ?').bind(team, date).run();
    await store.saveAnswer(env.DB, team, anon(team, user), date, { choice: correct ? 0 : 1, conf, correct, points: points(conf, correct) });
  }
}

const slackMocks = {
  'conversations.members': () => ({ members: ['U7', 'U1'] }),
  'users.info': (c) => ({ user: { profile: { display_name: { U1: 'Maya', U7: 'Sam' }[c.body.user] } } }),
};

test('Monday recap: accuracy per confidence level, most calibrated (named), bluffs, days played and streak', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await seed(env, 'T1', WEEK);
  await seed(env, 'T2', [['U1', '2026-10-27', 100, 0]]); // another workspace: not counted
  const calls = mockFetch({ slack: slackMocks });

  await runCron(env, `${MONDAY}T14:00:00Z`);
  const posts = slackCalls(calls, 'chat.postMessage');
  assert.deepEqual(posts.map((c) => c.body.channel), ['C1', 'C1']);
  assert.match(posts[1].body.text, /^HowSure · Which is longer/, 'the recap comes before the new question');
  assert.equal(posts[0].body.text, [
    '*HowSure · last week in this workspace* (Oct 26 – Nov 1)',
    '*How often each confidence level was right*',
    '100% sure: 1 of 2 right (50%)',
    '90% sure: 2 of 4 right (50%)',
    '70% sure: 2 of 2 right (100%)',
    '50% sure: 1 of 2 right (50%)',
    '*Most calibrated:* Maya, 82% sure on average and 80% right',
    '*Bluffs* (wrong at 80% or more): 3',
    '*Days played:* 7 of 7 · streak: 9 days',
  ].join('\n'));
});

test('the recap posts once per week: not again the same Monday, not on Tuesday; a quiet week posts nothing', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await install(env, 'T2', { channel: 'C2', hour: 14 }); // nobody answered last week
  await seed(env, 'T1', WEEK);
  const calls = mockFetch({ slack: slackMocks });
  const recaps = () => slackCalls(calls, 'chat.postMessage').filter((c) => c.body.text.includes('last week')).map((c) => c.body.channel);

  await runCron(env, `${MONDAY}T13:00:00Z`); // before the post hour
  assert.deepEqual(recaps(), []);
  await runCron(env, `${MONDAY}T14:00:00Z`);
  await runCron(env, `${MONDAY}T14:00:00Z`);
  await runCron(env, `${MONDAY}T15:00:00Z`);
  await runCron(env, '2026-11-03T14:00:00Z');
  assert.deepEqual(recaps(), ['C1']);
  assert.deepEqual(env.DB.rows('SELECT team_id, recap_week FROM installs ORDER BY team_id'),
    [{ team_id: 'T1', recap_week: MONDAY }, { team_id: 'T2', recap_week: MONDAY }]);
});

test('a recap that Slack refuses is retried at the next tick', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await seed(env, 'T1', WEEK);
  let fail = true;
  const calls = mockFetch({
    slack: { ...slackMocks, 'chat.postMessage': (c) => (fail && c.body.text.includes('last week') ? { ok: false, error: 'ratelimited' } : {}) },
  });
  await runCron(env, `${MONDAY}T14:00:00Z`);
  assert.deepEqual(env.DB.rows('SELECT recap_week FROM installs'), [{ recap_week: null }]);
  fail = false;
  await runCron(env, `${MONDAY}T15:00:00Z`);
  assert.equal(slackCalls(calls, 'chat.postMessage').filter((c) => c.body.text.includes('last week')).length, 2);
  assert.deepEqual(env.DB.rows('SELECT recap_week FROM installs'), [{ recap_week: MONDAY }]);
});
