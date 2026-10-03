import { test } from 'node:test';
import assert from 'node:assert/strict';
import { install, makeCtx, makeEnv, mockFetch, slackCalls, worker } from './helpers.js';

async function runCron(env, iso) {
  const ctx = makeCtx();
  await worker.scheduled({ scheduledTime: Date.parse(iso), cron: '0 * * * *' }, env, ctx);
  await ctx.settle();
}

test('scheduled() posts once per day to every install whose UTC hour has come (idempotent via posts)', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await install(env, 'T2', { channel: 'C2', hour: 9 });
  await install(env, 'T3', { channel: 'C3', hour: 20 });
  await install(env, 'T4'); // no channel chosen yet
  const calls = mockFetch();
  const posted = () => slackCalls(calls, 'chat.postMessage').map((c) => c.body.channel).sort();

  await runCron(env, '2026-10-31T14:00:00Z');
  await runCron(env, '2026-10-31T14:00:00Z'); // the same trigger twice
  await runCron(env, '2026-10-31T15:00:00Z');
  assert.deepEqual(posted(), ['C1', 'C2']);
  assert.match(slackCalls(calls, 'chat.postMessage')[0].body.text, /^HowSure #12 — 5 questions/);

  await runCron(env, '2026-10-31T20:00:00Z');
  assert.deepEqual(posted(), ['C1', 'C2', 'C3']);
  assert.equal(env.DB.rows("SELECT * FROM posts WHERE date = '2026-10-31' AND ts IS NOT NULL").length, 3);

  await runCron(env, '2026-11-01T23:00:00Z'); // next day: everyone once more
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 6);
});

test('scheduled(): API down claims nothing; a failed post retries next hour; a revoked token removes the install', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  await install(env, 'T2', { channel: 'C2' });

  let calls = mockFetch({ apiDown: true });
  await runCron(env, '2026-10-31T14:00:00Z');
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 0);
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0);

  let rateLimited = true;
  calls = mockFetch({
    slack: {
      'chat.postMessage': (c) => {
        if (c.body.channel === 'C2') return { ok: false, error: 'token_revoked' };
        return rateLimited ? { ok: false, error: 'ratelimited' } : {};
      },
    },
  });
  await runCron(env, '2026-10-31T15:00:00Z');
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0); // claim released
  assert.deepEqual(env.DB.rows('SELECT team_id FROM installs'), [{ team_id: 'T1' }]);

  rateLimited = false;
  await runCron(env, '2026-10-31T16:00:00Z');
  assert.deepEqual(env.DB.rows('SELECT team_id, ts FROM posts'), [{ team_id: 'T1', ts: '1700000000.000100' }]);
});
