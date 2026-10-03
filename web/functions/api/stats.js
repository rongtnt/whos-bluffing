import { LEVELS, round6 } from '../_metrics.js';
import { json, safe } from '../_util.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };

// Reads only the aggregate tables (migrations/0002): at most 2 + 12 + one row per country.
const TOTALS_SQL = 'SELECT lang, n_sessions, n_answers, sum_overconf, sum_int_hit FROM agg_totals';
const BINS_SQL = 'SELECT lang, conf, n, correct FROM agg_bins';
const COUNTRIES_SQL = "SELECT COUNT(*) AS n FROM agg_country WHERE country NOT IN ('ZZ', 'XX', 'T1')"; // unknown/Tor are not countries

async function computeStats(db) {
  const [totals, bins, countries] = await db.batch([db.prepare(TOTALS_SQL), db.prepare(BINS_SQL), db.prepare(COUNTRIES_SQL)]);
  const by_lang = {};
  for (const lang of ['en']) {
    const t = totals.results.find((r) => r.lang === lang);
    const n = t?.n_sessions ?? 0;
    by_lang[lang] = {
      n,
      overconf_mean: n ? round6(t.sum_overconf / n) : null,
      int_hit_mean: n ? round6(t.sum_int_hit / n) : null,
      bins: LEVELS.map((conf) => {
        const b = bins.results.find((r) => r.lang === lang && r.conf === Math.round(conf * 100));
        return { conf, n: b?.n ?? 0, acc: b ? round6(b.correct / b.n) : null };
      }),
    };
  }
  const sum = (key) => totals.results.reduce((s, r) => s + r[key], 0);
  return {
    n_sessions: sum('n_sessions'),
    n_answers: sum('n_answers'),
    n_countries: countries.results[0].n,
    by_lang,
    updated_at: new Date().toISOString(),
  };
}

// Site-wide stats (passed sessions only), cached 60 s per data centre. Submit reuses it for the global counters.
export async function getStats({ request, env, waitUntil }) {
  const key = new Request(new URL('/api/stats', request.url).toString());
  const cached = await caches.default.match(key);
  if (cached) return cached.json();
  const data = await computeStats(env.DB);
  waitUntil(caches.default.put(key, json(data, 200, CACHE_HEADERS)));
  return data;
}

export const onRequestGet = safe(async (ctx) => json(await getStats(ctx), 200, CACHE_HEADERS));
