import { json, safe } from '../_util.js';
import { labBoard } from '../_labs.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };

// GET /api/labs?range=all|30d (default all): the lab board, cached 60 s per data centre and range (the key ignores any
// other query parameters).
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || 'all';
  const key = new Request(new URL(`/api/labs?range=${encodeURIComponent(range)}`, url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await labBoard(env.DB, range, new Date());
  if (r.status !== 200) return json(r.body, r.status);
  const res = json(r.body, 200, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
