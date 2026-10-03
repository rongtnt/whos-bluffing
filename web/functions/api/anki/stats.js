import { json, safe } from '../../_util.js';
import { ankiStats } from '../../_anki.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };

// {installs_30d, rows_total} from anki_agg only, cached 60 s per data centre (the key ignores query parameters).
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const key = new Request(new URL('/api/anki/stats', request.url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await ankiStats(env.DB, new Date());
  const res = json(r.body, r.status, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
