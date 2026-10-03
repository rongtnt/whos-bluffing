// KPI job (prereg/PREREG.md, "Metric definitions"), run once a day through POST /api/kpi/run. It is the only code
// that scans plays, players and sessions; GET /api/kpi and the stats page read just the latest kpi row.
//   MAU: anonymous ids with >= 1 completed play (full assessment or daily game) in the trailing 30 days, summed
//        across surfaces without cross-surface deduplication. DAU likewise for one UTC day.
//   Communities: Slack workspaces with >= 1 completed play in the trailing 30 days + classrooms with >= 5
//        finished assessments.
// A daily play counts on its game day; a full assessment counts on the day it was finished, as surface "classroom"
// when it carried a class code, else "web". Sessions without an anon_id have no anonymous id and are not counted.
import { addDays, SURFACES } from './_daily.js';

const WINDOW_DAYS = 30;
const MIN_CLASS = 5;

const ACTIVITY = `SELECT anon_id, surface, date AS d FROM plays
  UNION ALL
  SELECT anon_id, CASE WHEN class_code IS NULL THEN 'web' ELSE 'classroom' END, substr(created_at, 1, 10)
  FROM sessions WHERE anon_id IS NOT NULL`;
const ACTIVE_SQL = `SELECT surface, COUNT(DISTINCT anon_id) AS mau, COUNT(DISTINCT CASE WHEN d = ? THEN anon_id END) AS dau
  FROM (${ACTIVITY}) WHERE d BETWEEN ? AND ? GROUP BY surface`;
const WORKSPACES_SQL = `SELECT COUNT(DISTINCT pl.community) AS n FROM plays p JOIN players pl ON pl.anon_id = p.anon_id
  WHERE p.surface = 'slack' AND pl.community IS NOT NULL AND p.date BETWEEN ? AND ?`;
const CLASSROOMS_SQL = `SELECT COUNT(*) AS n FROM (SELECT class_code FROM sessions
  WHERE class_code IS NOT NULL AND substr(created_at, 1, 10) <= ? GROUP BY class_code HAVING COUNT(*) >= ${MIN_CLASS})`;

export async function computeKpi(db, asOf) {
  const start = addDays(asOf, 1 - WINDOW_DAYS);
  const [active, workspaces, classrooms] = await db.batch([
    db.prepare(ACTIVE_SQL).bind(asOf, start, asOf),
    db.prepare(WORKSPACES_SQL).bind(start, asOf),
    db.prepare(CLASSROOMS_SQL).bind(asOf),
  ]);
  const by = Object.fromEntries(SURFACES.map((s) => [s, active.results.find((r) => r.surface === s) ?? { mau: 0, dau: 0 }]));
  const total = (k) => SURFACES.reduce((sum, s) => sum + by[s][k], 0);
  return {
    as_of: asOf,
    mau: total('mau'),
    dau: total('dau'),
    mau_web: by.web.mau,
    mau_slack: by.slack.mau,
    mau_classroom: by.classroom.mau,
    workspaces: workspaces.results[0].n,
    classrooms: classrooms.results[0].n,
  };
}

const COLUMNS = ['as_of', 'mau', 'dau', 'mau_web', 'mau_slack', 'mau_classroom', 'workspaces', 'classrooms', 'computed_at'];

// Computes and stores the KPIs for as_of (re-running a day overwrites its row).
export async function runKpi(db, asOf, now) {
  const row = { ...(await computeKpi(db, asOf)), computed_at: now.toISOString() };
  await db.prepare(`INSERT INTO kpi (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})
    ON CONFLICT (as_of) DO UPDATE SET ${COLUMNS.slice(1).map((c) => `${c} = excluded.${c}`).join(', ')}`)
    .bind(...COLUMNS.map((c) => row[c])).run();
  return row;
}

// GET /api/kpi shape; zeros and as_of null before the first run.
export const publicKpi = (r) => ({
  as_of: r?.as_of ?? null,
  mau: r?.mau ?? 0,
  dau: r?.dau ?? 0,
  mau_by_surface: { web: r?.mau_web ?? 0, slack: r?.mau_slack ?? 0, classroom: r?.mau_classroom ?? 0 },
  communities: { workspaces: r?.workspaces ?? 0, classrooms: r?.classrooms ?? 0 },
});

export const latestKpi = async (db) => publicKpi(await db.prepare('SELECT * FROM kpi ORDER BY as_of DESC LIMIT 1').first());

// The x-kpi-key header must match env.KPI_KEY. No key configured -> nobody is authorized (fail closed).
// Compares SHA-256 digests in constant time.
export async function authorized(request, env) {
  const given = request.headers.get('x-kpi-key');
  if (!env.KPI_KEY || !given) return false;
  const digest = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(env.KPI_KEY)]);
  return a.reduce((diff, x, i) => diff | (x ^ b[i]), 0) === 0;
}
