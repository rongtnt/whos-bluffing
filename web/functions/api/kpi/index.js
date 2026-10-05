import { json, fail, safe } from '../../_util.js';
import { authorized, latestKpi, allTimeTotals } from '../../_kpi.js';

// The latest daily KPI row plus the all-time totals. A private read: header x-kpi-key, else 401.
export const onRequestGet = safe(async ({ request, env }) => {
  if (!(await authorized(request, env))) return fail(401, 'unauthorized');
  const [kpi, totals] = await Promise.all([latestKpi(env.DB), allTimeTotals(env.DB)]);
  return json({ ...kpi, ...totals, anki_contributors_30d: 0 }, 200, { 'cache-control': 'no-store' });
});
