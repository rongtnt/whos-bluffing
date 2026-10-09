// Client for the rounds API, chat-platform part (docs/api-rounds.md), plus the salted member and workspace hashes.
// Raw Slack ids never leave this worker: the API only ever sees the hashes.

const TIMEOUT_MS = 5000;
const enc = new TextEncoder();

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Never hash without the salt; never call the API without the bot key.
function secret(env, name) {
  if (!env[name]) throw new Error(`${name} is not set`);
  return env[name];
}

export const anonId = (env, teamId, userId) => sha256Hex(`${teamId}:${userId}:${secret(env, 'SALT')}`);
export const communityId = async (env, teamId) => `slack:${await sha256Hex(`${teamId}:${secret(env, 'SALT')}`)}`;
export const playId = (env, teamId, value) => sha256Hex(`play:${teamId}:${value}:${secret(env, 'SALT')}`);

// Every call carries the bot key (the API needs it for same-day reveals; the WAF exempts it from rate limits).
// Throws on any non-2xx; err.status carries the HTTP status (absent on timeouts and network errors).
async function call(env, path, body) {
  const headers = { 'x-bluff-bot': secret(env, 'BOT_KEY') };
  const init = body
    ? { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : { headers };
  const res = await fetch(env.API_BASE.replace(/\/$/, '') + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw Object.assign(new Error(`rounds API ${path.split('?')[0]} returned ${res.status}`), { status: res.status });
  return res.json();
}

// The response has no date field, so callers always pass the date and key storage by it.
export const getQuestion = (env, date) => call(env, `/api/round/daily-question?date=${encodeURIComponent(date)}`);
export const answer = (env, body) => call(env, '/api/round/answer', { ...body, surface: 'slack' });
export const quickRound = (env, params) => call(env, `/api/round?${new URLSearchParams({ mode: 'quick', ...params })}`);
export const complete = (env, body) => call(env, '/api/round/complete', { ...body, surface: 'slack' });
export const flag = (env, body) => call(env, '/api/flag', body);
export const getReveal = (env, date, community) =>
  call(env, `/api/round/reveal?${new URLSearchParams({ date, community })}`);
