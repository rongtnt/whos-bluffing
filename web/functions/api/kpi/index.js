import { json, safe, CORS } from '../../_util.js';
import { latestKpi } from '../../_kpi.js';

// The latest daily KPI row. A public read.
export const onRequestGet = safe(async ({ env }) => json({ ...(await latestKpi(env.DB)), anki_contributors_30d: 0 }, 200, { 'cache-control': 'public, max-age=300', ...CORS }));
