import { json, safe, readJson } from '../../_util.js';
import { claimSide } from '../../_labs.js';
import { ROUNDS } from '../../_rounds_data.js';

// POST /api/round/party {round_id, anon_id, party}: after a Politics-pack quick round, the side the player says they are on.
export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await claimSide(env.DB, ROUNDS, 'politics', body, new Date());
  return json(r.body, r.status);
});
