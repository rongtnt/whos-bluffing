// Test doubles: D1 on node:sqlite (runs the real migration), a fetch mock for Slack and the daily API,
// and Slack-signed request builders.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import worker from '../src/index.js';

export const SECRET = 'test-signing-secret';
export const SALT = 'test-salt';
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const anon = (team, user) => sha256(`${team}:${user}:${SALT}`);

// Same call shapes as D1: prepare().bind().first() | .all() -> {results} | .run() -> {meta}; batch([...]).
export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    first: async () => {
      const row = db.prepare(sql).get(...args);
      return row ? { ...row } : null;
    },
    all: async () => ({ success: true, results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: (list) => Promise.all(list.map((s) => s.all())),
    rows: (sql, ...args) => db.prepare(sql).all(...args).map((r) => ({ ...r })),
  };
}

export const makeEnv = (db = fakeD1()) => ({
  DB: db,
  API_BASE: 'https://api.test',
  SLACK_SIGNING_SECRET: SECRET,
  SLACK_CLIENT_ID: 'client-id',
  SLACK_CLIENT_SECRET: 'client-secret',
  SALT,
});

export const DAY = {
  date: '2026-10-31',
  number: 12,
  items: [1, 2, 3, 4, 5].map((i) => ({ id: `w${i}`, prompt: `Question ${i}?`, unit: 'm', accept: [0, 100000] })),
};

// Odd items are hits, so a full play scores 3/5 with the grid 🟩🟥🟩🟥🟩.
const answerResult = (itemId) => {
  const i = Number(itemId.slice(1));
  return { hit: i % 2 === 1, truth: i * 1000, source: `https://www.wikidata.org/wiki/Q${i}`, log_ratio_error: 0.1 };
};

// Installs a fetch mock. `slack[method](call)` and `api[path](call)` override the defaults.
export function mockFetch({ slack = {}, api = {}, apiDown = false } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const raw = init.body;
    const body = raw instanceof URLSearchParams ? Object.fromEntries(raw) : raw ? JSON.parse(raw) : undefined;
    const call = { url, host: url.hostname, path: url.pathname, method: init.method ?? 'GET', body, headers: init.headers ?? {} };
    calls.push(call);
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (call.host === 'slack.com') {
      const method = call.path.replace('/api/', '');
      return json({ ok: true, ts: '1700000000.000100', ...(slack[method]?.(call) ?? {}) });
    }
    if (call.host === 'hooks.slack.com') return json({ ok: true });
    if (apiDown) return json({ error: 'down' }, 503);
    if (api[call.path]) return json(api[call.path](call));
    if (call.path === '/api/daily') return json(DAY);
    if (call.path === '/api/daily/stats') return json({ players: 10, avg_hits: 2.8, hist: [0, 1, 2, 3, 3, 1] });
    if (call.path === '/api/daily/answer') return json(answerResult(call.body.item_id));
    if (call.path === '/api/daily/complete') {
      return json({ hits: 3, n: 5, streak: 1, share_text: 'x', today: { players: 11, avg_hits: 2.9, hist: [0, 1, 2, 4, 3, 1] } });
    }
    throw new Error(`unexpected fetch ${url.href}`);
  };
  return calls;
}

export const slackCalls = (calls, method) => calls.filter((c) => c.host === 'slack.com' && c.path === `/api/${method}`);
export const apiCalls = (calls, path) => calls.filter((c) => c.host === 'api.test' && c.path === path);
export const replies = (calls) => calls.filter((c) => c.host === 'hooks.slack.com');

export function signedRequest(body, { ts = Math.floor(Date.now() / 1000), secret = SECRET } = {}) {
  const sig = `v0=${createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`;
  return new Request('https://worker.test/slack/events', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': String(ts), 'x-slack-signature': sig },
    body,
  });
}

export const slashBody = (fields = {}) =>
  new URLSearchParams({
    command: '/howsure', text: '', team_id: 'T1', user_id: 'U1', channel_id: 'C1',
    response_url: 'https://hooks.slack.com/commands/T1/1/abc', trigger_id: 'trigger-1', ...fields,
  }).toString();

export const payloadBody = (payload) => new URLSearchParams({ payload: JSON.stringify(payload) }).toString();

// Collects ctx.waitUntil work so a test can wait for it.
export function makeCtx() {
  const tasks = [];
  return { waitUntil: (p) => tasks.push(p), settle: () => Promise.all(tasks) };
}

// Sends a request through the worker and waits for the background work.
export async function send(env, request) {
  const ctx = makeCtx();
  const res = await worker.fetch(request, env, ctx);
  await ctx.settle();
  return res;
}

export async function install(env, team = 'T1', { channel = null, hour = 14 } = {}) {
  await env.DB.prepare('INSERT INTO installs (team_id, bot_token, channel_id, post_hour_utc, installed_at) VALUES (?, ?, ?, ?, ?)')
    .bind(team, `xoxb-${team}`, channel, hour, '2026-10-01T00:00:00Z').run();
}

export { worker };
