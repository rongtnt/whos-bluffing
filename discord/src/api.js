// Client for the rounds API (docs/api-rounds.md) plus the salted member and server hashes.
// Raw Discord ids never leave this worker: the API only ever sees the hashes.

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

export const anonId = (env, guildId, userId) => sha256Hex(`${guildId}:${userId}:${salt(env)}`);
export const communityId = async (env, guildId) => `discord:${await sha256Hex(`${guildId}:${salt(env)}`)}`;

async function call(env, path, body) {
  const init = body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(env.API_BASE.replace(/\/$/, '') + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  // 400 invalid, 404 unknown round or item, 409 locked (a daily question older than yesterday), 429 rate limited.
  if (!res.ok) throw Object.assign(new Error(`rounds API ${path.split('?')[0]} returned ${res.status}`), { status: res.status });
  return res.json();
}

const query = (params) => `?${new URLSearchParams(params)}`;

export const dailyQuestion = (env, date) => call(env, `/api/round/daily-question${query({ date })}`);
export const reveal = (env, date, community) => call(env, `/api/round/reveal${query({ date, community })}`);
export const quickRound = (env) => call(env, '/api/round?mode=quick');
export const answer = (env, body) => call(env, '/api/round/answer', { ...body, surface: 'discord' });
export const complete = (env, body) => call(env, '/api/round/complete', { ...body, surface: 'discord' });
