import { json, safe, readJson } from '../_util.js';
import { flag } from '../_daily.js';
import { flagPair, PAIR_RE } from '../_rounds.js';
import { DAILY } from '../_daily_data.js';
import { ROUNDS } from '../_rounds_data.js';

// POST /api/flag: p00001 or q00001 (with round_id) flags a round question; w0001 flags a daily-game item.
export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const isPair = typeof body?.item_id === 'string' && PAIR_RE.test(body.item_id);
  const r = await (isPair ? flagPair(env.DB, ROUNDS, body, new Date()) : flag(env.DB, DAILY, body, new Date()));
  return json(r.body, r.status);
});
