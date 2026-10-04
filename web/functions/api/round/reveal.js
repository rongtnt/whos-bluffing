import { json, safe, isBot } from '../../_util.js';
import { reveal } from '../../_rounds.js';
import { ROUNDS } from '../../_rounds_data.js';

// GET /api/round/reveal?date=&community= — settles and counts one community's answers. Today's needs x-howsure-bot.
export const onRequestGet = safe(async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  const r = await reveal(env.DB, ROUNDS, { date: q.get('date'), community: q.get('community') }, new Date(), await isBot(request, env));
  return json(r.body, r.status, { 'cache-control': 'no-store' });
});
