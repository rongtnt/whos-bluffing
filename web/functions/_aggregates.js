// Running aggregates (migrations/0002_aggregates.sql). Each submit reads at most 28 histogram rows and adds
// its session to the aggregates in the same batch; nothing here scans the sessions table.

export const MIN_PERCENTILE_N = 30;

// Overconfidence in 0.05-wide bins clamped to [-0.5, +0.5]; hit rate in exact bins (k of 6).
export const overconfBin = (x) => Math.max(-10, Math.min(10, Math.round(x * 20))) + 0; // + 0 turns -0 into 0
export const intHitBin = (x) => Math.round(x * 6);

// Mid-rank from a histogram [{bin, n}]: share of mass in lower bins plus half of your own bin, in percent.
export function histPercentile(rows, bin) {
  let total = 0;
  let below = 0;
  let same = 0;
  for (const r of rows) {
    total += r.n;
    if (r.bin < bin) below += r.n;
    else if (r.bin === bin) same += r.n;
  }
  return total ? Math.round((100 * (below + same / 2)) / total) : null;
}

// Same-language histogram rows, read before this session is added (so it is compared with everyone else).
export const HIST_SQL = 'SELECT metric, bin, n FROM agg_hist WHERE lang = ?';

// rows: HIST_SQL result. null until MIN_PERCENTILE_N passed sessions exist in that language.
export function percentiles(rows, scores) {
  const of = (metric) => rows.filter((r) => r.metric === metric);
  const n = of('overconf').reduce((s, r) => s + r.n, 0);
  if (n < MIN_PERCENTILE_N) return null;
  return {
    overconf: histPercentile(of('overconf'), overconfBin(scores.overconf)),
    int_hit: histPercentile(of('int_hit'), intHitBin(scores.int_hit)),
  };
}

// Calibration counts per confidence level for one session's two-alternative answers.
export function binCounts(answers) {
  const byConf = new Map();
  for (const a of answers) {
    if (a.type !== '2afc') continue;
    const b = byConf.get(a.conf) ?? { conf: a.conf, n: 0, correct: 0 };
    byConf.set(a.conf, { conf: a.conf, n: b.n + 1, correct: b.correct + a.correct });
  }
  return [...byConf.values()];
}

// Upserts that add one scored session (from scoreSession) to the aggregates: 4 statements, ≤ 10 rows.
// Sessions that failed an attention check are stored but never aggregated.
export function aggregateWrites(db, lang, country, s) {
  if (!s.passed_attention) return [];
  const bins = binCounts(s.answers);
  return [
    db.prepare(`INSERT INTO agg_totals (lang, n_sessions, n_answers, sum_overconf, sum_int_hit) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT (lang) DO UPDATE SET n_sessions = n_sessions + 1, n_answers = n_answers + excluded.n_answers,
      sum_overconf = sum_overconf + excluded.sum_overconf, sum_int_hit = sum_int_hit + excluded.sum_int_hit`)
      .bind(lang, s.n_2afc + s.n_interval, s.scores.overconf, s.scores.int_hit),
    db.prepare(`INSERT INTO agg_hist (lang, metric, bin, n) VALUES (?, 'overconf', ?, 1), (?, 'int_hit', ?, 1)
      ON CONFLICT (lang, metric, bin) DO UPDATE SET n = n + excluded.n`)
      .bind(lang, overconfBin(s.scores.overconf), lang, intHitBin(s.scores.int_hit)),
    db.prepare(`INSERT INTO agg_bins (lang, conf, n, correct) VALUES ${bins.map(() => '(?, ?, ?, ?)').join(', ')}
      ON CONFLICT (lang, conf) DO UPDATE SET n = n + excluded.n, correct = correct + excluded.correct`)
      .bind(...bins.flatMap((b) => [lang, b.conf, b.n, b.correct])),
    db.prepare('INSERT INTO agg_country (country, n) VALUES (?, 1) ON CONFLICT (country) DO UPDATE SET n = n + 1')
      .bind(country),
  ];
}
