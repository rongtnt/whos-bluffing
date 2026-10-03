// Client for the daily API (docs/api-daily.md) plus the salted member and workspace hashes.
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
export const communityId = (env, teamId) => sha256Hex(`${teamId}:${salt(env)}`);

async function call(env, path, body) {
  const init = body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(env.API_BASE.replace(/\/$/, '') + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`daily API ${path.split('?')[0]} returned ${res.status}`);
  return res.json();
}

const dateQuery = (date) => (date ? `?date=${encodeURIComponent(date)}` : '');

export const getDaily = (env, date) => call(env, `/api/daily${dateQuery(date)}`);
export const getStats = (env, date) => call(env, `/api/daily/stats${dateQuery(date)}`);
export const answer = (env, body) => call(env, '/api/daily/answer', { ...body, surface: 'slack' });
export const complete = (env, body) => call(env, '/api/daily/complete', { ...body, surface: 'slack' });
