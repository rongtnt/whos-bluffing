import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME } from '../src/game.js';
import {
  APP_ID, CHANNEL, GUILD, USER, channelOfPost, channelPosts, install, makeCtx, makeEnv, mockFetch, runCron, send, signedRequest,
  worker,
} from './helpers.js';

const G2 = '770000000000000032';
const C2 = '660000000000000032';
const SYSTEM = '660000000000000031';
const [T1, T2, T3, T4] = ['660000000000000041', '660000000000000042', '660000000000000043', '660000000000000044'];
const TS = '2026-10-06T14:42:53.064834'; // the event timestamp, in the format of Discord's examples

const toEvents = (payload, opts) => signedRequest(payload, { ...opts, path: '/events' });
const event = (type, data, timestamp = TS) => ({ version: 1, application_id: APP_ID, type: 1, event: { type, timestamp, data } });
// Shaped like Discord's documented APPLICATION_AUTHORIZED; `guild` comes with server installs (integration_type 0).
const authorized = ({ integration = 0, guild = integration === 0, timestamp } = {}) => event('APPLICATION_AUTHORIZED', {
  integration_type: integration,
  scopes: ['applications.commands', 'bot'],
  user: { id: USER, username: 'admin' },
  ...(guild && { guild: { id: GUILD, name: 'Test server' } }),
}, timestamp);

// Discord as one server: its system channel, its channel list, and the channels where posting fails (403).
const server = ({ system = SYSTEM, channels = [], refuse = [] } = {}) => (c) => {
  if (c.method === 'GET' && c.path === `/api/v10/guilds/${GUILD}`) return { body: { id: GUILD, system_channel_id: system } };
  if (c.method === 'GET' && c.path === `/api/v10/guilds/${GUILD}/channels`) return { body: channels };
  if (c.method === 'POST' && refuse.includes(channelOfPost(c))) return { status: 403, body: { code: 50013 } };
  return undefined;
};
const text = (id, position) => ({ id, type: 0, position });
const posted = (calls) => channelPosts(calls).map(channelOfPost);

test('events: a forged or stale signature gets 401 and changes nothing', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  const forged = await send(env, toEvents(authorized(), { sig: 'ab'.repeat(64) }));
  const stale = await send(env, toEvents(authorized(), { ts: Math.floor(Date.now() / 1000) - 600 }));
  assert.equal(forged.status, 401);
  assert.equal(stale.status, 401);
  assert.equal(calls.length, 0);
  assert.deepEqual(env.DB.rows('SELECT * FROM installs'), []);
});

test('events: PING gets 204 with an empty body', async () => {
  const calls = mockFetch();
  const res = await send(makeEnv(), toEvents({ version: 1, application_id: APP_ID, type: 0 }));
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.ok(res.headers.get('content-type')); // Discord asks for a valid Content-Type even on an empty 204
  assert.equal(calls.length, 0);
});

test('server install: registers the server without a channel and posts one hello in its system channel', async () => {
  const env = makeEnv();
  const calls = mockFetch({ discord: server({ channels: [text(T1, 0)] }) });
  const res = await send(env, toEvents(authorized()));
  assert.equal(res.status, 204);
  const [{ installed_at: installedAt, ...row }] = env.DB.rows('SELECT * FROM installs');
  // A new server reveals 20 hours after the post.
  assert.deepEqual(row, { guild_id: GUILD, channel_id: null, post_hour_utc: 14, reveal_delay_h: 20, roast: 0, last_recap: null, welcomed: TS });
  assert.match(installedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  // The system channel takes the post, so the channel list is never fetched.
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [`GET /api/v10/guilds/${GUILD}`, `POST /api/v10/channels/${SYSTEM}/messages`]);
  assert.ok(calls.every((c) => c.headers.authorization === 'Bot bot-token'));
  const [hello] = channelPosts(calls);
  assert.match(hello.body.content, /Play with friends/);
  assert.deepEqual(hello.body.components[0].components, [{ type: 2, style: 1, custom_id: 'start', label: 'Play solo' }, { type: 2, style: 1, custom_id: 'startparty', label: 'Play with friends' }]);
  assert.deepEqual(hello.body, WELCOME);
  assert.deepEqual(hello.body.allowed_mentions, { parse: [] });

  await runCron(env, '2026-10-06T14:00:00Z'); // no channel yet: the daily question waits for /bluff setup
  assert.equal(channelPosts(calls).length, 1);
});

test('server install: the system channel refuses, so text channels follow in position order until a post lands', async () => {
  const env = makeEnv();
  const channels = [
    text(T3, 3),
    text(SYSTEM, 0), // already tried as the system channel
    { id: '660000000000000051', type: 2, position: 0 }, // voice
    { id: '660000000000000052', type: 4, position: 0 }, // category
    { id: '660000000000000053', type: 5, position: 0 }, // announcement
    text(T2, 2),
    text(T1, 1),
  ];
  const calls = mockFetch({ discord: server({ channels, refuse: [SYSTEM] }) });
  await send(env, toEvents(authorized()));
  assert.deepEqual(posted(calls), [SYSTEM, T1]);
});

