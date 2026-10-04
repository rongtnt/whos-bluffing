import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands.js';
import {
  APP_ID, CHANNEL, GUILD, MANAGER, addAnswer, channelOfPost, channelPosts, commandPayload, freeze, install, makeEnv, mockFetch,
  originalEdits, revealAt, send, signedRequest, stampAt, today,
} from './helpers.js';

const C2 = '660000000000000002';
const C3 = '660000000000000003';
const run = (env, sub, options = [], who = {}) => send(env, signedRequest(commandPayload(sub, options, who)));
const setupAs = (env, options, permissions = MANAGER) => run(env, 'setup', options, { permissions });
const lastReply = (calls) => originalEdits(calls).at(-1).body.content;

test('GET /install redirects to Discord with bot + applications.commands, minimal permissions, guild install', async () => {
  mockFetch();
  const res = await send(makeEnv(), new Request('https://worker.test/install'));
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(`${loc.origin}${loc.pathname}`, 'https://discord.com/oauth2/authorize');
  assert.deepEqual(Object.fromEntries(loc.searchParams), {
    client_id: APP_ID,
    scope: 'bot applications.commands',
    permissions: String(2048 + 16384 + 65536), // Send Messages, Embed Links, Read Message History
    integration_type: '0',
  });
});

test('one guild-only /bluff command with the brief\'s subcommands', () => {
  assert.equal(COMMANDS.length, 1);
  const [cmd] = COMMANDS;
  assert.deepEqual([cmd.name, cmd.integration_types, cmd.contexts], ['bluff', [0], [0]]);
  assert.deepEqual(cmd.options.map((o) => o.name), ['question', 'play', 'stats', 'setup', 'reveal', 'help', 'invite']);
  const setup = cmd.options.find((o) => o.name === 'setup');
  assert.deepEqual(setup.options.map((o) => [o.name, o.type, o.required ?? false]),
    [['channel', 7, false], ['hour', 4, false], ['reveal', 4, false], ['roast', 3, false]]);
  // Discord enforces the range. 23 at most keeps a reveal inside the API's answer window (the question's day or the next).
  const reveal = setup.options.find((o) => o.name === 'reveal');
  assert.deepEqual([reveal.min_value, reveal.max_value], [2, 23]);
  for (const o of [cmd, ...cmd.options, ...setup.options]) assert.ok(o.description.length <= 100, o.name);
});

