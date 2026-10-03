import bank from '../_items.json';
import { scoreSession } from '../_metrics.js';
import { json, fail, safe, readJson, validateSubmit } from '../_util.js';
import { HIST_SQL, aggregateWrites, percentiles } from '../_aggregates.js';
import { getStats } from './stats.js';

const ITEMS = new Map(bank.items.map((i) => [i.id, i]));

const INSERT_SQL = `INSERT INTO sessions (id, created_at, lang, country, class_code, first_session_id, demographics,
  answers, n_2afc, n_interval, acc, mean_conf, overconf, brier, auroc, int_hit, passed_attention, total_rt_ms, anon_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const onRequestPost = safe(async (ctx) => {
  const { request, env } = ctx;
  const { body, error } = await readJson(request);
  if (error) return error;
  if (body?.website) return new Response(null, { status: 204 }); // honeypot filled: store nothing
  const invalid = validateSubmit(body, ITEMS);
  if (invalid) return fail(400, invalid);

  const s = scoreSession(body.answers, ITEMS);
  const id = crypto.randomUUID();
  const country = request.cf?.country ?? 'ZZ';
  const demographics = body.demographics && Object.keys(body.demographics).length ? JSON.stringify(body.demographics) : null;
  const db = env.DB;
  // One batch = one transaction. The histogram read runs first, so the percentile compares with everyone else.
  const [hist] = await db.batch([
    db.prepare(HIST_SQL).bind(body.lang),
    db.prepare(INSERT_SQL).bind(
      id, new Date().toISOString(), body.lang, country, body.class_code ?? null,
      body.first_session_id ?? null, demographics, JSON.stringify(s.answers), s.n_2afc, s.n_interval,
      s.scores.acc, s.scores.mean_conf, s.scores.overconf, s.scores.brier, s.scores.auroc, s.scores.int_hit,
      s.passed_attention ? 1 : 0, s.total_rt_ms, body.anon_id ?? null,
    ),
    ...aggregateWrites(db, body.lang, country, s),
  ]);

  const stats = await getStats(ctx);
  return json({
    session_id: id,
    scores: s.scores,
    bins: s.bins,
    interval_detail: s.interval_detail,
    percentile: percentiles(hist.results, s.scores),
    global: { n_sessions: stats.n_sessions, n_countries: stats.n_countries },
  });
});
