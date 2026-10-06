import { json, safe } from '../../_util.js';
import { authorized, playerCounts } from '../../_kpi.js';
import { todayUTC } from '../../_daily.js';

// Owner-only, never served from the former public KPI cache. Keep credentials in headers, not URLs.
export const onRequestGet = safe(async ({ request, env }) => {
  const headers = { 'cache-control': 'private, no-store', vary: 'x-kpi-key' };
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401, headers);
  return json(await playerCounts(env.DB, todayUTC()), 200, headers);
});
