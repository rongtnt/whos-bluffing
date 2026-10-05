// whosbluffing-x: watches the accounts in watch.js and pages the owner (Discord webhook) with a personalised draft
// and a prefilled reply link when one of them posts; publishes posts as @whos_bluffing on request. Nothing is
// replied automatically: X's automation rules forbid unsolicited scripted replies, and the account carries Premium.
// X API v2, pay-per-use: $0.005 per post read, $0.010 per user looked up, $0.015 per post created, $0.200 when the
// post contains a URL (docs.x.com, October 2026).
import { oauthHeader } from './oauth.js';
import { pickReplies } from './replies.js';
import { WATCH, dare, replyIntent } from './watch.js';

const API = 'https://api.x.com/2';
const MAX_NEW = 5; // the endpoint's minimum page; at $0.005 a read the busiest day costs cents
const BATCH = 10; // timelines fetched at once
const POST_ID = /^\d{1,25}$/;
const DAY_S = 86400;

export default {
  scheduled(_event, env, ctx) {
    ctx.waitUntil(poll(env));
  },

  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    if (request.method !== 'POST') return new Response('not found', { status: 404 });
    if (!env.BOT_KEY || request.headers.get('x-bluff-bot') !== env.BOT_KEY) return new Response('forbidden', { status: 403 });
    if (pathname === '/poll') return Response.json(await poll(env));
    if (pathname === '/post') return post(request, env);
    return new Response('not found', { status: 404 });
  },
};

// POST /post {text, reply_to?} -> {id, text}. Validated here; X validates length by its own counting.
async function post(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('json body required', { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 4000) return new Response('text must be 1 to 4000 characters', { status: 400 });
  const replyTo = body.reply_to == null ? null : String(body.reply_to);
  if (replyTo && !POST_ID.test(replyTo)) return new Response('reply_to must be a post id', { status: 400 });
  try {
    return Response.json(await createPost(env, text, replyTo));
  } catch (e) {
    console.error(e.message);
    return new Response(e.message, { status: 502 });
  }
}

// One pass over the watched accounts, in batches. Returns per handle the number of alerts sent, or the error text.
async function poll(env) {
  if (!env.X_BEARER_TOKEN || !env.ALERT_WEBHOOK) return { skipped: 'X_BEARER_TOKEN or ALERT_WEBHOOK not set' };
  const ids = await userIds(env);
  const out = {};
  const users = WATCH.filter((u) => ids[u.handle.toLowerCase()]).map((u) => ({ ...u, id: ids[u.handle.toLowerCase()] }));
  for (const u of WATCH) if (!ids[u.handle.toLowerCase()]) out[u.handle] = 'no id (handle changed or suspended?)';
  for (let i = 0; i < users.length; i += BATCH) {
    const results = await Promise.allSettled(users.slice(i, i + BATCH).map(async (user) => {
      const posts = await newPosts(env, user);
      for (const p of posts) await alert(env, user, p);
      return posts.length;
    }));
    results.forEach((r, j) => {
      const { handle } = users[i + j];
      out[handle] = r.status === 'fulfilled' ? r.value : r.reason.message;
      if (r.status === 'rejected') console.error(`${handle}: ${r.reason.message}`);
    });
  }
  return out;
}

// handle (lower case) -> id, cached in KV; only handles missing from the cache are looked up (100 per request).
async function userIds(env) {
  const cached = JSON.parse((await env.STATE.get('ids')) || '{}');
  const missing = WATCH.map((u) => u.handle).filter((h) => !cached[h.toLowerCase()]);
  if (!missing.length) return cached;
  const r = await fetch(`${API}/users/by?usernames=${missing.slice(0, 100).join(',')}`, { headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` } });
  if (!r.ok) throw new Error(`users/by: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  const ids = { ...cached };
  for (const u of body.data ?? []) ids[u.username.toLowerCase()] = u.id;
  for (const e of body.errors ?? []) console.error(`users/by: ${e.value}: ${e.detail ?? e.title}`);
  await env.STATE.put('ids', JSON.stringify(ids));
  return ids;
}

// New original posts since the last poll, oldest first (replies and reposts excluded). The first poll only records
// where the timeline is, so a fresh deploy does not page the owner with stale posts.
async function newPosts(env, user) {
  const since = await env.STATE.get(`since:${user.id}`);
  const q = new URLSearchParams({ max_results: String(MAX_NEW), exclude: 'retweets,replies', 'tweet.fields': 'created_at' });
  if (since) q.set('since_id', since);
  const r = await fetch(`${API}/users/${user.id}/tweets?${q}`, { headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` } });
  if (!r.ok) throw new Error(`timeline @${user.handle}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  if (body.meta?.newest_id) await env.STATE.put(`since:${user.id}`, body.meta.newest_id);
  return since ? (body.data ?? []).reverse() : [];
}

// How many of this person's posts were alerted today (UTC), so the owner can keep to one reply per person per day.
async function countToday(env, handle) {
  const key = `n:${handle}:${new Date().toISOString().slice(0, 10)}`;
  const n = Number((await env.STATE.get(key)) || 0) + 1;
  await env.STATE.put(key, String(n), { expirationTtl: 2 * DAY_S });
  return n;
}

async function alert(env, user, p) {
  const n = await countToday(env, user.handle);
  const draft = dare(user, p.id);
  const [question] = pickReplies(p.text);
  const when = p.created_at ? ` at ${p.created_at.slice(11, 16)} UTC` : '';
  const nth = n === 1 ? 'first post today' : `post ${n} today: one reply per person per day, skip unless this one is better`;
  const lines = [
    `**@${user.handle}** posted${when} (${nth}):`,
    `> ${p.text.replace(/\s*\n+\s*/g, ' ').slice(0, 400)}`,
    `https://x.com/${user.handle}/status/${p.id}`,
    '',
    `Reply, prefilled (tap, read, post): <${replyIntent(p.id, draft)}>`,
    `Draft: ${draft}`,
    ...(question ? ['', `Question version, no link: <${replyIntent(p.id, question)}>`, `Draft: ${question}`] : ['', 'Somber or off topic: skip this one.']),
  ];
  const r = await fetch(env.ALERT_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: lines.join('\n').slice(0, 1990), allowed_mentions: { parse: [] } }),
  });
  if (!r.ok) throw new Error(`webhook: ${r.status}`);
}

async function createPost(env, text, replyTo) {
  for (const k of ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET']) if (!env[k]) throw new Error(`${k} not set`);
  const url = `${API}/tweets`;
  const authorization = await oauthHeader({
    method: 'POST', url, key: env.X_API_KEY, secret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET,
  });
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ text, ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}) }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`post: ${r.status} ${JSON.stringify(out).slice(0, 300)}`);
  return out.data;
}
