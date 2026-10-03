import { json, safe } from '../../_util.js';
import { latestKpi } from '../../_kpi.js';

export const onRequestGet = safe(async ({ env }) => json(await latestKpi(env.DB), 200, { 'cache-control': 'public, max-age=300' }));
