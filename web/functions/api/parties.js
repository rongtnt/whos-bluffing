import { json, safe } from '../_util.js';
import { sideBoard } from '../_labs.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };

// GET /api/parties?range=all|30d (default all): the Politics pack's board (democrat, republican, independent, none),
// cached 60 s per data centre and range (the key ignores any other query parameters).
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || 'all';
  const key = new Request(new URL(`/api/parties?range=${encodeURIComponent(range)}`, url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await sideBoard(env.DB, 'politics', range, new Date());
  if (r.status !== 200) return json(r.body, r.status);
  const res = json(r.body, 200, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
