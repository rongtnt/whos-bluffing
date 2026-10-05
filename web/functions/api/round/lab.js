import { json, safe, readJson } from '../../_util.js';
import { claimLab } from '../../_labs.js';
import { ROUNDS } from '../../_rounds_data.js';

// POST /api/round/lab {round_id, anon_id, lab}: after an AI-pack quick round, the lab the player says they are with.
export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await claimLab(env.DB, ROUNDS, body, new Date());
  return json(r.body, r.status);
});
