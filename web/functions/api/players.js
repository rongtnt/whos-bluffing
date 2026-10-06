import { json, safe, CORS } from '../_util.js';
import { todayUTC } from '../_daily.js';
import { totalPlayers } from '../_kpi.js';

// The only public product metric. No private activity counts enter this response or cache.
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const key = new Request(new URL('/api/players', request.url));
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const response = json({ total_players: await totalPlayers(env.DB, todayUTC()) }, 200,
    { 'cache-control': 'public, max-age=60', ...CORS });
  waitUntil(caches.default.put(key, response.clone()));
  return response;
});
