import { json, fail, safe } from '../../_util.js';
import { authorized, runKpi } from '../../_kpi.js';
import { isDate, todayUTC } from '../../_daily.js';

// POST /api/kpi/run[?as_of=YYYY-MM-DD], header x-kpi-key. as_of defaults to today (UTC); the cron Worker in
// web/kpi-worker/ sends yesterday so each stored row covers a whole day.
export const onRequestPost = safe(async ({ request, env }) => {
  if (!(await authorized(request, env))) return fail(401, 'unauthorized');
  const asOf = new URL(request.url).searchParams.get('as_of') || todayUTC();
  if (!isDate(asOf) || asOf > todayUTC()) return fail(400, 'as_of must be a UTC date no later than today');
  return json(await runKpi(env.DB, asOf, new Date()), 200, { 'cache-control': 'no-store' });
});
