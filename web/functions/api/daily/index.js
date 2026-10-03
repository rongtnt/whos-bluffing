import { json, safe } from '../../_util.js';
import { getDay } from '../../_daily.js';
import { DAILY } from '../../_daily_data.js';

export const onRequestGet = safe(async ({ request, env }) => {
  const r = await getDay(env.DB, DAILY, new URL(request.url).searchParams.get('date'), new Date());
  return json(r.body, r.status, { 'cache-control': 'no-store' });
});
