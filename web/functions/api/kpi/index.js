import { json, safe } from '../../_util.js';
import { latestKpiWithAnki } from '../../_anki.js';

export const onRequestGet = safe(async ({ env }) => json(await latestKpiWithAnki(env.DB), 200, { 'cache-control': 'public, max-age=300' }));