test('setup: Manage Server only; sets channel, hour, reveal and roast; a new channel gets a hello; missing options keep their value', async (t) => {
  freeze(t, '2026-10-06T10:30:00Z');
  const nine = stampAt('2026-10-06T09:00:00Z'); // the hour, shown in each reader's own time zone
  const env = makeEnv();
  let calls = mockFetch();
  const denied = await setupAs(env, [], '0');
  assert.equal((await denied.json()).data.content, 'Only members with the Manage Server permission can do that.');
  assert.equal(calls.length, 0);

  const res = await setupAs(env, [{ name: 'channel', type: 7, value: C2 }, { name: 'hour', type: 4, value: 9 }, { name: 'roast', type: 3, value: 'on' }]);
  assert.deepEqual(await res.json(), { type: 5, data: { flags: 64 } });
  const [hello] = channelPosts(calls);
  assert.equal(channelOfPost(hello), C2);
  assert.equal(hello.body.content, `Who's Bluffing will post a question here every day at ${nine}. Tap A or B, then say how sure you are.`);
  // A new server: the reveal comes 20 hours after the post.
  assert.equal(lastReply(calls),
    `Done. Who's Bluffing posts a question in <#${C2}> every day at ${nine} (09:00 UTC) and reveals the answer 20 hours later. Roast mode is on: the reveal names the biggest bluffer.`);
  const row = () => env.DB.rows('SELECT channel_id, post_hour_utc, reveal_delay_h, roast FROM installs')[0];
  assert.deepEqual(row(), { channel_id: C2, post_hour_utc: 9, reveal_delay_h: 20, roast: 1 });

  await setupAs(env, [{ name: 'roast', type: 3, value: 'off' }]);
  assert.equal(channelPosts(calls).length, 1); // same channel: no second hello
  assert.deepEqual(row(), { channel_id: C2, post_hour_utc: 9, reveal_delay_h: 20, roast: 0 });
  assert.match(lastReply(calls), /Roast mode is off: the bluffer stays anonymous\.$/);

  await setupAs(env, [{ name: 'reveal', type: 4, value: 12 }]);
  assert.deepEqual(row(), { channel_id: C2, post_hour_utc: 9, reveal_delay_h: 12, roast: 0 });
  assert.match(lastReply(calls), /\(09:00 UTC\) and reveals the answer 12 hours later\./);

  // A channel Who's Bluffing cannot post in is refused and nothing changes.
  calls = mockFetch({ discord: (c) => (c.method === 'POST' ? { status: 403, body: { code: 50013 } } : undefined) });
  await setupAs(env, [{ name: 'channel', type: 7, value: C3 }]);
  assert.match(lastReply(calls), /^I can't post in that channel\./);
  assert.deepEqual(row(), { channel_id: C2, post_hour_utc: 9, reveal_delay_h: 12, roast: 0 });
});

test('a server stored before the 20-hour default keeps its 8-hour reveal through setup; reveal changes it', async (t) => {
  freeze(t, '2026-10-06T10:30:00Z');
  const env = makeEnv();
  await install(env, GUILD, { channel: CHANNEL });
  const calls = mockFetch();
  await setupAs(env, [{ name: 'hour', type: 4, value: 20 }, { name: 'roast', type: 3, value: 'on' }]);
  assert.equal(channelPosts(calls).length, 0); // same channel: no hello
  assert.equal(lastReply(calls),
    `Done. Who's Bluffing posts a question in <#${CHANNEL}> every day at ${stampAt('2026-10-06T20:00:00Z')} (20:00 UTC) and reveals the answer 8 hours later. Roast mode is on: the reveal names the biggest bluffer.`);
  assert.deepEqual(env.DB.rows('SELECT post_hour_utc, reveal_delay_h, roast FROM installs'), [{ post_hour_utc: 20, reveal_delay_h: 8, roast: 1 }]);
  await setupAs(env, [{ name: 'reveal', type: 4, value: 2 }]);
  assert.deepEqual(env.DB.rows('SELECT post_hour_utc, reveal_delay_h, roast FROM installs'), [{ post_hour_utc: 20, reveal_delay_h: 2, roast: 1 }]);
  assert.match(lastReply(calls), /reveals the answer 2 hours later/);
});

test('setup with no options in a fresh server picks the current channel and the defaults (14:00 UTC, reveal 20 h, roast off)', async () => {
  const env = makeEnv();
  const calls = mockFetch();
  await setupAs(env, []);
  assert.equal(channelOfPost(channelPosts(calls)[0]), CHANNEL);
  assert.deepEqual(env.DB.rows('SELECT guild_id, channel_id, post_hour_utc, reveal_delay_h, roast FROM installs'), [
    { guild_id: GUILD, channel_id: CHANNEL, post_hour_utc: 14, reveal_delay_h: 20, roast: 0 },
  ]);
});

test("/bluff question posts today's question here with the bot token, once; later calls link to it", async () => {
  const env = makeEnv();
  let calls = mockFetch();
  const res = await run(env, 'question');
  assert.deepEqual(await res.json(), { type: 5, data: { flags: 64 } });
  const [post] = channelPosts(calls);
  assert.equal(channelOfPost(post), CHANNEL);
  assert.equal(post.headers.authorization, 'Bot bot-token');
  assert.match(post.body.content, /^\*\*Who's Bluffing\?\*\* · Which is longer: the Nile or the Danube\?\n/);
  const [row] = env.DB.rows('SELECT date, channel_id, message_id, reveal_at, revealed FROM posts');
  assert.deepEqual({ ...row, reveal_at: undefined }, { date: today(), channel_id: CHANNEL, message_id: '9001', reveal_at: undefined, revealed: 0 });
  // A new server's reveal: the hourly tick at or after post time + 20 hours.
  const hours = (Date.parse(row.reveal_at) - Date.now()) / 3_600_000;
  assert.ok(hours > 19 && hours <= 21 && row.reveal_at.endsWith(':00:00.000Z'), row.reveal_at);
  assert.equal(lastReply(calls), `Posted. The answer comes out at ${revealAt(row.reveal_at)}.`);
  assert.match(lastReply(calls), /^Posted\. The answer comes out at <t:\d+:t> \(<t:\d+:R>\)\.$/);

  await run(env, 'question', [], { channel: C2 });
  assert.equal(channelPosts(calls).length, 1);
  assert.equal(lastReply(calls), `Today's question is already up: https://discord.com/channels/${GUILD}/${CHANNEL}/9001`);

  // In a channel Who's Bluffing cannot post in: a clear reply and no claimed day.
  const env2 = makeEnv();
  calls = mockFetch({ discord: (c) => (c.method === 'POST' ? { status: 403, body: { code: 50001 } } : undefined) });
  await run(env2, 'question');
  assert.match(lastReply(calls), /^I can't post in that channel\./);
  assert.equal(env2.DB.rows('SELECT * FROM posts').length, 0);
});

test('/bluff stats is public: the 30-day board by points (revealed answers) with names looked up live, plus participation', async () => {
  const env = makeEnv();
  await install(env);
  const [MAYA, SAM, ANA] = ['880000000000000031', '880000000000000032', '880000000000000033'];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await addAnswer(env, { user: MAYA, date: today(), choice: 0, conf: 90 }); // +96
  await addAnswer(env, { user: MAYA, date: yesterday, choice: 1, conf: 60 }); // -44
  await addAnswer(env, { user: SAM, date: today(), choice: 0, conf: 100 }); // +100
  await addAnswer(env, { user: ANA, date: yesterday, choice: 0, conf: 50 }); // 0
  await addAnswer(env, { user: ANA, date: '2020-01-01', choice: 0, conf: 100 }); // outside the window
  await addAnswer(env, { user: '880000000000000034', date: today(), choice: 1, conf: 90, pending: true }); // not revealed yet
  const calls = mockFetch({
    discord: (c) => (c.path.endsWith('/members')
      ? { body: [{ user: { id: SAM, username: 'sam' }, nick: 'Sam' }, { user: { id: MAYA, username: 'maya', global_name: 'Maya' } }] }
      : undefined),
  });
  const res = await run(env, 'stats');
  assert.deepEqual(await res.json(), { type: 5, data: {} });
  assert.equal(lastReply(calls), [
    "**Who's Bluffing, last 30 days:** 3 members answered 4 times on 2 days.",
    '1. Sam — 100 points from 1 answer',
    '2. Maya — 52 points from 2 answers',
    '3. a member — 0 points from 1 answer',
  ].join('\n'));
});

test("help and invite answer at once; a DM is told Who's Bluffing lives in servers", async () => {
  const env = makeEnv();
  const calls = mockFetch();
  const help = await (await run(env, 'help')).json();
  assert.equal(help.type, 4);
  assert.equal(help.data.flags, 64);
  assert.match(help.data.content, /`\/bluff play` play a private 10-question round/);
  const invite = await (await run(env, 'invite')).json();
  assert.match(invite.data.content, /^Add Who's Bluffing to a server: https:\/\/discord\.com\/oauth2\/authorize\?client_id=424242&/);
  const dm = await (await send(env, signedRequest({ ...commandPayload('help'), guild_id: undefined, member: undefined, user: { id: '1' } }))).json();
  assert.equal(dm.data.content, "Who's Bluffing works inside a server. Use /bluff invite to add it to one.");
  assert.equal(calls.length, 0);
});

test("help gives this server's hour in each reader's own time and its own reveal delay", async (t) => {
  freeze(t, '2026-10-06T10:30:00Z');
  const help = async (env) => (await (await run(env, 'help')).json()).data.content.split('\n');
  const commands = [
    'Points reward honest confidence: 50% scores 0; 100% scores +100 if right and -300 if wrong.',
    '',
    "`/bluff question` post today's question in this channel now",
    '`/bluff play` play a private 10-question round',
    "`/bluff stats` this server's leaderboard for the last 30 days",
    "`/bluff invite` get a link to add Who's Bluffing to another server",
    '`/bluff setup` set the daily channel, hour (UTC), reveal (hours until the answer) and roast mode (Manage Server)',
    "`/bluff reveal` reveal today's answer now (Manage Server)",
  ];
  mockFetch();
  // Before any setup: no hour to show yet, and a new server's reveal delay.
  assert.deepEqual(await help(makeEnv()), [
    "**Who's Bluffing** posts one question a day. Tap A or B, then say how sure you are. The answer and this server's top 5 come out 20 hours later. Every Monday brings last week's recap.",
    ...commands,
  ]);
  const env = makeEnv();
  await install(env, GUILD, { channel: CHANNEL, hour: 14 });
  assert.deepEqual(await help(env), [
    `**Who's Bluffing** posts one question a day, here in <#${CHANNEL}> at <t:1791295200:t>. Tap A or B, then say how sure you are. The answer and this server's top 5 come out 8 hours later. Every Monday brings last week's recap.`,
    ...commands,
  ]);
  assert.equal(stampAt('2026-10-06T14:00:00Z'), '<t:1791295200:t>');
});

test('register-commands.mjs PUTs COMMANDS to the global commands endpoint with the bot token', async () => {
  const calls = mockFetch();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(COMMANDS);
  };
  const { log } = console;
  console.log = () => {};
  Object.assign(process.env, { DISCORD_APP_ID: APP_ID, DISCORD_BOT_TOKEN: 'bot-token' });
  try {
    await import('../scripts/register-commands.mjs');
  } finally {
    console.log = log;
    globalThis.fetch = realFetch;
  }
  const put = calls.at(-1);
  assert.equal(put.url, `https://discord.com/api/v10/applications/${APP_ID}/commands`);
  assert.equal(put.init.method, 'PUT');
  assert.equal(put.init.headers.authorization, 'Bot bot-token');
  assert.deepEqual(JSON.parse(put.init.body), COMMANDS);
});
