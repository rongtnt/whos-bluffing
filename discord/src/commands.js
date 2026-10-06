// Slash command definitions (exported for scripts/register-commands.mjs), every interaction handler, the
// post / reveal / recap actions the hourly tick shares with the commands, and the install hello.
// Discord needs an answer within 3 s: whatever needs no I/O answers at once (type 4); whatever needs I/O defers
// (type 5 for commands; type 6 for button presses, which keeps a flow in one message) and then edits @original
// through the interaction webhook.

import * as api from './api.js';
import * as store from './store.js';
import * as game from './game.js';

const DISCORD_API = 'https://discord.com/api/v10';
const COMMAND = 2;
const COMPONENT = 3;
const EPHEMERAL = 64;
const MANAGE = (1n << 5n) | (1n << 3n); // Manage Server or Administrator
const PERMISSIONS = String((1n << 11n) | (1n << 14n) | (1n << 16n)); // Send Messages, Embed Links, Read Message History
const GONE = new Set([403, 404]); // no access, or the channel or message no longer exists
const PERIOD_DAYS = 30;
const STREAK_LOOKBACK_DAYS = 366;
const HOUR_MS = 3_600_000;
const DISCORD_EPOCH_MS = 1_420_070_400_000;
const MAX_CUSTOM_ID = 100;

const [SUB, STRING, INTEGER, CHANNEL] = [1, 3, 4, 7];
const TEXT_CHANNEL = 0;
const GUILD_TEXT_CHANNELS = [TEXT_CHANNEL, 5]; // text and announcement channels
const WELCOME_TRIES = 3; // channels the install hello tries before giving up

// One global /bluff command; guild installs and server channels only.
export const COMMANDS = [{
  name: 'bluff',
  description: 'One question a day: pick A or B and say how sure you are',
  type: 1,
  integration_types: [0],
  contexts: [0],
  options: [
    { type: SUB, name: 'question', description: "Post today's question in this channel now" },
    { type: SUB, name: 'play', description: 'Play a private 10-question round' },
    { type: SUB, name: 'stats', description: "This server's leaderboard for the last 30 days" },
    {
      type: SUB,
      name: 'setup',
      description: 'Daily channel, hour, reveal delay and roast mode (Manage Server)',
      options: [
        { type: CHANNEL, name: 'channel', description: 'Where the daily question goes', channel_types: GUILD_TEXT_CHANNELS },
        { type: INTEGER, name: 'hour', description: 'Posting hour in UTC, 0 to 23 (default 14)', min_value: 0, max_value: 23 },
        { type: INTEGER, name: 'reveal', description: 'Hours from the post to the reveal, 2 to 23', min_value: 2, max_value: 23 },
        {
          type: STRING,
          name: 'roast',
          description: 'Name the biggest bluffer in the reveal (default off)',
          choices: [{ name: 'on', value: 'on' }, { name: 'off', value: 'off' }],
        },
      ],
    },
    { type: SUB, name: 'reveal', description: "Reveal today's answer now (Manage Server)" },
    { type: SUB, name: 'help', description: "How Who's Bluffing works" },
    { type: SUB, name: 'invite', description: "Get a link to add Who's Bluffing to another server" },
  ],
}];

// Logs a short reason only: never request bodies, tokens or env values.
export const logError = (where, err) => console.error(`whosbluffing-discord ${where}: ${err?.message ?? err}`);

export const installUrl = (env) =>
  `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: env.DISCORD_APP_ID,
    scope: 'bot applications.commands',
    permissions: PERMISSIONS,
    integration_type: '0',
  })}`;

// ---- Discord REST -------------------------------------------------------------------------------------------

const headers = (env) => ({ 'content-type': 'application/json', 'user-agent': `DiscordBot (${env.API_BASE}, 0.1)` });

