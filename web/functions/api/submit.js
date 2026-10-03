import bank from '../_items.json';
import { scoreSession } from '../_metrics.js';
import { json, fail, safe, readJson, validateSubmit } from '../_util.js';
import { getStats } from './stats.js';

const ITEMS = new Map(bank.items.map((i) => [i.id, i]));
const MIN_PERCENTILE_N = 30;

// Mid-rank percentile among same-language passed sessions: share below you, ties count half.
// ponytail: reads every such row on each submit (O(n) D1 rows read); past ~5M rows/day this needs the paid plan
// or a percentile computed from a cached histogram.
const PERCENTILE_SQL = `SELECT COUNT(*) AS n,
  SUM(CASE WHEN overconf < ?1 THEN 1.0 WHEN overconf = ?1 THEN 0.5 ELSE 0 END) AS below_oc,
  SUM(CASE WHEN int_hit < ?2 THEN 1.0 WHEN int_hit = ?2 THEN 0.5 ELSE 0 END) AS below_ih
  FROM sessions WHERE lang = ?3 AND passed_attention = 1`;

const INSERT_SQL = `INSERT INTO sessions (id, created_at, lang, country, class_code, first_session_id, demographics,
  answers, n_2afc, n_interval, acc, mean_conf, overconf, brier, auroc, int_hit, passed_attention, total_rt_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const onRequestPost = safe(async (ctx) => {
  const { request, env } = ctx;
  const { body, error } = await readJson(request);
  if (error) return error;
  if (body?.website) return new Response(null, { status: 204 }); // honeypot filled: store nothing
  const invalid = validateSubmit(body, ITEMS);
  if (invalid) return fail(400, invalid);

  const s = scoreSession(body.answers, ITEMS);
  const pct = await env.DB.prepare(PERCENTILE_SQL).bind(s.scores.overconf, s.scores.int_hit, body.lang).first();
  const id = crypto.randomUUID();
  const demographics = body.demographics && Object.keys(body.demographics).length ? JSON.stringify(body.demographics) : null;
  await env.DB.prepare(INSERT_SQL).bind(
    id, new Date().toISOString(), body.lang, request.cf?.country ?? 'ZZ', body.class_code ?? null,
    body.first_session_id ?? null, demographics, JSON.stringify(s.answers), s.n_2afc, s.n_interval,
    s.scores.acc, s.scores.mean_conf, s.scores.overconf, s.scores.brier, s.scores.auroc, s.scores.int_hit,
    s.passed_attention ? 1 : 0, s.total_rt_ms,
  ).run();

  const stats = await getStats(ctx);
  const percentile = pct.n >= MIN_PERCENTILE_N
    ? { overconf: Math.round((100 * pct.below_oc) / pct.n), int_hit: Math.round((100 * pct.below_ih) / pct.n) }
    : null;
  return json({
    session_id: id,
    scores: s.scores,
    bins: s.bins,
    interval_detail: s.interval_detail,
    percentile,
    global: { n_sessions: stats.n_sessions, n_countries: stats.n_countries },
  });
});
