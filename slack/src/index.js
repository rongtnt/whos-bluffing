// HowSure for Slack: OAuth install, slash command, Play modal, results, channel leaderboard, hourly daily post.
// Slack must get an answer within 3 s, so every handler acks first and does the work in ctx.waitUntil.

import { verifySlack } from './verify.js';
import * as api from './api.js';
import * as store from './store.js';
import * as game from './game.js';

const SCOPES = 'commands,chat:write,chat:write.public,channels:read,groups:read,users:read';
const MAX_BODY = 1 << 20;
const DAY_MS = 86_400_000;
const PERIOD_DAYS = 30;
const MAX_MEMBERS = 1000;
const DEAD_TOKEN = new Set(['token_revoked', 'account_inactive', 'invalid_auth']);
const SETUP_RE = /^setup\s+<#([CG][A-Z0-9]+)(?:\|[^>]*)?>(?:\s+(\d{1,2}))?$/i;

const isoDate = (d) => d.toISOString().slice(0, 10);
const textResponse = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const ack = () => new Response(null, { status: 200 });
// Logs a short reason only: never request bodies, tokens or env values.
const logError = (where, err) => console.error(`howsure-slack ${where}: ${err?.message ?? err}`);

// Slack Web API. Form-encoded (accepted by every method); object params are JSON-encoded.
async function slack(token, method, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  });
  const data = await res.json();
  if (!data.ok) logError(method, { message: data.error });
  return data;
}

// Reply through a response_url: shows to the user (ephemeral by default) without needing channel membership.
const reply = (url, msg) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ response_type: 'ephemeral', replace_original: false, ...msg }),
  });

// Runs `work(install)` after the ack. Any failure becomes the friendly "taking a break" reply.
function background(ctx, env, teamId, url, work) {
  const run = async () => {
    const install = await store.getInstall(env.DB, teamId);
    if (!install) return reply(url, { text: game.NOT_INSTALLED });
    return work(install);
  };
  ctx.waitUntil(run().catch(async (err) => {
    logError('task', err);
    if (url) await reply(url, { text: game.FAIL_TEXT }).catch((e) => logError('reply', e));
  }));
}

// ---- OAuth v2 install --------------------------------------------------------------------------------------

const redirectUri = (request) => new URL('/slack/oauth/callback', request.url).href;

function oauthStart(request, env) {
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({ client_id: env.SLACK_CLIENT_ID, scope: SCOPES, redirect_uri: redirectUri(request), state });
  return new Response(null, {
    status: 302,
    headers: { location: url.href, 'set-cookie': `hs_state=${state}; Max-Age=600; Path=/slack/oauth; HttpOnly; Secure; SameSite=Lax` },
  });
}

async function oauthCallback(request, env) {
  const q = new URL(request.url).searchParams;
  const cookieState = /(?:^|;\s*)hs_state=([0-9a-f]{32})/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (!q.get('code') || !cookieState || q.get('state') !== cookieState) {
    return textResponse('The install was cancelled or expired. Please use the Add to Slack link again.', 400);
  }
  const res = await slack(null, 'oauth.v2.access', {
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code: q.get('code'),
    redirect_uri: redirectUri(request),
  });
  if (!res.ok || !res.team?.id || !res.access_token) return textResponse('The install did not work. Please use the Add to Slack link again.', 400);
  await store.saveInstall(env.DB, res.team.id, res.access_token, new Date().toISOString());
  return textResponse('HowSure is installed. In Slack, type /howsure setup #channel to choose where the daily game goes, or /howsure to play now.');
}

// ---- Slash command ------------------------------------------------------------------------------------------

function command(f, env, ctx) {
  const args = (f.text ?? '').trim();
  const later = (work) => {
    background(ctx, env, f.team_id, f.response_url, work);
    return ack();
  };
  if (args === '') return later((install) => postGame(env, install, f.channel_id, f.response_url));
  if (args.toLowerCase() === 'stats') return later((install) => showStats(env, install, f.channel_id, f.response_url));
  const m = SETUP_RE.exec(args);
  const hour = m?.[2] === undefined ? store.DEFAULT_HOUR : Number(m[2]);
  if (m && hour <= 23) return later((install) => setup(env, install, m[1], hour, f.response_url));
  return Response.json({ response_type: 'ephemeral', text: game.USAGE });
}

