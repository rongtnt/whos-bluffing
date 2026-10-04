import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATE, QUESTION, apiCalls, install, makeCtx, makeEnv, mockFetch, slackCalls, tsAt, worker } from './helpers.js';

// Runs the hourly cron at `iso`. Slack's mock stamps posts with that moment, like the real ts.
async function runCron(env, iso, clock) {
  if (clock) clock.now = iso;
  const ctx = makeCtx();
  await worker.scheduled({ scheduledTime: Date.parse(iso), cron: '0 * * * *' }, env, ctx);
  await ctx.settle();
}

test('scheduled() posts the question once per day to every install whose UTC hour has come', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await install(env, 'T2', { channel: 'C2', hour: 9 });
  await install(env, 'T3', { channel: 'C3', hour: 20 });
  await install(env, 'T4'); // no channel chosen yet
  const calls = mockFetch();
  const posted = () => slackCalls(calls, 'chat.postMessage').map((c) => c.body.channel).sort();

  await runCron(env, `${DATE}T14:00:00Z`);
  await runCron(env, `${DATE}T14:00:00Z`); // the same trigger twice
  await runCron(env, `${DATE}T15:00:00Z`);
  assert.deepEqual(posted(), ['C1', 'C2']);
  const [post] = slackCalls(calls, 'chat.postMessage');
  assert.equal(post.body.text, 'HowSure · Which is longer: the Nile or the Danube?');
  const blocks = JSON.parse(post.body.blocks);
  const buttons = blocks.find((b) => b.type === 'actions').elements;
  assert.deepEqual(buttons.map((b) => [b.action_id, b.text.text]), [['pick:0', 'A · the Nile'], ['pick:1', 'B · the Danube']]);
  assert.deepEqual(JSON.parse(buttons[0].value), { r: QUESTION.round_id, i: QUESTION.item_id, d: DATE });
  assert.match(blocks.at(-1).elements[0].text, /before the reveal at 22:00 UTC\.$/);
  assert.equal(apiCalls(calls, '/api/round/daily-question')[0].query.date, DATE);

  await runCron(env, `${DATE}T20:00:00Z`);
  assert.deepEqual(posted(), ['C1', 'C2', 'C3']);
  assert.deepEqual(env.DB.rows(`SELECT team_id, channel_id FROM posts WHERE date = '${DATE}' AND ts IS NOT NULL ORDER BY team_id`),
    [{ team_id: 'T1', channel_id: 'C1' }, { team_id: 'T2', channel_id: 'C2' }, { team_id: 'T3', channel_id: 'C3' }]);

  await runCron(env, '2026-11-01T23:00:00Z'); // next day: everyone once more
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 6);
});

test('scheduled(): API down claims nothing; a failed post retries next hour; a revoked token removes the install', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1' });
  await install(env, 'T2', { channel: 'C2' });

  let calls = mockFetch({ apiDown: true });
  await runCron(env, `${DATE}T14:00:00Z`);
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
  await runCron(env, `${DATE}T15:00:00Z`);
  assert.equal(env.DB.rows('SELECT * FROM posts').length, 0); // claim released
  assert.deepEqual(env.DB.rows('SELECT team_id FROM installs'), [{ team_id: 'T1' }]);

  rateLimited = false;
  await runCron(env, `${DATE}T16:00:00Z`);
  assert.deepEqual(env.DB.rows('SELECT team_id, ts FROM posts'), [{ team_id: 'T1', ts: '1700000000.000100' }]);
});

test('scheduled() reveals each post once, at the hour it promised: post hour + 8 h, or post time + 8 h when posted late', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  const clock = { now: '' };
  const calls = mockFetch({ slack: { 'chat.postMessage': () => ({ ts: tsAt(clock.now) }) } });
  const updates = (channel) => slackCalls(calls, 'chat.update').filter((c) => c.body.channel === channel).length;

  await runCron(env, `${DATE}T14:00:00Z`, clock);
  // T2 sets up at 19:30 for 09:00, so its first post goes up late, at 20:00, and promises 04:00.
  await install(env, 'T2', { channel: 'C2', hour: 9 });
  await runCron(env, `${DATE}T20:00:00Z`, clock);
  const late = slackCalls(calls, 'chat.postMessage').find((c) => c.body.channel === 'C2');
  assert.match(JSON.parse(late.body.blocks).at(-1).elements[0].text, /before the reveal at 04:00 UTC\.$/);

  await runCron(env, `${DATE}T21:00:00Z`, clock);
  assert.equal(updates('C1'), 0);
  await runCron(env, `${DATE}T22:00:00Z`, clock);
  await runCron(env, `${DATE}T22:00:00Z`, clock); // the same trigger twice
  await runCron(env, `${DATE}T23:00:00Z`, clock);
  assert.equal(updates('C1'), 1);
  assert.equal(updates('C2'), 0);

  await runCron(env, '2026-11-01T03:00:00Z', clock);
  assert.equal(updates('C2'), 0);
  await runCron(env, '2026-11-01T04:00:00Z', clock);
  await runCron(env, '2026-11-01T05:00:00Z', clock);
  assert.equal(updates('C2'), 1);
  assert.deepEqual(env.DB.rows(`SELECT team_id, revealed FROM posts WHERE date = '${DATE}' ORDER BY team_id`),
    [{ team_id: 'T1', revealed: 1 }, { team_id: 'T2', revealed: 1 }]);
});

test('scheduled(): a reveal that fails (API down) is retried at the next tick', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  await env.DB.prepare('INSERT INTO posts (team_id, date, channel_id, ts) VALUES (?, ?, ?, ?)').bind('T1', DATE, 'C1', tsAt(`${DATE}T14:00:01Z`)).run();
  mockFetch({ apiDown: true });
  await runCron(env, `${DATE}T22:00:00Z`);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 0 }]);
  const calls = mockFetch();
  await runCron(env, `${DATE}T23:00:00Z`);
  assert.equal(slackCalls(calls, 'chat.update').length, 1);
  assert.deepEqual(env.DB.rows('SELECT revealed FROM posts'), [{ revealed: 1 }]);
});

test('two overlapping cron runs still post, reveal and recap once each (the claims, not the selects, decide)', async () => {
  const env = makeEnv();
  await install(env, 'T1', { channel: 'C1', hour: 14 });
  const calls = mockFetch();
  const both = (iso) => Promise.all([runCron(env, iso), runCron(env, iso)]);
  await both('2026-11-01T14:00:00Z');
  assert.equal(slackCalls(calls, 'chat.postMessage').length, 1);
  await env.DB.prepare("INSERT INTO answers VALUES ('T1', 'h', '2026-11-01', 0, 90, 1, 96)").run();
  await both('2026-11-01T22:00:00Z');
  assert.equal(slackCalls(calls, 'chat.update').length, 1);
  await both('2026-11-02T14:00:00Z'); // Monday: one recap, one new question
  assert.deepEqual(slackCalls(calls, 'chat.postMessage').map((c) => c.body.text.split('\n')[0]), [
    'HowSure · Which is longer: the Nile or the Danube?',
    '*HowSure · last week in this workspace* (Oct 26 – Nov 1)',
    'HowSure · Which is longer: the Nile or the Danube?',
  ]);
});
