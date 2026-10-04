// Client for the rounds API, chat-platform part (docs/api-rounds.md), plus the salted member and workspace hashes.
// Raw Slack ids never leave this worker: the API only ever sees the hashes.

const TIMEOUT_MS = 5000;
const enc = new TextEncoder();

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function salt(env) {
  if (!env.SALT) throw new Error('SALT is not set'); // never hash without the salt
  return env.SALT;
}

export const anonId = (env, teamId, userId) => sha256Hex(`${teamId}:${userId}:${salt(env)}`);
export const communityId = async (env, teamId) => `slack:${await sha256Hex(`${teamId}:${salt(env)}`)}`;

// Throws on any non-2xx; err.status carries the HTTP status (absent on timeouts and network errors).
async function call(env, path, body) {
  const init = body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(env.API_BASE.replace(/\/$/, '') + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw Object.assign(new Error(`rounds API ${path.split('?')[0]} returned ${res.status}`), { status: res.status });
  return res.json();
}

// The response has no date field, so callers always pass the date and key storage by it.
export const getQuestion = (env, date) => call(env, `/api/round/daily-question?date=${encodeURIComponent(date)}`);
export const answer = (env, body) => call(env, '/api/round/answer', { ...body, surface: 'slack' });
export const getReveal = (env, date, community) =>
  call(env, `/api/round/reveal?${new URLSearchParams({ date, community })}`);