// Bot-token call. Callers check res.ok / res.status.
const discord = (env, method, path, body) =>
  fetch(`${DISCORD_API}${path}`, {
    method,
    headers: { ...headers(env), authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    body: body && JSON.stringify(body),
  });

// Interaction webhook: edit the original response, or send a private follow-up. Needs no bot token.
async function webhook(env, token, method, path, msg) {
  const res = await fetch(`${DISCORD_API}/webhooks/${env.DISCORD_APP_ID}/${token}${path}`, {
    method,
    headers: headers(env),
    body: JSON.stringify({ allowed_mentions: game.NO_PINGS, ...msg }),
  });
  if (!res.ok) throw new Error(`webhook ${method} returned ${res.status}`);
}
const editOriginal = (env, token, msg) => webhook(env, token, 'PATCH', '/messages/@original', msg);
const followUp = (env, token, msg) => webhook(env, token, 'POST', '', { flags: EPHEMERAL, ...msg });

// A guild member's display name: server nickname, else global name, else username. Read at render time only.
const displayName = (m) => m.nick || m.user.global_name || m.user.username;

// Names exist only at render time: list the server's members, hash each, keep display names of the matches.
// Listing members needs the Server Members Intent; without it (403) everyone shows as "a member".
// ponytail: first 1000 members (one page); page with ?after= for bigger servers (one sha256 per member).
async function memberNames(env, guildId, anonIds) {
  const names = new Map();
  const wanted = new Set(anonIds);
  if (!wanted.size) return names;
  const res = await discord(env, 'GET', `/guilds/${guildId}/members?limit=1000`).catch(() => null);
  if (!res?.ok) return names;
  for (const m of await res.json()) {
    const anon = await api.anonId(env, guildId, m.user.id);
    if (wanted.has(anon)) names.set(anon, displayName(m));
    if (names.size === wanted.size) break;
  }
  return names;
}

// ---- Interaction plumbing -----------------------------------------------------------------------------------

const respond = (type, data) => Response.json(data === undefined ? { type } : { type, data });
const say = (data, { ephemeral = true } = {}) =>
  respond(4, { allowed_mentions: game.NO_PINGS, ...data, ...(ephemeral && { flags: EPHEMERAL }) });

// Defers now and finishes in the background. On failure a command's deferred reply becomes the "taking a break"
// notice; a pressed button keeps its message (so it can be pressed again) and the notice comes as a private follow-up.
function defer(ctx, env, i, work, { ephemeral = true, update = i.type === COMPONENT } = {}) {
  const run = async () => {
    const msg = await work();
    if (msg) await editOriginal(env, i.token, msg); // null: nothing to change (a repeated tap)
  };
  const fail = (err) => {
    logError('task', err);
    const notice = { content: game.FAIL_TEXT };
    const send = update ? followUp(env, i.token, notice) : editOriginal(env, i.token, notice);
    return send.catch((e) => logError('notice', e));
  };
  ctx.waitUntil(run().catch(fail));
  return update ? respond(6) : respond(5, ephemeral ? { flags: EPHEMERAL } : {});
}

const canManage = (i) => (BigInt(i.member.permissions ?? '0') & MANAGE) !== 0n;
const channelOf = (i) => i.channel?.id ?? i.channel_id;
const snowflakeMs = (id) => Number(BigInt(id) >> 22n) + DISCORD_EPOCH_MS;

async function who(env, i) {
  const [anonId, community] = await Promise.all([api.anonId(env, i.guild_id, i.member.user.id), api.communityId(env, i.guild_id)]);
  return { anon_id: anonId, community };
}

export function handleInteraction(i, env, ctx) {
  if (!i.guild_id || !i.member?.user?.id) return say({ content: game.GUILD_ONLY });
  if (i.type === COMMAND) return command(i, env, ctx);
  if (i.type === COMPONENT) return component(i, env, ctx);
  return new Response('Unsupported interaction', { status: 400 });
}

async function command(i, env, ctx) {
  const sub = i.data?.options?.[0];
  const opts = Object.fromEntries((sub?.options ?? []).map((o) => [o.name, o.value]));
  const later = (work, options) => defer(ctx, env, i, work, options);
  switch (sub?.name) {
    case 'question': return later(() => postToday(env, i));
    case 'play': return later(() => playStart(env, i));
    case 'stats': return later(() => stats(env, i), { ephemeral: false });
    case 'setup': return canManage(i) ? later(() => setup(env, i, opts)) : say({ content: game.NEED_MANAGE });
    case 'reveal': return canManage(i) ? later(() => revealNow(env, i)) : say({ content: game.NEED_MANAGE });
    case 'invite': return say({ content: game.invite(installUrl(env)) });
    // One D1 read, no Discord call: still answered at once.
    default: return say({ content: game.help(await store.getInstall(env.DB, i.guild_id), Date.now()) });
  }
}

function component(i, env, ctx) {
  const [kind, ...args] = i.data.custom_id.split(':');
  const later = (work) => defer(ctx, env, i, work);
  switch (kind) {
    // Public welcome buttons open a private round; never replace the server's welcome message.
    case 'start': return defer(ctx, env, i, () => playStart(env, i), { update: false });
    case 'q': return say(game.confidencePicker(args[0], args[1], args[2], Number(args[3])));
    case 'c': return later(() => lockIn(env, i, args));
    case 'pa': return later(() => playChoose(env, i, args));
    case 'pc': return later(() => playAnswer(env, i, args));
    case 'pn': return later(() => playNext(env, i, args));
    case 'pp': return later(() => playStart(env, i));
    case 'px': {
      const url = new URL(args.slice(1).join(':'), env.API_BASE).href;
      return say(game.challengePost(displayName(i.member), Number(args[0]), url), { ephemeral: false });
    }
    default: return say({ content: game.PLAY_ENDED });
  }
}

// ---- Daily question ------------------------------------------------------------------------------------------

// The hourly tick at or after now + delay: a post at 14:37 with an 8-hour delay reveals at 23:00.
const revealTime = (now, delayH) => new Date(Math.ceil((now.getTime() + delayH * HOUR_MS) / HOUR_MS) * HOUR_MS).toISOString();

// Posts the day's question with the bot token (a plain message the reveal can still edit hours later) and records
// it. Returns null when the day already has a post, else {status, revealAt} of the post call.
export async function postQuestion(env, install, channelId, date, q, now) {
  const revealAt = revealTime(now, install.reveal_delay_h);
  if (!(await store.claimPost(env.DB, install.guild_id, date, channelId, revealAt, q))) return null;
  let res;
  try {
    res = await discord(env, 'POST', `/channels/${channelId}/messages`, game.questionPost(q, date, revealAt));
  } catch (err) {
    await store.dropClaim(env.DB, install.guild_id, date);
    throw err;
  }
  if (!res.ok) await store.dropClaim(env.DB, install.guild_id, date);
  else await store.setPostMessage(env.DB, install.guild_id, date, (await res.json()).id);
  return { status: res.status, revealAt };
}

async function postToday(env, i) {
  const now = new Date();
  const date = game.isoDate(now);
  const install = await store.ensureInstall(env.DB, i.guild_id, now.toISOString());
  const existing = await store.getPost(env.DB, i.guild_id, date);
  if (existing) return { content: game.alreadyPosted(i.guild_id, existing) };
  const result = await postQuestion(env, install, channelOf(i), date, await api.dailyQuestion(env, date), now);
  if (!result) return { content: game.alreadyPosted(i.guild_id, await store.getPost(env.DB, i.guild_id, date)) };
  if (result.status < 300) return { content: game.posted(result.revealAt) };
  return { content: GONE.has(result.status) ? game.CANT_POST : game.FAIL_TEXT };
}

// Confidence tap on the private picker. rt_ms = picker shown -> confidence tap, both Discord timestamps.
// The API does not know this server's reveal hour, so the bot refuses answers once its own reveal has happened.
async function lockIn(env, i, [date, roundId, itemId, choiceText, confText]) {
  const post = await store.getPost(env.DB, i.guild_id, date);
  if (!post || post.revealed) return { content: game.TOO_LATE, components: [] };
  const choice = Number(choiceText);
  const conf = Number(confText);
  const me = await who(env, i);
  const before = await store.getAnswer(env.DB, i.guild_id, date, me.anon_id);
  try {
    // Daily questions come back {locked: true, points_pending: true}: no truth and no points until the reveal.
    await api.answer(env, {
      round_id: roundId,
      item_id: itemId,
      choice,
      conf,
      rt_ms: Math.max(0, snowflakeMs(i.id) - snowflakeMs(i.message.id)),
      ...me,
      ...(before && { revision: true }),
    });
  } catch (err) {
    if (err.status !== 409) throw err;
    // 409: the API locked that day (older than yesterday). Show the answer that stands, if there is one.
    return before ? game.lockedIn(before.choice, before.conf, post.reveal_at, true) : { content: game.TOO_LATE, components: [] };
  }
  await store.saveAnswer(env.DB, { guild_id: i.guild_id, anon_id: me.anon_id, date, choice, conf });
  return game.lockedIn(choice, conf, post.reveal_at);
}

// Edits the question post into the answer, drawn from the question stored with the post (daily-question only serves
// today and yesterday) and the reveal endpoint, whose `correct` also settles this server's points. Returns false when
// someone else revealed it first. A post that is gone (message or channel deleted, access lost) stays revealed; any
// other failure releases it for the next hourly run.
export async function revealPost(env, post) {
  if (!(await store.claimReveal(env.DB, post.guild_id, post.date))) return false;
  try {
    const community = await api.communityId(env, post.guild_id);
    const r = await api.reveal(env, post.date, community);
    if (r.correct !== 0 && r.correct !== 1) throw new Error('reveal came without the right answer');
    await store.settleAnswers(env.DB, post.guild_id, post.date, r.correct);
    const top = await store.dayTop(env.DB, post.guild_id, post.date);
    const bluff = r.biggest_bluff?.conf >= game.BLUFF_CONF ? r.biggest_bluff : null;
    const named = [...top.map((t) => t.anon_id), ...(bluff && post.roast ? [bluff.anon_id] : [])];
    const names = await memberNames(env, post.guild_id, named);
    const msg = game.revealMessage({ q: post, r, top, names, bluff, roast: Boolean(post.roast), installUrl: installUrl(env) });
    const res = await discord(env, 'PATCH', `/channels/${post.channel_id}/messages/${post.message_id}`, msg);
    if (!res.ok && !GONE.has(res.status)) throw new Error(`reveal edit returned ${res.status}`);
    return true;
  } catch (err) {
    await store.releaseReveal(env.DB, post.guild_id, post.date);
    throw err;
  }
}

async function revealNow(env, i) {
  const post = await store.openPost(env.DB, i.guild_id);
  const done = post && (await revealPost(env, post));
  return { content: done ? game.REVEALED : game.NOTHING_TO_REVEAL };
}

// ---- Install hello, setup, stats, recap ----------------------------------------------------------------------

// The install hello, posted once per install event: the server's system channel, else its text channels in position
// order. Stops at the post that lands and gives up quietly after WELCOME_TRIES posts (a server where Who's Bluffing may
// not write anywhere is fine). Returns the channel id, or null.
export async function welcomeGuild(env, guildId) {
  const read = async (path) => {
    const res = await discord(env, 'GET', path);
    return res.ok ? res.json() : null;
  };
  let tries = 0;
  const post = async (channelId) => {
    tries += 1;
    return (await discord(env, 'POST', `/channels/${channelId}/messages`, game.WELCOME)).ok;
  };
  const system = (await read(`/guilds/${guildId}`))?.system_channel_id;
  if (system && (await post(system))) return system;
  const channels = await read(`/guilds/${guildId}/channels`);
  const text = (Array.isArray(channels) ? channels : [])
    .filter((c) => c.type === TEXT_CHANNEL && c.id !== system)
    .sort((a, b) => a.position - b.position);
  for (const { id } of text) {
    if (tries >= WELCOME_TRIES) break;
    if (await post(id)) return id;
  }
  return null;
}

// Every option is optional: a missing one keeps its current value. A server without a channel gets this channel.
// Discord enforces each option's range (hour 0-23, reveal 2-23) from the registered command definition.
async function setup(env, i, opts) {
  const now = Date.now();
  const install = await store.ensureInstall(env.DB, i.guild_id, new Date(now).toISOString());
  const next = {
    channel_id: opts.channel ?? install.channel_id ?? channelOf(i),
    post_hour_utc: opts.hour ?? install.post_hour_utc,
    reveal_delay_h: opts.reveal ?? install.reveal_delay_h,
    roast: opts.roast === undefined ? install.roast : Number(opts.roast === 'on'),
  };
  // A new channel gets a short hello, which is also the check that Who's Bluffing may post there.
  if (next.channel_id !== install.channel_id) {
    const res = await discord(env, 'POST', `/channels/${next.channel_id}/messages`, game.channelHello(next.post_hour_utc, now));
    if (!res.ok) return { content: GONE.has(res.status) ? game.CANT_POST : game.FAIL_TEXT };
  }
  await store.saveSetup(env.DB, i.guild_id, next);
  return { content: game.setupDone({ ...install, ...next }, now) };
}

async function stats(env, i) {
  const since = game.addDays(game.isoDate(new Date()), -(PERIOD_DAYS - 1));
  const board = await store.periodBoard(env.DB, i.guild_id, since);
  return game.statsMessage(board, await memberNames(env, i.guild_id, board.top.map((r) => r.anon_id)));
}

// Monday's recap of the 7 days before `date`. Skipped when nobody answered.
export async function postRecap(env, install, date) {
  const to = game.addDays(date, -1);
  const week = await store.weekStats(env.DB, install.guild_id, game.addDays(date, -7), to, game.BLUFF_CONF);
  if (!week.answers) return false;
  const days = await store.answerDays(env.DB, install.guild_id, game.addDays(date, -STREAK_LOOKBACK_DAYS), to);
  const best = game.mostCalibrated(week.members);
  const names = await memberNames(env, install.guild_id, best ? [best.anon_id] : []);
  const msg = game.recapMessage({ ...week, streak: game.streak(days, to) }, best, names);
  const res = await discord(env, 'POST', `/channels/${install.channel_id}/messages`, msg);
  if (!res.ok) throw new Error(`recap post returned ${res.status}`);
  return true;
}

// ---- /bluff play ------------------------------------------------------------------------------------------

// The member's state for this button's round; null when the button belongs to an older or finished round.
async function playFor(env, i, roundId) {
  const me = await who(env, i);
  const state = await store.getPlay(env.DB, me.anon_id);
  return { me, state: state?.round_id === roundId ? state : null };
}

// A button from a round that has moved on: a repeated tap changes nothing; an older round says it has ended.
const stale = (state) => (state ? null : { content: game.PLAY_ENDED, components: [] });

async function playStart(env, i) {
  const me = await who(env, i);
  const round = await api.quickRound(env);
  const items = round.items.map(({ id, prompt, a, b }) => ({ id, prompt, a, b }));
  await store.startPlay(env.DB, me.anon_id, round.round_id, items, Date.now());
  return game.playQuestion({ round_id: round.round_id, items, total: 0 }, 0);
}

async function playChoose(env, i, [roundId, stepText, choiceText]) {
  const { state } = await playFor(env, i, roundId);
  if (state?.step !== Number(stepText)) return stale(state);
  return game.playConfidence(state, state.step, Number(choiceText));
}

// rt_ms = question shown -> confidence tap.
async function playAnswer(env, i, [roundId, stepText, choiceText, confText]) {
  const { me, state } = await playFor(env, i, roundId);
  const step = Number(stepText);
  if (state?.step !== step) return stale(state);
  const choice = Number(choiceText);
  const conf = Number(confText);
  const res = await api.answer(env, {
    round_id: roundId, item_id: state.items[step].id, choice, conf, rt_ms: Math.max(0, Date.now() - state.updated_at), ...me,
  });
  const total = Math.round(res.total ?? state.total + res.points);
  if (!(await store.advancePlay(env.DB, me.anon_id, roundId, step, step + 1, total))) return null; // another tap won
  return game.playResult({ ...state, total }, step, choice, conf, res);
}

async function playNext(env, i, [roundId, stepText]) {
  const { me, state } = await playFor(env, i, roundId);
  const step = Number(stepText);
  if (state?.step !== step) return stale(state);
  if (step < state.items.length) {
    await store.touchPlay(env.DB, me.anon_id, Date.now());
    return game.playQuestion(state, step);
  }
  // All answered: finish the round once, even if "See your score" is pressed twice.
  if (!(await store.advancePlay(env.DB, me.anon_id, roundId, step, step + 1, state.total))) return null;
  let done;
  try {
    done = await api.complete(env, { round_id: roundId, ...me });
  } catch (err) {
    await store.advancePlay(env.DB, me.anon_id, roundId, step + 1, step, state.total); // let the button retry
    throw err;
  }
  await store.endPlay(env.DB, me.anon_id);
  const challengeId = done.challenge_url && `px:${Math.round(done.score)}:${done.challenge_url}`;
  return game.playEnd(done, challengeId?.length <= MAX_CUSTOM_ID ? challengeId : null, installUrl(env));
}
