import { json, safe } from '../../_util.js';
import { getRound } from '../../_rounds.js';
import { ROUNDS } from '../../_rounds_data.js';

// GET /api/round?mode=quick&seen=…&difficulty=easy|normal|brutal&pack=<pack id|all> (or ?round_id=… for a
// challenge link). A quick round is created here.
export const onRequestGet = safe(async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  if (q.get('mode') === 'ranked') return json({ error: 'Daily ranked rounds have been retired. Choose a topic to play.' }, 410, { 'cache-control': 'no-store' });
  const params = { mode: q.get('mode'), seen: q.get('seen'), round_id: q.get('round_id'), difficulty: q.get('difficulty'), pack: q.get('pack') };
  const r = await getRound(env.DB, ROUNDS, params, new Date());
  return json(r.body, r.status, { 'cache-control': 'no-store' });
});
