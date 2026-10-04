import { json, safe, CORS } from '../../_util.js';
import { latestKpiWithAnki } from '../../_anki.js';

// The latest daily KPI row. A public read.
export const onRequestGet = safe(async ({ env }) => json(await latestKpiWithAnki(env.DB), 200, { 'cache-control': 'public, max-age=300', ...CORS }));
