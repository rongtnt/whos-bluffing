import { test } from 'node:test';
import assert from 'node:assert/strict';
import { install, makeEnv, mockFetch, send, slackCalls } from './helpers.js';

const STATE = 'a'.repeat(32);
const callback = (state, cookie) =>
  new Request(`https://worker.test/slack/oauth/callback?code=c0de&state=${state}`, { headers: { cookie: `hs_state=${cookie}` } });

test('OAuth start redirects to Slack with the scopes, the callback URL and a state cookie', async () => {
  mockFetch();
  const res = await send(makeEnv(), new Request('https://worker.test/slack/oauth/start'));
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(`${loc.origin}${loc.pathname}`, 'https://slack.com/oauth/v2/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'client-id');
  assert.equal(loc.searchParams.get('scope'), 'commands,chat:write,chat:write.public,channels:read,groups:read,users:read');
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://worker.test/slack/oauth/callback');
  const state = loc.searchParams.get('state');
  assert.match(state, /^[0-9a-f]{32}$/);
  assert.match(res.headers.get('set-cookie'), new RegExp(`^hs_state=${state};.*HttpOnly; Secure; SameSite=Lax`));
});

test('OAuth callback exchanges the code and stores the bot token per team; reinstall keeps the channel', async () => {
  const env = makeEnv();
  let token = 'xoxb-first';
  const calls = mockFetch({
    slack: { 'oauth.v2.access': () => ({ access_token: token, team: { id: 'T9' }, authed_user: { id: 'U5' } }) },
  });
  const res = await send(env, callback(STATE, STATE));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Who's Bluffing is installed/);
  assert.deepEqual(slackCalls(calls, 'oauth.v2.access')[0].body, {
    client_id: 'client-id', client_secret: 'client-secret', code: 'c0de', redirect_uri: 'https://worker.test/slack/oauth/callback',
  });
  const rows = () => env.DB.rows('SELECT team_id, bot_token, channel_id, post_hour_utc FROM installs');
  assert.deepEqual(rows(), [{ team_id: 'T9', bot_token: 'xoxb-first', channel_id: null, post_hour_utc: 14 }]);
  assert.ok(!JSON.stringify(env.DB.rows('SELECT * FROM installs')).includes('U5'), 'installer id stored');

  await env.DB.prepare("UPDATE installs SET channel_id = 'C1', post_hour_utc = 9").run();
  token = 'xoxb-second';
  await send(env, callback(STATE, STATE));
  assert.deepEqual(rows(), [{ team_id: 'T9', bot_token: 'xoxb-second', channel_id: 'C1', post_hour_utc: 9 }]);
});

test('OAuth callback with a wrong state or a cancelled install stores nothing', async () => {
  const env = makeEnv();
  await install(env, 'T1');
  const calls = mockFetch();
  const wrong = await send(env, callback(STATE, 'b'.repeat(32)));
  const cancelled = await send(env, new Request(`https://worker.test/slack/oauth/callback?error=access_denied&state=${STATE}`,
    { headers: { cookie: `hs_state=${STATE}` } }));
  assert.equal(wrong.status, 400);
  assert.equal(cancelled.status, 400);
  assert.equal(calls.length, 0);
  assert.deepEqual(env.DB.rows('SELECT team_id FROM installs'), [{ team_id: 'T1' }]);
});
