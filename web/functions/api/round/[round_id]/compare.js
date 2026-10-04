import { json, safe } from '../../../_util.js';
import { compare } from '../../../_rounds.js';
import { ROUNDS } from '../../../_rounds_data.js';

// GET /api/round/:round_id/compare?me=<anon_id>&them=<public token>
export const onRequestGet = safe(async ({ request, env, params }) => {
  const q = new URL(request.url).searchParams;
  const r = await compare(env.DB, ROUNDS, params.round_id, q.get('me'), q.get('them'), new Date());
  return json(r.body, r.status, { 'cache-control': 'no-store' });
});
