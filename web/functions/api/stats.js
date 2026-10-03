import { LEVELS, round6 } from '../_metrics.js';
import { json, safe } from '../_util.js';

const CACHE_HEADERS = { 'cache-control': 'public, max-age=60' };
const NOT_COUNTRIES = "('ZZ', 'XX', 'T1')"; // unknown or Tor, not countries

const TOTALS_SQL = `SELECT COUNT(*) AS n_sessions, COALESCE(SUM(n_2afc + n_interval), 0) AS n_answers,
  COUNT(DISTINCT CASE WHEN country NOT IN ${NOT_COUNTRIES} THEN country END) AS n_countries
  FROM sessions WHERE passed_attention = 1`;
const BY_LANG_SQL = `SELECT lang, COUNT(*) AS n, AVG(overconf) AS overconf_mean, AVG(int_hit) AS int_hit_mean
  FROM sessions WHERE passed_attention = 1 GROUP BY lang`;
const BINS_SQL = `SELECT s.lang AS lang, json_extract(a.value, '$.conf') AS conf, COUNT(*) AS n,
  AVG(json_extract(a.value, '$.correct')) AS acc
  FROM sessions s, json_each(s.answers) a
  WHERE s.passed_attention = 1 AND json_extract(a.value, '$.type') = '2afc'
  GROUP BY s.lang, conf`;

async function computeStats(db) {
  const [totals, byLang, binRows] = await db.batch([db.prepare(TOTALS_SQL), db.prepare(BY_LANG_SQL), db.prepare(BINS_SQL)]);
  const by_lang = {};
  for (const lang of ['en', 'zh']) {
    const row = byLang.results.find((r) => r.lang === lang);
    by_lang[lang] = {
      n: row?.n ?? 0,
      overconf_mean: round6(row?.overconf_mean ?? null),
      int_hit_mean: round6(row?.int_hit_mean ?? null),
      bins: LEVELS.map((conf) => {
        const b = binRows.results.find((r) => r.lang === lang && Math.abs(r.conf / 100 - conf) < 1e-9);
        return { conf, n: b?.n ?? 0, acc: b ? round6(b.acc) : null };
      }),
    };
  }
  const t = totals.results[0];
  return { n_sessions: t.n_sessions, n_answers: t.n_answers, n_countries: t.n_countries, by_lang, updated_at: new Date().toISOString() };
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
