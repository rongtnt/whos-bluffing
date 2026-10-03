import { json, safe } from '../../_util.js';
import { dayStats, todayUTC } from '../../_daily.js';
import { DAILY } from '../../_daily_data.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };

// Cached 60 s per data centre and date (the key ignores any other query parameters).
export const onRequestGet = safe(async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayUTC();
  const key = new Request(new URL(`/api/daily/stats?date=${encodeURIComponent(date)}`, url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await dayStats(env.DB, DAILY, date, new Date());
  if (r.status !== 200) return json(r.body, r.status);
  const res = json(r.body, 200, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