test('server install: no writable channel gives up quietly after 3 posts and keeps the server', async () => {
  const env = makeEnv();
  const channels = [text(T4, 4), text(T3, 3), text(T2, 2), text(T1, 1)];
  const calls = mockFetch({ discord: server({ system: null, channels, refuse: [T1, T2, T3, T4] }) });
  const logged = [];
  const consoleError = console.error;
  console.error = (line) => logged.push(line);
  try {
    const res = await send(env, toEvents(authorized()));
    assert.equal(res.status, 204);
  } finally {
    console.error = consoleError;
  }
  assert.deepEqual(posted(calls), [T1, T2, T3]);
  assert.deepEqual(logged, []);
  assert.deepEqual(env.DB.rows('SELECT guild_id, channel_id FROM installs'), [{ guild_id: GUILD, channel_id: null }]);
});

test('user install (integration_type 1) is acknowledged and ignored', async () => {
  const env = makeEnv();
  const calls = mockFetch({ discord: server() });
  for (const payload of [authorized({ integration: 1 }), authorized({ integration: 1, guild: true })]) {
    assert.equal((await send(env, toEvents(payload))).status, 204);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(env.DB.rows('SELECT * FROM installs'), []);
});

test('uninstall naming a server clears its channel so the hourly run skips it; the documented shape changes nothing', async () => {
  const env = makeEnv();
  await install(env, GUILD, { channel: CHANNEL, hour: 14 });
  await install(env, G2, { channel: C2, hour: 14 });
  const calls = mockFetch();
  const channelOf = (guild) => env.DB.rows('SELECT channel_id FROM installs WHERE guild_id = ?', guild)[0].channel_id;

  // As Discord documents it: the member who removed the app, and no server.
  const documented = await send(env, toEvents(event('APPLICATION_DEAUTHORIZED', { user: { id: USER } })));
  assert.equal(documented.status, 204);
  assert.equal(channelOf(GUILD), CHANNEL);

  const named = await send(env, toEvents(event('APPLICATION_DEAUTHORIZED', { user: { id: USER }, guild: { id: GUILD } })));
  assert.equal(named.status, 204);
  assert.equal(channelOf(GUILD), null);
  assert.equal(channelOf(G2), C2);

  await runCron(env, '2026-10-06T14:00:00Z');
  assert.deepEqual(posted(calls), [C2]);
});

test('a retried install event posts nothing more; a later install says hello again and keeps the settings', async () => {
  const env = makeEnv();
  const calls = mockFetch({ discord: server() });
  await send(env, toEvents(authorized()));
  await send(env, toEvents(authorized())); // Discord's retry: the same event, the same timestamp
  await Promise.all([send(env, toEvents(authorized())), send(env, toEvents(authorized()))]);
  assert.deepEqual(posted(calls), [SYSTEM]);

  await env.DB.prepare('UPDATE installs SET channel_id = ?, post_hour_utc = 9, roast = 1 WHERE guild_id = ?').bind(CHANNEL, GUILD).run();
  await send(env, toEvents(authorized({ timestamp: '2026-10-09T08:00:00.000000' }))); // removed, then added again
  assert.deepEqual(posted(calls), [SYSTEM, SYSTEM]);
  assert.deepEqual(env.DB.rows('SELECT channel_id, post_hour_utc, roast, welcomed FROM installs'), [
    { channel_id: CHANNEL, post_hour_utc: 9, roast: 1, welcomed: '2026-10-09T08:00:00.000000' },
  ]);
});

test('an install event for a server stored before the 20-hour default keeps its 8-hour reveal and settings', async () => {
  const env = makeEnv();
  await install(env, GUILD, { channel: CHANNEL, hour: 9 });
  const calls = mockFetch({ discord: server() });
  await send(env, toEvents(authorized()));
  assert.deepEqual(posted(calls), [SYSTEM]);
  assert.deepEqual(env.DB.rows('SELECT channel_id, post_hour_utc, reveal_delay_h, welcomed FROM installs'), [
    { channel_id: CHANNEL, post_hour_utc: 9, reveal_delay_h: 8, welcomed: TS },
  ]);
});

// A handler that awaited Discord would never answer while the gate is shut: node:test cancels the test once the event
// loop drains (the run exits 1), and the timeout is the backstop.
test('server install answers 204 without waiting for Discord; the server is registered before it', { timeout: 2000 }, async () => {
  const env = makeEnv();
  const calls = mockFetch({ discord: server() });
  const mocked = globalThis.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async (...args) => {
    await gate;
    return mocked(...args);
  };
  const ctx = makeCtx();
  const res = await worker.fetch(toEvents(authorized()), env, ctx);
  assert.equal(res.status, 204);
  assert.equal(calls.length, 0); // Discord not reached yet
  assert.equal(env.DB.rows('SELECT * FROM installs').length, 1);
  release();
  await ctx.settle();
  assert.deepEqual(posted(calls), [SYSTEM]);
});