async function postGame(env, install, channel, url) {
  const day = await api.getDaily(env);
  const stats = await api.getStats(env, day.date).catch(() => null);
  const res = await slack(install.bot_token, 'chat.postMessage', { channel, ...game.dailyMessage(day, stats) });
  if (!res.ok) {
    const noAccess = res.error === 'not_in_channel' || res.error === 'channel_not_found';
    return reply(url, { text: noAccess ? game.CANT_POST : game.FAIL_TEXT });
  }
  // A manual post in the chosen channel becomes today's post (no second post from the cron, board updates it).
  if (channel === install.channel_id) await store.claimPost(env.DB, install.team_id, day.date, res.ts);
}

async function setup(env, install, channel, hour, url) {
  const info = await slack(install.bot_token, 'conversations.info', { channel });
  if (!info.ok || info.channel?.is_archived) return reply(url, { text: game.CANT_POST });
  await store.setChannel(env.DB, install.team_id, channel, hour);
  return reply(url, { text: `Done. HowSure will post the daily game in <#${channel}> every day at ${String(hour).padStart(2, '0')}:00 UTC.` });
}

async function showStats(env, install, channel, url) {
  const since = isoDate(new Date(Date.now() - (PERIOD_DAYS - 1) * DAY_MS));
  const board = await store.periodBoard(env.DB, install.team_id, since);
  const names = await displayNames(env, install, channel, board.top.map((r) => r.anon_id));
  return reply(url, { response_type: 'in_channel', ...game.statsMessage(board, names) });
}

// Names exist only at render time: hash the channel's members, match them to the stored ids, look up matches.
// ponytail: first 1000 channel members only; paginate conversations.members if bigger channels need names.
async function displayNames(env, install, channel, anonIds) {
  const names = new Map();
  if (!anonIds.length) return names;
  const wanted = new Set(anonIds);
  const res = await slack(install.bot_token, 'conversations.members', { channel, limit: MAX_MEMBERS });
  for (const user of res.ok ? res.members : []) {
    const anon = await api.anonId(env, install.team_id, user);
    if (!wanted.has(anon)) continue;
    const info = await slack(install.bot_token, 'users.info', { user });
    if (info.ok) names.set(anon, info.user.profile?.display_name || info.user.real_name || info.user.name);
    if (names.size === wanted.size) break;
  }
  return names;
}

// ---- Play button and modal ----------------------------------------------------------------------------------

function interaction(p, env, ctx) {
  if (p.type === 'block_actions' && p.actions?.some((a) => a.action_id === game.PLAY_ACTION)) {
    background(ctx, env, p.team.id, p.response_url, (install) => play(env, install, p));
    return ack();
  }
  if (p.type === 'view_submission' && p.view?.callback_id === game.MODAL_ID) {
    // Validation must answer inside the ack: once we return 200 the modal is gone.
    const { values, errors } = game.readAnswers(p.view.state.values);
    if (errors) return Response.json({ response_action: 'errors', errors });
    const meta = JSON.parse(p.view.private_metadata);
    background(ctx, env, p.team.id, meta.r, (install) => submit(env, install, p.user.id, meta, values));
  }
  return ack();
}

// The daily API is idempotent per (anon_id, date, item): a repeat answer returns the first result.
const sendAnswers = (env, day, values, who, rtMs) =>
  Promise.all(day.items.map((it) => api.answer(env, { date: day.date, item_id: it.id, ...values.get(it.id), ...who, rt_ms: rtMs })));

async function player(env, teamId, userId) {
  return { anon_id: await api.anonId(env, teamId, userId), community: await api.communityId(env, teamId) };
}

async function play(env, install, p) {
  const day = await api.getDaily(env);
  const who = await player(env, install.team_id, p.user.id);
  if (await store.getScore(env.DB, install.team_id, who.anon_id, day.date)) {
    // Already played: replay the stored results (placeholder ranges are ignored by the idempotent API).
    const placeholders = new Map(day.items.map((it) => [it.id, { low: it.accept[0], high: it.accept[1] }]));
    return reply(p.response_url, game.resultMessage(day, await sendAnswers(env, day, placeholders, who, 0), true));
  }
  // d pins the day the member saw; r is where the private result goes; t times the play.
  const meta = { d: day.date, r: p.response_url, t: Date.now() };
  const res = await slack(install.bot_token, 'views.open', { trigger_id: p.trigger_id, view: game.playModal(day, meta) });
  if (!res.ok) throw new Error(`views.open ${res.error}`);
}

