import { bins, mean, round6 } from '../../../_metrics.js';
import { json, fail, safe, SECRET_RE } from '../../../_util.js';

const MIN_CLASS_N = 5; // privacy: below this, only the count is returned
const HIST = { from: -50, to: 100, step: 10 }; // overconfidence in percentage points

function histogram(values) {
  const buckets = [];
  for (let from = HIST.from; from < HIST.to; from += HIST.step) buckets.push({ from, to: from + HIST.step, n: 0 });
  for (const v of values) {
    const pp = Math.round(v * 1000) / 10; // removes float noise before bucketing
    const i = Math.floor((pp - HIST.from) / HIST.step);
    buckets[Math.min(buckets.length - 1, Math.max(0, i))].n += 1;
  }
  return buckets;
}

// Aggregates for one class, counting every completed session that used its code. Never returns rows.
// Returns null when the secret is unknown.
export async function classAggregate(env, secret) {
  if (!SECRET_RE.test(secret)) return null;
  const cls = await env.DB.prepare('SELECT code FROM classes WHERE secret = ?').bind(secret).first();
  if (!cls) return null;
  const { results } = await env.DB.prepare('SELECT overconf, int_hit, answers FROM sessions WHERE class_code = ?').bind(cls.code).all();
  const n = results.length;
  if (n < MIN_CLASS_N) return { n };
  const two = results.flatMap((r) => JSON.parse(r.answers).filter((a) => a.type === '2afc'));
  return {
    n,
    bins: bins(two.map((a) => a.conf / 100), two.map((a) => a.correct)).map((b) => ({ ...b, acc: round6(b.acc) })),
    overconf_mean: round6(mean(results.map((r) => r.overconf))),
    int_hit_mean: round6(mean(results.map((r) => r.int_hit))),
    overconf_hist: histogram(results.map((r) => r.overconf)),
  };
}

// Same aggregates as long-format CSV (same n >= 5 rule).
export function toCsv(a) {
  const rows = [['metric', 'bucket', 'n', 'value'], ['students', '', a.n, '']];
  if (a.bins) {
    rows.push(['overconf_mean', '', a.n, a.overconf_mean], ['int_hit_mean', '', a.n, a.int_hit_mean]);
    for (const b of a.bins) rows.push(['accuracy_at_confidence', b.conf, b.n, b.acc ?? '']);
    for (const h of a.overconf_hist) rows.push(['overconf_hist_points', `${h.from} to ${h.to}`, h.n, '']);
  }
  return `${rows.map((r) => r.join(',')).join('\n')}\n`;
}

const CSV_HEADERS = {
  'content-type': 'text/csv; charset=utf-8',
  'content-disposition': 'attachment; filename="whosbluffing-class.csv"',
  'cache-control': 'no-store',
};

// Serves GET /api/class/d/:secret (JSON) and /api/class/d/:secret.csv. A separate [secret].csv.js route is
// unreachable: wrangler's router stops at the first match and ":secret" also matches "<secret>.csv".
export const onRequestGet = safe(async ({ params, env }) => {
  const csv = params.secret.endsWith('.csv');
  const agg = await classAggregate(env, csv ? params.secret.slice(0, -4) : params.secret);
  if (!agg) return fail(404, 'unknown dashboard');
  return csv ? new Response(toCsv(agg), { headers: CSV_HEADERS }) : json(agg, 200, { 'cache-control': 'no-store' });
});
