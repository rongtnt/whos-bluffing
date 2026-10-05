import { json, safe, CORS } from '../_util.js';
import { boardView } from '../_dares.js';
import { ROUNDS } from '../_rounds_data.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60', ...CORS };

// GET /api/dares: the dare board (docs/api-rounds.md, Dares). Cached 60 s per data centre. A public read: aggregates only.
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const key = new Request(new URL('/api/dares', request.url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await boardView(env.DB, ROUNDS, new Date());
  const res = json(r.body, 200, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