async function submit(env, install, userId, meta, values) {
  const day = await api.getDaily(env, meta.d);
  const who = await player(env, install.team_id, userId);
  const already = await store.getScore(env.DB, install.team_id, who.anon_id, day.date);
  // Slack gives no per-field timing: rt_ms is the modal's open-to-submit time split evenly.
  const rtMs = Math.max(0, Math.round((Date.now() - meta.t) / day.items.length));
  const results = await sendAnswers(env, day, values, who, rtMs);
  if (already) return reply(meta.r, game.resultMessage(day, results, true));
  const done = await api.complete(env, { date: day.date, ...who });
  await store.addScore(env.DB, install.team_id, who.anon_id, day.date, done.hits);
  await reply(meta.r, game.resultMessage(day, results));
  await refreshBoard(env, install, day, done.today).catch((err) => logError('board', err));
}

// Updates today's post in the chosen channel with the board, or posts one if there is none yet.
async function refreshBoard(env, install, day, today) {
  const channel = install.channel_id;
  if (!channel) return;
  const board = await store.dayBoard(env.DB, install.team_id, day.date);
  const names = await displayNames(env, install, channel, board.top.map((r) => r.anon_id));
  const msg = game.dailyMessage(day, today, board, names);
  const post = await store.getPost(env.DB, install.team_id, day.date);
  if (post?.ts && (await slack(install.bot_token, 'chat.update', { channel, ts: post.ts, ...msg })).ok) return;
  const res = await slack(install.bot_token, 'chat.postMessage', { channel, ...msg });
  if (res.ok) await store.setPost(env.DB, install.team_id, day.date, res.ts);
}

// ---- Hourly cron --------------------------------------------------------------------------------------------

// Posts today's game to every install whose UTC hour has come, once per day (claim in `posts` first).
// ponytail: sequential posts, fine for a few thousand workspaces per run; batch them if the run gets long.
async function postDaily(env, now) {
  const date = isoDate(now);
  const due = await store.dueInstalls(env.DB, date, now.getUTCHours());
  if (!due.length) return;
  const day = await api.getDaily(env, date);
  const stats = await api.getStats(env, date).catch(() => null);
  const msg = game.dailyMessage(day, stats);
  for (const install of due) {
    if (!(await store.claimPost(env.DB, install.team_id, date))) continue;
    const res = await slack(install.bot_token, 'chat.postMessage', { channel: install.channel_id, ...msg });
    if (res.ok) {
      await store.setPost(env.DB, install.team_id, date, res.ts);
      continue;
    }
    await store.dropClaim(env.DB, install.team_id, date);
    if (DEAD_TOKEN.has(res.error)) await store.deleteInstall(env.DB, install.team_id); // uninstalled workspace
  }
}

// ---- Router -------------------------------------------------------------------------------------------------

async function events(request, env, ctx) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return textResponse('Too large', 413);
  const raw = await request.text();
  const h = request.headers;
  if (!(await verifySlack(env.SLACK_SIGNING_SECRET, h.get('x-slack-request-timestamp'), h.get('x-slack-signature'), raw))) {
    return textResponse('Invalid signature', 401);
  }
  const form = new URLSearchParams(raw);
  if (!form.has('payload')) return command(Object.fromEntries(form), env, ctx);
  let payload;
  try {
    payload = JSON.parse(form.get('payload'));
  } catch {
    return textResponse('Bad request', 400); // not logged: parse errors quote the input
  }
  return interaction(payload, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const { pathname } = new URL(request.url);
      const route = `${request.method} ${pathname}`;
      if (route === 'GET /slack/oauth/start') return oauthStart(request, env);
      if (route === 'GET /slack/oauth/callback') return await oauthCallback(request, env);
      if (route === 'POST /slack/events') return await events(request, env, ctx);
      return textResponse('Not found', 404);
    } catch (err) {
      logError('request', err);
      return textResponse('Something went wrong.', 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(postDaily(env, new Date(controller.scheduledTime)).catch((err) => logError('cron', err)));
  },
};
