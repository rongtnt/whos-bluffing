import { json, safe, CORS } from '../../_util.js';
import { dareView } from '../../_dares.js';
import { ROUNDS } from '../../_rounds_data.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60', ...CORS };

// GET /api/dare/:slug: one dare's numbers and status (docs/api-rounds.md, Dares). Cached 60 s per data centre and slug.
// A public read: aggregates only.
export const onRequestGet = safe(async ({ request, env, params, waitUntil }) => {
  const key = new Request(new URL(`/api/dare/${encodeURIComponent(params.slug)}`, request.url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const r = await dareView(env.DB, ROUNDS, params.slug, new Date());
  if (r.status !== 200) return json(r.body, r.status, CORS);
  const res = json(r.body, 200, CACHE_HEADERS);
  waitUntil(caches.default.put(key, res.clone()));
  return res;
});
